import { expose } from 'threads/worker';

const methods = require.context('../../workers', false, /\.(t|j)s/).keys()
    .reduce((prev, key) => {
        key = key.replace('./', '');
        const [name] = key.split('.');
        if (name === 'scaleToFitWithRotate' || name === 'boxSelect') {
            // eslint-disable-next-line import/no-dynamic-require
            prev[name] = require(`../../workers/${key}`).default;
        }
        return prev;
    }, {});
console.log('methods', methods);
expose(methods);
