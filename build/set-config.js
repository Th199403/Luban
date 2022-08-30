#!/usr/bin/env node

const yargsParser = require('yargs-parser');
const path = require('path');
const fs = require('fs');

const argv = yargsParser(process.argv);

console.log('=========>>>>>>>>>> set sentry config', argv);

// 215015e98aa849898cf4a0f6b11833aa69b1ebd11b7441c29794ad530d7b707b
// 'https://88ea58fb276d4229a1b72333e88dba34@o1378322.ingest.sentry.io/6690121'
const config = {
    auth: {
        token: argv.SentryToken,
        dsn: argv.SentryDsn
    },
    defaults: {
        org: 'dohard-6h',
        project: 'snapmaker-luban'
    },
    release: argv.RELEASE
};

const target = path.resolve(__dirname, '../.sentry.config.json');
const content = JSON.stringify(config, null, 4);
fs.writeFileSync(target, `${content}\n`, 'utf8');
