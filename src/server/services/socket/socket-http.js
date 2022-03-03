// import store from '../../store';
import request from 'superagent';
import logger from '../../lib/logger';
import workerManager from '../task-manager/workerManager';
import { HEAD_PRINTING, HEAD_LASER, HEAD_CNC } from '../../constants';

const log = logger('lib:SocketHttp');


const isJSON = (str) => {
    if (typeof str === 'string') {
        try {
            const obj = JSON.parse(str);
            if (typeof obj === 'object' && obj) {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    return false;
};

const _getResult = (err, res) => {
    if (err) {
        if (res && isJSON(res.text) && JSON.parse(res.text).code === 202) {
            return {
                msg: err.message,
                code: 202,
                text: res && res.text,
                data: res && res.body
            };
        } else if (res && isJSON(res.text) && JSON.parse(res.text).code === 203) {
            return {
                msg: err.message,
                code: 203,
                text: res && res.text,
                data: res && res.body
            };
        } else {
            return {
                msg: err.message,
                code: res && res.status,
                text: res && res.text,
                data: res && res.body
            };
        }
    }
    const code = res.status;
    if (code !== 200 && code !== 204 && code !== 203) {
        return {
            code,
            msg: res && res.text
        };
    }
    return {
        code,
        msg: '',
        data: res.body,
        text: res.text
    };
};

/**
 * A singleton to manage devices connection.
 */
class SocketHttp {
    isGcodeExecuting = false;

    gcodeInfos = [];

    socket = null;

    host='';

    token='';

    heartBeatWorker= null;

    connectionOpen = (socket, options) => {
        const { host, token } = options;
        this.host = host;
        this.token = token;
        this.socket = socket;
        log.debug(`wifi host="${this.host}" : token=${this.token}`);
        const api = `${this.host}/api/v1/connect`;
        request
            .post(api)
            .timeout(3000)
            .send(token ? `token=${this.token}` : '')
            .end((err, res) => {
                console.log('res', res.body);
                this.socket && this.socket.emit('connection:open', _getResult(err, res));
            });
    };

    connectionClose = () => {
        const api = `${this.host}/api/v1/disconnect`;
        request
            .post(api)
            .timeout(3000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                console.log('connectionClose inside', this.socket, _getResult(err, res));
                this.socket && this.socket.emit('connection:close', _getResult(err, res));
            });
        this.host = '';
        this.token = '';
        this.heartBeatWorker && this.heartBeatWorker.terminate();
        console.log('connectionClose');
    };

    startGcode = () => {
        const api = `${this.host}/api/v1/start_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit('connection:startGcode', _getResult(err, res));
            });
    }

    resumeGcode = () => {
        const api = `${this.host}/api/v1/resume_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit('connection:resumeGcode', _getResult(err, res));
            });
    };

    pauseGcode = () => {
        const api = `${this.host}/api/v1/pause_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit('connection:pauseGcode', _getResult(err, res));
            });
    };

    stopGcode = () => {
        const api = `${this.host}/api/v1/stop_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit('connection:stopGcode', _getResult(err, res));
            });
    };

    executeGcode = (options, callback) => {
        const { gcode } = options;
        const split = gcode.split('\n');
        this.gcodeInfos.push({
            gcodes: split
        });
        this.startExecuteGcode(callback);
    };

    startExecuteGcode = async (callback) => {
        if (this.isGcodeExecuting) {
            return;
        }
        this.isGcodeExecuting = true;
        while (this.gcodeInfos.length > 0) {
            const splice = this.gcodeInfos.splice(0, 1)[0];
            const result = [];
            for (const gcode of splice.gcodes) {
                const { text } = await this._executeGcode(gcode);
                result.push(gcode);
                if (text) {
                    result.push(text);
                }
            }
            callback && callback();
            this.socket && this.socket.emit('connection:executeGcode', result);
        }
        this.isGcodeExecuting = false;
    };

    _executeGcode = (gcode) => {
        const api = `${this.host}/api/v1/execute_code`;
        return new Promise((resolve) => {
            const req = request.post(api);
            req.timeout(300000)
                .send(`token=${this.token}`)
                .send(`code=${gcode}`)
                // .send(formData)
                .end((err, res) => {
                    const { data, text } = _getResult(err, res);
                    resolve({ data, text });
                });
        });
    };

    startHeartbeat = (options) => {
        const { eventName } = options;
        this.heartBeatWorker = workerManager.heartBeat([{
            host: this.host,
            token: this.token
        }], (result) => {
            this.socket && this.socket.emit(eventName, result);
        });
    }

    uploadGcodeFile = (filename, file, type, callback) => {
        const api = `${this.host}/api/v1/prepare_print`;
        if (type === HEAD_PRINTING) {
            type = '3DP';
        } else if (type === HEAD_LASER) {
            type = 'Laser';
        } else if (type === HEAD_CNC) {
            type = 'CNC';
        }
        request
            .post(api)
            .field('token', this.token)
            .field('type', type)
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data } = _getResult(err, res);
                if (callback) {
                    callback(msg, data);
                }
            });
    };
}

const socketHttp = new SocketHttp();

export default socketHttp;
