import { spawn, Worker, Pool, Thread } from 'threads';
import './Pool.worker';

export enum WorkerMethods {
    // LUBAN worker methods BEGIN
    arrangeModels = 'arrangeModels',
    autoRotateModels = 'autoRotateModels',
    boxSelect = 'boxSelect',
    // evaluateSupportArea = 'evaluateSupportArea',
    gcodeToArraybufferGeometry = 'gcodeToArraybufferGeometry',
    gcodeToBufferGeometry = 'gcodeToBufferGeometry',
    loadModel = 'loadModel',
    scaleToFitWithRotate = 'scaleToFitWithRotate',
    splitPath = 'splitPath'
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: <T>(
        data: unknown,
        onMessage: (data: T) => void,
        onComplete?: () => void
    ) => Promise<{
        terminate(): void;
    }>;
};
type PayloadData = {
    status?: String;
    type?: String;
    value?: any;
};

class WorkerManager {
    private pool: Pool<Thread>;
    // private singleTasks = new Map<string, unknown>()

    public constructor() {
        this.getPool();
    }

    public getPool() {
        if (!this.pool) {
            this.pool = Pool(async () => spawn(new Worker('./Pool.worker.js'))) as unknown as Pool<Thread>;
        }
        return this.pool;
    }

    // public calculateSectionPoints() {

    // }
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function (data: any, onMessage?: (payload: unknown) => void, onComplete?: () => void) {
        // @ts-ignore
        window.pool = this.pool;
        const task = this.getPool().queue(eachPool => {
            const subscribe = eachPool[method](data).subscribe({
                next: (payload: PayloadData) => {
                    if (onMessage) {
                        onMessage(payload);
                    }
                },
                complete() {
                    subscribe.unsubscribe();
                    onComplete && onComplete();
                }
            });
        });
        return {
            terminate: () => {
                task.cancel();
            }
        };
    };
});

const manager = (new WorkerManager() as unknown) as IWorkerManager;

export default manager;
