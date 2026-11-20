import { getLogger } from './logger.js';
import { fetchProxy } from './spider.js';
import { checkConnection } from './check.js';
import Store, { PROXY_STATUS, ProxyAddress, ProxyUpdatedData } from './store.js';

const SOURCE_URL = new URL('https://proxy.scdn.io/text.php');
const CONCURRENCY = 10;

const logger = getLogger('main');
const store = new Store('./data.db');

process.on('SIGINT', () => {
    store.close();
    process.exit(0);
});

async function checkProxy(proxy: ProxyAddress): Promise<ProxyUpdatedData> {
    const ipWithPort = `${proxy.ip}:${proxy.port}`;
    const protocol = ['http', 'socks5'];
    const proxyWithProtocol = protocol.map((ptc) => `${ptc}://${ipWithPort}`);
    const results = await Promise.allSettled(proxyWithProtocol.map(checkConnection));

    const activeProtocol = results
        .map((res, i) => {
            if (res.status === 'rejected' || !res.value) return null;
            return protocol[i];
        })
        .filter(Boolean);

    return {
        ip: proxy.ip,
        protocol: activeProtocol.join(',') || undefined,
        status: activeProtocol.length === 0 ? PROXY_STATUS.INACTIVE : PROXY_STATUS.ACTIVE,
        lastCheck: Date.now(),
    };
}

async function concurrent<T>(
    tasks: (() => Promise<T>)[],
    limit: number,
    callback: (result: T) => void,
) {
    const running = new Set<Promise<void>>();

    for (const task of tasks) {
        // const past = performance.now();
        const p = Promise.resolve()
            .then(task)
            .then(callback)
            .finally(() => running.delete(p));

        running.add(p);

        if (running.size >= limit) await Promise.race(running);
        // if (performance.now() - past <= 100) {
        //     await new Promise((resolve) =>
        //         setTimeout(resolve, Math.max(0, 100 - (performance.now() - past))),
        //     );
        // }
    }
    await Promise.allSettled(running);
}

const proxies = await fetchProxy(SOURCE_URL);
logger.info(`获取到${proxies.length}条代理`);
store.addProxies(proxies);
try {
    await concurrent(
        proxies.map((p) => () => checkProxy(p)),
        CONCURRENCY,
        (res) => store.updateProxy(res),
    );
    logger.info(`检测完成`);
} finally {
    store.close();
}
