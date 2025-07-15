import config from 'config.json';
import loggerBuilder, { pino } from 'pino';

const start = new Date();

const transport = pino.transport({
    targets: [
        {
            level: config.logging || 'debug',
            target: 'pino-pretty',
            options: {
                colorize: false,
                destination: `logs/${start.getFullYear()}-${start.getMonth()}-${start.getDay()}-${start.getHours()}-${start.getMinutes()}.log`,
            },
        },
        {
            level: config.logging || 'debug',
            target: 'pino-pretty',
        },
    ]
});

export const logger = loggerBuilder(transport);