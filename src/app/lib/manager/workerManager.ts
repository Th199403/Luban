import { spawn, Thread, Worker } from 'threads';
import workerpool, { WorkerPool } from 'workerpool';
import './Pool.worker';
import './Pool0.worker';
// import '../../workers/test/scaleToFitWithRotate.worker.js';

export enum WorkerMethods {
    // LUBAN worker methods BEGIN
    arrangeModels = 'arrangeModels',
    autoRotateModels = 'autoRotateModels',
    boxSelect = 'boxSelect',
    evaluateSupportArea = 'evaluateSupportArea',
    gcodeToArraybufferGeometry = 'gcodeToArraybufferGeometry',
    gcodeToBufferGeometry = 'gcodeToBufferGeometry',
    loadModel = 'loadModel',
    scaleToFitWithRotate = 'scaleToFitWithRotate',
    toolpathRenderer = 'toolpathRenderer'
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: (data: unknown[], onmessage: (data: unknown) => void) => {
        terminate(): void;
    };
}

class WorkerManager {
    public pool: WorkerPool
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    console.log('method', method !== 'scaleToFitWithRotate', method, typeof method);
    // eslint-disable-next-line func-names
    if (method !== 'scaleToFitWithRotate' && method !== 'boxSelect') {
        WorkerManager.prototype[method] = function (data: any, onmessage?: (payload: unknown) => void) {
            const pool = (
                this.pool || (
                    this.pool = workerpool.pool('./Pool.worker.js', {
                        minWorkers: 'max',
                        workerType: 'web'
                    })
                )
            ) as WorkerPool;
            const handle = pool.exec(method, data, {
                on: (payload) => {
                    if (onmessage) {
                        onmessage(payload);
                    } else {
                        WorkerManager.prototype[method].onmessage(payload);
                    }
                },
            });
            return {
                terminate: () => {
                    handle.cancel();
                }
            };
        };
        console.log('1', WorkerManager.prototype[method]);
    } else {
        // eslint-disable-next-line
        WorkerManager.prototype[method] = async function (data: any, onmessage?: (payload: unknown) => void) {
            const counter = await spawn(new Worker('./Pool0.worker.js'));
            console.log('counter', method, counter[method]);
            if (counter[method]) {
                counter[method](data).subscribe(payload => {
                    if (onmessage) {
                        onmessage(payload);
                    }
                });
            }
            return {
                terminate: async () => {
                    await Thread.terminate(counter);
                }
            };
        };
    }
});

const manager = new WorkerManager() as unknown as IWorkerManager;

export default manager;
