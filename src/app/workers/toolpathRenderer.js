import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';

const toolpathRenderer = (taskResult) => {
    return new Observable(async (observer) => {
        if (isEmpty(taskResult.data)) {
            observer.next({
                status: 'err',
                value: 'Data is empty',
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
                        observer.next({
                            status: 'progress',
                            headType: headType,
                            value: {
                                progress:
                                    progress / taskResult.data.length
                                    + i / taskResult.data.length,
                            },
                        });
                    }
                );

                const data = {
                    status: 'data',
                    headType: headType,
                    value: {
                        taskResult: taskResult,
                        index: i,
                        renderResult: renderResult,
                    },
                };

                observer.next(data, [
                    renderResult.positions.buffer,
                    renderResult.gCodes.buffer,
                ]);
            }

            const data = {
                status: 'succeed',
                headType: headType,
                value: {
                    taskResult: taskResult,
                },
            };

            observer.next(data);
        } catch (err) {
            observer.next({
                status: 'err',
                headType: headType,
                value: err,
            });
        }
    });
};

export default toolpathRenderer;
