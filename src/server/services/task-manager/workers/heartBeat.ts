import request from 'superagent';
import sendMessage from '../utils/sendMessage';

type IParam = { token: string, host: string, stop?: boolean }

let errorCount = 0;
const screenTimeout = 8 * 1000;
let timeoutHandle = null;
let intervalHandle = null;

const stopBeat = (msg?: string, flag?: number) => {
    console.log(`offline flag=${flag}`);
    timeoutHandle = clearTimeout(timeoutHandle);
    intervalHandle = clearInterval(intervalHandle);
    sendMessage({ status: 'offline', msg });
};

const heartBeat = async (param: IParam) => {
    return new Promise((resolve) => {
        const { token, host, stop } = param;
        if (stop && intervalHandle) {
            resolve(stopBeat('', 1));
            return;
        }

        function beat() {
            const now = new Date();
            console.log(`>> [send beat]: time=${now.toLocaleTimeString()}`);
            const api = `${host}/api/v1/status?token=${token}&${now}`;
            request
                .get(api)
                .timeout(3000)
                .end((err: Error, res) => {
                    if (err) {
                        console.log(`<< [receive beat] ERROR: err=${err?.message}, cost=${new Date().getTime() - now.getTime()} ms.`);
                        if (err.message.includes('Timeout')) {
                            if (!timeoutHandle) {
                                timeoutHandle = setTimeout(() => {
                                    resolve(stopBeat(err.message, 2));
                                }, screenTimeout);
                            }
                        } else {
                            errorCount++;
                            if (errorCount >= 3) {
                                resolve(stopBeat(err.message, 3));
                            }
                        }
                    } else {
                        console.log(`<< [receive beat] SUCCESS: status=${res?.status}, cost=${new Date().getTime() - now.getTime()} ms.`);
                        timeoutHandle = clearTimeout(timeoutHandle);
                        errorCount = 0;
                        sendMessage({
                            status: 'online',
                            err,
                            res: {
                                text: res.text,
                                body: res.body,
                                status: res.status,
                            }
                        });
                    }
                });
        }
        if (intervalHandle) {
            return;
        }
        beat();
        intervalHandle = setInterval(beat, 1000);
    });
};

export default heartBeat;
