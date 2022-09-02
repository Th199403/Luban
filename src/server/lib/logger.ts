import log4js, { configure } from 'log4js';
import { join } from 'path';
import mkdirp from 'mkdirp';

mkdirp.sync(global.luban.userDataDir, './Logs');

const fileConfigs = (fileName) => {
    return {
        type: 'dateFile',
        filename: process.env.NODE_ENV === 'development' ? join(process.cwd(), `../../logs/${fileName}.log`) : join(global.luban.userDataDir, `./Logs/${fileName}.log`),
        pattern: '.yyyy-MM-dd',
        alwaysIncludePattern: false,
        numBackups: 7,
        keepFileExt: true
    };
};

// log4js.levels.addLevels({
//     get: {
//         value: 25000, colour: 'LightBlue'
//     }
// });

configure({
    appenders: {
        // log: {
        //     type: 'console'
        // },
        console: {
            type: 'console',

            // type: 'logLevelFilter',
            // appender: 'log',
            // isLessThanOrEqualTo: 'ERROR',
            // maxLevel: 'ERROR'

        },
        DAILYFILE: fileConfigs('luban'),
        heartBeat: {
            category: 'heartBeat',
            ...fileConfigs('heartBeat')
        },
        errorFile: fileConfigs('errors'),
        errors: {
            type: 'logLevelFilter',
            level: 'ERROR',
            appender: 'errorFile'
        }
    },
    categories: {
        default: {
            appenders: [
                'DAILYFILE',
                'console',
                'errors'
            ],
            level: 'DEBUG'
        },
        heartBeat: { appenders: ['heartBeat'], level: 'DEBUG' },
        http: { appenders: ['DAILYFILE'], level: 'debug' },
    }
});

const logger = (namespace) => {
    return log4js.getLogger(namespace);
};

export default logger;
