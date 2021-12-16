const EvaluateSupportArea = require('../../workers/EvaluateSupportArea.worker.ts');

class WorkerManager {
    run(WorkerConstructor: any, transferData: Object, callback: (this: Worker, ev: MessageEvent<any>) => any) {
        const worker: Worker = new WorkerConstructor();
        worker.postMessage(transferData);
        worker.onmessage = callback;
        worker.onerror = () => {};
    }

    evaluateSupportArea(transferData: Object, callback: (this: Worker, ev: MessageEvent<any>) => any) {
        this.run(EvaluateSupportArea, transferData, callback);
    }
}

export default new WorkerManager();
