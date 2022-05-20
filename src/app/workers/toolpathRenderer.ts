import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import ToolpathToBufferGeometry from './GcodeToBufferGeometry/ToolpathToBufferGeometry';

type ToolpathRendererData = {
    data: any;
    filenames: string[];
    taskId: string;
    headType: string;
};
const toolpathRenderer = (taskResult: ToolpathRendererData) => {
    return new Observable((observer) => {
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
                new ToolpathToBufferGeometry().parse(
                    filename,
                    (renderResult) => {
                        const data = {
                            status: 'data',
                            headType: headType,
                            value: {
                                taskResult: taskResult,
                                index: i,
                                renderResult: renderResult,
                            },
                        };

                        observer.next(data);
                    },
                    (progress: number) => {
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
