import { spawn, Thread, Worker } from 'threads';
import './Pool.worker';

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
    toolpathRenderer = 'toolpathRenderer',
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: (
        data: unknown[],
        onmessage: (data: unknown) => void
    ) => {
        terminate(): void;
    };
};
type PayloadData = {
    status?: String;
    type?: String;
    value?: any;
};

class WorkerManager {
    public pool;
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function (
        data: any,
        onmessage?: (payload: unknown) => void | Promise<unknown>
    ) {
        const pool = this.pool
            || (this.pool = await spawn(new Worker('./Pool.worker.js')));
        console.log('pool', method, pool[method], pool);
        if (pool[method]) {
            pool[method](data).subscribe((payload: PayloadData) => {
                if (onmessage) {
                    onmessage(payload);
                }
            });
        }
        return {
            terminate: async () => {
                const res = await Thread.terminate(pool);
                console.log('res', res);
                this.pool = null;
            },
        };
    };
});

const manager = (new WorkerManager() as unknown) as IWorkerManager;

export default manager;
