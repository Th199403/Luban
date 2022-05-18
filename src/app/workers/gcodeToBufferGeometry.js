import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import { gcodeToBufferGeometry as _gcodeToBufferGeometry } from './GcodeToBufferGeometry/index';

const gcodeToBufferGeometry = (message) => {
    return new Observable(async (observer) => {
        if (isEmpty(message)) {
            observer.next({ status: 'err', value: 'Data is empty' });
            return;
        }
        const { func, gcodeFilename, extruderColors } = message;
        if (!['3DP', 'LASER', 'CNC'].includes(func.toUpperCase())) {
            observer.next({
                status: 'err',
                value: `Unsupported func: ${func}`,
            });
            return;
        }
        if (isEmpty(gcodeFilename)) {
            observer.next({ status: 'err', value: 'Gcode filename is empty' });
            return;
        }

        const result = await _gcodeToBufferGeometry(
            func.toUpperCase(),
            gcodeFilename,
            extruderColors,
            (progress) => {
                observer.next({ status: 'progress', value: progress });
            },
            (err) => {
                observer.next({ status: 'err', value: err });
            }
        );
        const { bufferGeometry, layerCount, bounds, gcode } = result;
        const positions = bufferGeometry.getAttribute('position').array;
        const colors = bufferGeometry.getAttribute('a_color').array;
        const colors1 = bufferGeometry.getAttribute('a_color1').array;
        const layerIndices = bufferGeometry.getAttribute('a_layer_index').array;
        const typeCodes = bufferGeometry.getAttribute('a_type_code').array;
        const toolCodes = bufferGeometry.getAttribute('a_tool_code').array;
        const data = {
            status: 'succeed',
            value: {
                positions,
                colors,
                colors1,
                layerIndices,
                typeCodes,
                toolCodes,
                layerCount,
                bounds,
                gcode, // TODO: used gcode parser
            },
        };
        observer.next(data, [
            positions.buffer,
            colors.buffer,
            colors1.buffer,
            layerIndices.buffer,
            typeCodes.buffer,
            toolCodes.buffer,
        ]);
    });
};

export default gcodeToBufferGeometry;
