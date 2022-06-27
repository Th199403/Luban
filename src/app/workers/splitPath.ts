import { cloneDeep } from 'lodash';
import { Observable } from 'rxjs';
import svgPath from 'svgpath';
import { Transfer } from 'threads';
import { v4 as uuid } from 'uuid';
import { POINT_RADIUS, POINT_SIZE } from '../ui/SVGEditor/svg-content/DrawGroup/constants';

type TCoordinate = [number, number];

type TData = {
    transform?: string;
    path: string;
    scale: number;
};


const generatePath = (points: TCoordinate[]) => {
    const length = points.length;
    switch (length) {
        case 2:
            return `M ${points[0].join(' ')} L ${points[1].join(' ')} Z`;
        case 3:
            return `M ${points[0].join(' ')} Q ${points[1].join(' ')}, ${points[2].join(' ')}`;
        case 4:
            return `M ${points[0].join(' ')} C ${points[1].join(' ')}, ${points[2].join(' ')}, ${points[3].join(' ')}`;
        default:
            return '';
    }
};

const getCoordinatehash = (points: TCoordinate) => {
    return points[0] * 100000 + points[1] * 1000000;
};

const boxSelect = (data: TData) => {
    const pointRadiusWithScale = Number((POINT_RADIUS / data.scale).toFixed(5));
    const radius = POINT_SIZE / data.scale;
    const strokeWidth = 1 / data.scale;

    const now = new Date().getTime();
    let num = 0;
    let svgpath;
    let startPoint;

    let str = '';
    let pointsElemStr = '';
    const allPoints = [];
    let fragmentID = 0;

    const pointsMap = new Map<number, {
        fragmentIDS: [id: number, index: number][],
        coordinate: TCoordinate
    }>();
    return new Observable((observer) => {
        if (data.transform) {
            svgpath = svgPath(data.path).transform(data.transform);
        } else {
            svgpath = svgPath(data.path);
        }
        svgpath.abs().unarc().unshort().round(5)
            .iterate((segment, _, x, y) => {
                let arr = cloneDeep(segment) as unknown as number[];
                const mark = arr.shift().toString();
                if (mark.toUpperCase() !== 'M') {
                    if (mark === 'H') {
                        arr.push(y);
                    } else if (mark === 'V') {
                        arr.unshift(x);
                    } else if (mark.toUpperCase() === 'Z') {
                        arr = startPoint;
                    }
                    const points: TCoordinate[] = [];
                    for (let index = 0; index < arr.length; index += 2) {
                        points.push([
                            Number(arr[index]),
                            Number(arr[index + 1])
                        ]);
                    }
                    num++;

                    const pathPoints = [
                        [x, y],
                        ...points
                    ] as TCoordinate[];
                    const start = pathPoints[0];
                    const last = pathPoints[pathPoints.length - 1];
                    const startHash = getCoordinatehash(start);
                    const lastHash = getCoordinatehash(last);
                    if (startHash === lastHash) {
                        return;
                    }
                    if (!pointsMap.has(startHash)) {
                        pointsMap.set(startHash, {
                            fragmentIDS: [
                                [fragmentID, 0]
                            ],
                            coordinate: start
                        });
                    } else {
                        pointsMap.get(startHash).fragmentIDS.push([
                            fragmentID, 0
                        ]);
                    }
                    if (!pointsMap.has(lastHash)) {
                        pointsMap.set(lastHash, {
                            fragmentIDS: [
                                [fragmentID, 1]
                            ],
                            coordinate: last
                        });
                    } else {
                        pointsMap.get(lastHash).fragmentIDS.push([
                            fragmentID, 1
                        ]);
                    }
                    allPoints.push(pathPoints);
                    str += `<path fragmentID="${fragmentID}" fill="transparent" fill-opacity="0" stroke="black" stroke-width="${strokeWidth}" d="${generatePath(pathPoints)}"></path>`;

                    fragmentID++;
                } else {
                    startPoint = arr;
                }
            });
        const cost = new Date().getTime() - now;
        console.warn(`解析耗时 ${cost}, 一共${num}条, 平均 ${cost / num}`);


        for (const [, item] of pointsMap.entries()) {
            const coordinate = item.coordinate;
            const fragmentAttr = item.fragmentIDS.reduce((p, c) => {
                p += ` data-${c[0]}="${c[1]}"`;
                return p;
            }, '');

            pointsElemStr += `<rect ${fragmentAttr} fill="" fill-opacity="1" stroke="#1890ff" type="end-point" rx="${pointRadiusWithScale}" ry="${pointRadiusWithScale}" width="${radius}" height="${radius}" x="${coordinate[0] - pointRadiusWithScale}" cx="${coordinate[0]}" y="${coordinate[1] - pointRadiusWithScale}" cy="${coordinate[1]}" stroke-width="${strokeWidth}" pointer-events="all" id="${uuid()}" stroke-opacity="1"></rect>`;
        }

        observer.next({
            points: Transfer(allPoints as unknown as ArrayBuffer),
            d: str,
            pointsElemStr
        });

        observer.complete();
    });
};

export default boxSelect;
