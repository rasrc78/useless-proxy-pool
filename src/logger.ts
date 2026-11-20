import pino from 'pino';

const GLOBAL_LOGGER = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });

export function getLogger(module: string, options?: pino.ChildLoggerOptions) {
    return GLOBAL_LOGGER.child({ module }, options);
}
