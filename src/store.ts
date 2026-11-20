import Database from 'better-sqlite3';

export interface ProxyAddress {
    ip: string;
    port: number;
}
export interface ProxyUpdatedData {
    ip: string;
    protocol?: string;
    status?: ProxyStatus;
    anonymity?: ProxyAnonymity;
    lastCheck?: number;
}

export const PROXY_STATUS = {
    NO_CHECK: 0,
    ACTIVE: 1,
    INACTIVE: 2,
    DEAD: 3,
} as const;
export type ProxyStatus = (typeof PROXY_STATUS)[keyof typeof PROXY_STATUS];

export const PROXY_ANONYMITY = {
    TRANSPARENT: 0,
    ANONYMOUS: 1,
} as const;
export type ProxyAnonymity = (typeof PROXY_ANONYMITY)[keyof typeof PROXY_ANONYMITY];

export default class Store {
    private db: Database.Database;
    private stmtCache = new Map<string, Database.Statement>();
    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(
            `CREATE TABLE IF NOT EXISTS proxies (
                ip          TEXT UNIQUE NOT NULL,
                port        INTEGER NOT NULL,
                protocol    TEXT,
                status      INTEGER,
                anonymity   INTEGER,
                lastCheck   INTEGER,
                lastActive  INTEGER
            )`,
        );
    }

    private getInsertStmt(): Database.Statement {
        let insert = this.stmtCache.get('insert');
        if (!insert) {
            const insertStmt = this.db.prepare(
                'INSERT OR IGNORE INTO proxies (ip, port, status) VALUES (@ip, @port, 0)',
            );
            this.stmtCache.set('insert', insertStmt);
            insert = insertStmt;
        }
        return insert;
    }
    addProxy(proxy: ProxyAddress): void {
        const insert = this.getInsertStmt();
        insert.run(proxy);
    }
    addProxies(proxies: ProxyAddress[]): void {
        const insert = this.getInsertStmt();
        const insertMany = this.db.transaction((proxies: ProxyAddress[]) => {
            for (const proxy of proxies) {
                insert.run(proxy);
            }
        });
        insertMany(proxies);
    }

    updateProxy(data: ProxyUpdatedData): void {
        const { ip, ...optionalData } = data;
        const columes: string[] = [];
        const values: unknown[] = [];

        for (const [k, v] of Object.entries(optionalData)) {
            if (v === undefined) continue;
            columes.push(`${k} = ?`);
            values.push(v);
        }

        if (columes.length === 0) return;
        const updateStmt = this.db.prepare(`UPDATE proxies SET ${columes.join(',')} WHERE ip = ?`);
        updateStmt.run(...values, ip);
    }
    updateProxies(datas: ProxyUpdatedData[]) {
        const updateMany = this.db.transaction((datas) => {
            for (const data of datas) {
                this.updateProxy(data);
            }
        });
        updateMany(datas);
    }
    // TODO: Query
    close() {
        this.db.close();
    }
}
