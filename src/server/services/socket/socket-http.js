// import store from '../../store';
import request from 'superagent';
import logger from '../../lib/logger';

const log = logger('service:socket-http');

const connectionOpen = (socket, options) => {
    const { host, token } = options;
    log.debug(`wifi host="${host}" : token=${token}`);
    const api = `${host}/api/v1/connect`;
    request
        .post(api)
        .timeout(3000)
        .send(token ? `token=${token}` : '')
        .end((err, res) => {
            console.log('res', res.body);
            socket.emit('connection:open', { err, res, body: res.body });
        });
};

const connectionClose = (socket, options) => {
    const { host, token } = options;
    console.log('connectionClose', options);
    const api = `${host}/api/v1/disconnect`;
    request
        .post(api)
        .timeout(3000)
        .send(`token=${token}`)
        .end((err, res) => {
            socket.emit('connection:close', { err, res, body: res.body });
        });
};

export default {
    connectionOpen,
    connectionClose
};
