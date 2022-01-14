import isEmpty from 'lodash/isEmpty';
import workerpool from 'workerpool';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';
// import api from '../api';

const onmessage = async (taskResult, indexStart) => {
    console.log('taskResult', workerpool, taskResult);
    if (isEmpty(taskResult.data)) {
        // postMessage({
        //     status: 'err',
        //     value: 'Data is empty'
        // });
        workerpool.workerEmit({
            status: 'err',
            value: 'Data is empty'
        });
        return;
    }
    const { headType } = taskResult;

    try {
        for (let i = 0; i < taskResult.data.length; i++) {
            const filename = taskResult.filenames[i];
            const renderResult = await new ToolpathToBufferGeometry().parse(
                filename,
                (progress) => {
                    // postMessage({
                    //     status: 'progress',
                    //     headType: headType,
                    //     value: {
                    //         progress: progress / taskResult.data.length + i / taskResult.data.length
                    //     }
                    // });
                    workerpool.workerEmit({
                        status: 'progress',
                        headType: headType,
                        value: {
                            progress: progress / taskResult.data.length + i / taskResult.data.length
                        }
                    });
                },
            );

            const data = {
                status: 'data',
                headType: headType,
                value: {
                    taskResult: taskResult,
                    index: i,
                    renderResult: renderResult
                }
            };

            // postMessage(
            //     data,
            //     [
            //         renderResult.positions.buffer,
            //         renderResult.gCodes.buffer
            //     ]
            // );
            workerpool.workerEmit(
                data,
                [
                    renderResult.positions.buffer,
                    renderResult.gCodes.buffer
                ]
            );
        }

        const data = {
            status: 'succeed',
            headType: headType,
            value: {
                indexStart: indexStart,
                taskResult: taskResult
            }
        };

        // postMessage(
        //     data
        // );
        workerpool.workerEmit(
            data
        );
    } catch (err) {
        // postMessage({
        //     status: 'err',
        //     headType: headType,
        //     value: err
        // });
        workerpool.workerEmit({
            status: 'err',
            headType: headType,
            value: err
        });
    }
};

workerpool.worker({
    onmessage: onmessage
});
