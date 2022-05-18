import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import GcodeToBufferGeometryWorkspace from './GcodeToBufferGeometry/GcodeToBufferGeometryWorkspace';

const gcodeToArraybufferGeometry = (data) => {
    return new Observable((observer) => {
        if (isEmpty(data)) {
            observer.next({ status: 'err', value: 'Data is empty' });
        }
        const { func, gcodeFilename, gcode, isPreview = false } = data;
        if (!['WORKSPACE'].includes(func.toUpperCase())) {
            observer.next({
                status: 'err',
                value: `Unsupported func: ${func}`,
            });
        }
        if (isEmpty(gcodeFilename) && isEmpty(gcode)) {
            observer.next({
                status: 'err',
                value: 'Gcode filename and gcode is empty',
            });
        }

        new GcodeToBufferGeometryWorkspace().parse(
            gcodeFilename,
            gcode,
            (result) => {
                const {
                    bufferGeometry,
                    renderMethod,
                    isDone,
                    boundingBox,
                } = result;
                const positions = bufferGeometry.getAttribute('position').array;
                const colors = bufferGeometry.getAttribute('a_color').array;
                const index = bufferGeometry.getAttribute('a_index').array;
                const indexColors = bufferGeometry.getAttribute('a_index_color')
                    .array;

                const _data = {
                    status: 'succeed',
                    isDone: isDone,
                    boundingBox: boundingBox,
                    renderMethod: renderMethod,
                    isPreview,
                    gcodeFilename,
                    value: {
                        positions,
                        colors,
                        index,
                        indexColors,
                    },
                };

                observer.next(_data, [
                    positions.buffer,
                    colors.buffer,
                    index.buffer,
                    indexColors.buffer,
                ]);
            },
            (progress) => {
                observer.next({
                    status: 'progress',
                    value: progress,
                    isPreview,
                });
            },
            (err) => {
                observer.next({ status: 'err', value: err });
            }
        );
    });
};

export default gcodeToArraybufferGeometry;
