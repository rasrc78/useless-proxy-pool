import { request, ProxyAgent, Dispatcher } from 'undici';
import { ProxyAnonymity } from './store.js';
import { getLogger } from './logger.js';

interface HttpbinBody {
    arg: Record<string, unknown>;
    headers: Record<string, string>;
    method: string;
    origin: string;
    url: string;
}

const CONNECTION_TEST_URL = 'http://www.apple.com/library/test/success.html';
const GET_HEADER_URL = 'https://httpbin.org/get';

// prettier-ignore
const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:160.0) Gecko/20100101 Firefox/160.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Priority": "u=0, i"
}

const logger = getLogger('proxy-check');

function parseRetryAfterHeader(
    value: string | string[] | undefined,
    fallback: number = 1000,
): number {
    value = Array.isArray(value) ? value[0] : value;
    if (!value) return fallback;

    const sec = Number(value);
    if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
    const date = new Date(value);
    const delta = date.valueOf() - Date.now();
    if (delta >= 0) return delta;

    return fallback;
}

export async function checkAnonymity(proxy: string): Promise<ProxyAnonymity | -1> {
    const agent = new ProxyAgent({
        uri: proxy,
        proxyTls: {
            rejectUnauthorized: false,
        },
    });
    const ac = new AbortController();
    const abortTimer = setTimeout(() => ac.abort(), 30000);
    abortTimer.unref();

    let resp: Dispatcher.ResponseData | undefined;
    for (let i = 0; i < 5; i++) {
        let current;
        try {
            current = await request(GET_HEADER_URL, {
                method: 'GET',
                dispatcher: agent,
                headersTimeout: 10000,
                bodyTimeout: 10000,
                signal: ac.signal,
                headers,
            });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : undefined;
            logger.debug({ proxy, errMsg }, '检测匿名性时连接错误');
            await agent.close().catch(() => {});
            return -1; // 连接错误，应将代理标记为不可用
        }

        // 速率限制为单个IP每秒两次
        if (current.statusCode === 429) {
            logger.debug({ proxy }, '超出服务器速率限制');
            if (i === 4) return -1;
            await new Promise((resolve) => {
                setTimeout(resolve, parseRetryAfterHeader(current.headers['retry-after']));
            });
            continue;
        }
        resp = current;
        clearTimeout(abortTimer);
        break;
    }
    await agent.close().catch(() => {});
    if (!resp) return -1;

    let body: HttpbinBody;
    try {
        body = (await resp.body.json()) as HttpbinBody;
    } catch {
        logger.debug({ proxy }, '返回内容异常');
        return -1; // 偶尔有代理会返回莫名其妙的内容
    }
    if (body.origin.indexOf(',') >= 0) {
        return 0;
    } else if (Object.keys(body.headers).some((k) => /Forward|^X-|-IP$|Via/i.test(k))) {
        return 0;
    } else {
        return 1;
    }
}

export async function checkConnection(proxy: string) {
    const agent = new ProxyAgent({
        uri: proxy,
        proxyTls: {
            rejectUnauthorized: false,
        },
    });
    try {
        const resp = await request(CONNECTION_TEST_URL, {
            method: 'HEAD',
            headersTimeout: 10000,
            bodyTimeout: 10000,
            dispatcher: agent,
        });
        if (isSuccess(resp.statusCode)) {
            logger.debug({ proxy }, '检测可用性成功');
            return true;
        } else {
            logger.debug({ proxy, status: resp.statusCode }, '检测可用性时发生HTTP错误');
            return false;
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : undefined;
        logger.debug({ proxy, errMsg }, '检测可用性时连接错误');
        return false;
    } finally {
        await agent.close().catch(() => {});
    }
}

function isSuccess(statusCode: number): boolean {
    if (200 <= statusCode && statusCode < 300) {
        return true;
    } else {
        return false;
    }
}
