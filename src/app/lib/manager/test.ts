import { spawn, Thread, Worker } from 'threads';

const splitPath = async<T>(message: unknown, nextCallback: ((data: T) => void), completeCallback?: () => void) => {
    const workersHandle = await spawn(new Worker('./Pool.worker.js'));
    const subscribe = workersHandle.splitPath(message).subscribe({
        next: nextCallback,
        complete() {
            Thread.terminate(workersHandle);
            subscribe.unsubscribe();
            completeCallback && completeCallback();
        }
    });
};

export default splitPath;
