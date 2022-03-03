import { readFile } from 'fs';
import logger from '../../lib/logger';
// import workerManager from '../task-manager/workerManager';
import socketSerial from './socket-serial';
import socketHttp from './socket-http';
import { HEAD_PRINTING, HEAD_LASER, LEVEL_TWO_POWER_LASER_FOR_SM2, MACHINE_SERIES,
    CONNECTION_TYPE_WIFI, WORKFLOW_STATE_PAUSED } from '../../constants';
import DataStorage from '../../DataStorage';

const log = logger('lib:ConnectionManager');
const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

/**
 * A singleton to manage devices connection.
 */
class ConnectionManager {
    socket = null;

    connectionType = CONNECTION_TYPE_WIFI;

    protocol = '';

    connectionOpen = (socket, options) => {
        const { connectionType } = options;
        this.connectionType = connectionType;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            this.socket = socketHttp;
            this.socket.connectionOpen(socket, options);
        } else {
            this.socket = socketSerial;
            this.socket.serialportOpen(socket, options);
        }
        log.debug(`connectionOpen connectionType=${connectionType} this.socket=${this.socket}`);
    };

    connectionClose = (socket) => {
        this.socket.connectionClose(socket);
    };

    startGcode = (socket, options) => {
        const { headType, isRotate, toolHead, isLaserPrintAutoMode, materialThickness } = options;
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            const { gcodeFile, series, laserFocalLength, background, size, workPosition, originOffset } = options;
            const gcodeFilePath = `${DataStorage.tmpDir}/${gcodeFile.uploadName}`;
            readFile(gcodeFilePath, (err, res) => {
                if (err) {
                    log.error(`get file err, err=${err}`);
                    return;
                }
                const file = res;
                const promises = [];
                if (series !== MACHINE_SERIES.ORIGINAL.value && series !== MACHINE_SERIES.CUSTOM.value && headType === HEAD_LASER && !isRotate) {
                    if (laserFocalLength) {
                        const promise = new Promise((resolve) => {
                            if (isLaserPrintAutoMode) {
                                this.socket.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                    resolve();
                                });
                            } else {
                                if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                                    this.socket.executeGcode({ gcode: `G0 Z${materialThickness} F1500;` }, () => {
                                        resolve();
                                    });
                                } else {
                                    this.socket.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
                                        resolve();
                                    });
                                }
                            }
                        });
                        promises.push(promise);
                    }

                    // Camera Aid Background mode, force machine to work on machine coordinates (Origin = 0,0)
                    if (background.enabled) {
                        let x = parseFloat(workPosition.x) - parseFloat(originOffset.x);
                        let y = parseFloat(workPosition.y) - parseFloat(originOffset.y);

                        // Fix bug for x or y out of range
                        x = Math.max(0, Math.min(x, size.x - 20));
                        y = Math.max(0, Math.min(y, size.y - 20));

                        const promise = new Promise((resolve) => {
                            this.socket.executeGcode({ gcode: `G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};` }, () => {
                                resolve();
                            });
                        });
                        promises.push(promise);
                    }
                }
                Promise.all(promises)
                    .then(() => {
                        this.socket.uploadGcodeFile(gcodeFile.name, file, headType, (msg) => {
                            if (msg) {
                                return;
                            }
                            this.socket.startGcode();
                        });
                    });
            });
        } else {
            const { workflowState } = options;
            console.log('this.socket', this.socket, socket, workflowState);
            if (headType === HEAD_LASER && workflowState !== WORKFLOW_STATE_PAUSED) {
                this.socket.command(this.socket, {
                    args: ['G0 X0 Y0 F1000']
                });
                if (!isRotate) {
                    if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                        this.socket.command(this.socket, {
                            args: [`G0 Z${(isLaserPrintAutoMode ? 0 : materialThickness)} F1000`]
                        });
                    } else {
                        this.socket.command(this.socket, {
                            args: [`G0 Z${(isLaserPrintAutoMode ? materialThickness : 0)} F1000`]
                        });
                    }
                }
            }
            this.socket.command(this.socket, {
                cmd: 'gcode:start',
            });
        }
    }

    resumeGcode = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.resumeGcode();
        } else {
            const { headType, pause3dpStatus, pauseStatus } = options;
            if (headType === HEAD_PRINTING) {
                const pos = pause3dpStatus.pos;
                const code = `G1 X${pos.x} Y${pos.y} Z${pos.z} F1000\n`;
                this.socket.command(this.socket, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.socket.command(this.socket, {
                    cmd: 'gcode:resume',
                });
            } else if (headType === HEAD_LASER) {
                if (pauseStatus.headStatus) {
                    // resume laser power
                    const powerPercent = ensureRange(pauseStatus.headPower, 0, 100);
                    const powerStrength = Math.floor(powerPercent * 255 / 100);
                    const code = powerPercent !== 0 ? `M3 P${powerPercent} S${powerStrength}`
                        : 'M3';
                    this.socket.command(this.socket, {
                        cmd: 'gcode',
                        args: [code]
                    });
                }

                this.socket.command(this.socket, {
                    cmd: 'gcode:resume',
                });
            } else {
                if (pauseStatus.headStatus) {
                    // resume spindle
                    this.socket.command(this.socket, {
                        cmd: 'gcode',
                        args: ['M3']
                    });

                    // for CNC machine, resume need to wait >500ms to let the tool head started
                    setTimeout(() => {
                        this.socket.command(this.socket, {
                            cmd: 'gcode:resume',
                        });
                    }, 1000);
                } else {
                    this.socket.command(this.socket, {
                        cmd: 'gcode:resume',
                    });
                }
            }
        }
    };

    pauseGcode = () => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.pauseGcode();
        } else {
            this.socket.command(this.socket, {
                cmd: 'gcode:pause',
            });
        }
    };

    stopGcode = () => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.stopGcode();
        } else {
            this.socket.command(this.socket, {
                cmd: 'gcode:stop',
            });
        }
    };

    // when using executeGcode, the cmd param is always 'gcode'
    executeGcode = (socket, options, callback) => {
        const { gcode, context, cmd = 'gcode' } = options;
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.executeGcode(options, callback);
        } else {
            this.socket.command(this.socket, {
                cmd: cmd,
                args: [gcode, context]
            });
        }
    };


    startHeartbeat = (socket, options) => {
        this.socket.startHeartbeat(options);
    }
}

const connectionManager = new ConnectionManager();

export default connectionManager;
