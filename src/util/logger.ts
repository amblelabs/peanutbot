import config from 'config.json';
import loggerBuilder from 'pino';
import pretty from 'pino-pretty';

export const logger = loggerBuilder({
    level: config.logging || 'debug',
}, pretty({}));