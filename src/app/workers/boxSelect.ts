import { getOverlapSize, isInside } from 'overlap-area';
import sendMessage from './utils/sendMessage';

type TBbox = {
    x: number,
    y: number,
    width: number,
    height: number
}

const boxSelect = (bbox: TBbox, modelsBbox: TBbox[], onlyContainSelect: boolean) => {
    const selectBoxPoints = [
        [bbox.x + bbox.width, bbox.y + bbox.height],
        [bbox.x, bbox.y + bbox.height],
        [bbox.x, bbox.y],
        [bbox.x + bbox.width, bbox.y]
    ];

    const selectedIndex = [];
    modelsBbox.map((model, index) => {
        return { ...model, index };
    }).sort((a, b) => {
        return b.width + b.height - a.width - a.height;
    }).forEach(({ x, y, width, height, index }) => {
        if (width === 0) { width = 1; }
        if (height === 0) { height = 1; }
        const modelBoxPoints = [
            [x + width, y + height],
            [x, y + height],
            [x, y],
            [x + width, y]
        ];
        if (onlyContainSelect) {
            const res = modelBoxPoints.every(point => {
                return isInside(point, selectBoxPoints);
            });
            if (res) {
                selectedIndex.push(index);
            }
        } else {
            const overlapSize = getOverlapSize(selectBoxPoints, modelBoxPoints);
            if (overlapSize) {
                selectedIndex.push(index);
            }
        }
    });

    sendMessage(selectedIndex);
};

export default boxSelect;
