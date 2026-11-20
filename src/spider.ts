import { request } from 'undici';
import type { ProxyAddress } from './store.js';

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

export async function fetchProxy(url: URL): Promise<ProxyAddress[]> {
    let proxies: string[];
    try {
        const resp = await request(url, { headers });
        if (resp.statusCode === 200) {
            const text = await resp.body.text();
            proxies = text.split('\n');
        } else {
            throw 'http error';
        }
    } catch (err) {
        throw err;
    }
    return proxies.map(parseProxy).filter((v): v is ProxyAddress => v !== null);
}

function parseProxy(proxy: string): ProxyAddress | null {
    const regex = /^((https?|socks5):\/\/)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})$/;
    const match = proxy.match(regex);
    if (!match) return null;
    return { ip: match[3]!, port: Number(match[4]) };
}
