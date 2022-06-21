import { v4 as uuid } from 'uuid';
import { cloneDeep, noop } from 'lodash';
import svgPath from 'svgpath';
import { createSVGElement, setAttributes } from '../../element-utils';
import { MODE, THEME_COLOR, ATTACH_SPACE, POINT_RADIUS } from './constants';
import { TCoordinate } from './types';
import { EndPoint, ControlPoint } from './Point';
import Line from './Line';
import OperationGroup from './OperationGroup';
import CursorGroup from './CursorGroup';

export type TransformRecord = {
    fragmentID: number,
    points: TCoordinate[]
}

const manualEndOffset = 0.0000001;

class DrawGroup {
    public mode: MODE = MODE.NONE;

    private scale: number;

    private cursorGroup: CursorGroup;

    private cursorPosition: TCoordinate

    private operationGroup: OperationGroup;

    private container: SVGGElement;

    private endPointsGroup: SVGGElement;

    private drawedLine: Line[] = []

    private graph: SVGGElement;

    private guideX: SVGLineElement

    private guideY: SVGLineElement

    public onDrawLine: (line: SVGPathElement, closedLoop: boolean) => void = noop;

    public onDrawDelete: (line: {
        points: TCoordinate[],
        closedLoop: boolean,
        fragmentID: number
    }[]) => void = noop;

    public onDrawTransform: (records: { before: TransformRecord[], after: TransformRecord[] }) => void = noop;

    public onDrawStart: (elem?: SVGPathElement) => void = noop;

    public onDrawComplete: (elem?: SVGPathElement) => void = noop;

    public onDrawTransformComplete: (records: { modelID: string, before: string, after: string }) => void = noop;

    private selected: {
        line?: Line,
        point?: SVGRectElement,
        pointIndex?: Number
    } = {};

    private preSelectLine: Line;

    private preSelectPoint: SVGRectElement;

    private hasTransform: boolean;

    private beforeTransform: TransformRecord[] = []

    private afterTransform: TransformRecord[] = []

    private attachSpace: number;

    private redrawLatestLine: boolean;

    private latestDrawingCompleted: boolean = false;

    private isAttached: boolean;

    private originElem: SVGPathElement;
    private originPath: string;
    private modelID: string;

    public constructor(contentGroup: SVGGElement, scale: number, drawableGroup: SVGGElement) {
        this.scale = scale;
        this.init();
        this.graph = drawableGroup;

        this.container = createSVGElement({
            element: 'g',
            attr: {
                id: 'draw-group-container'
            }
        });

        this.operationGroup = new OperationGroup(this.container, this.scale);
        this.operationGroup.onDrawgraph = (points: Array<[number, number]>) => {
            const latestLine = this.drawedLine[this.drawedLine.length - 1];
            latestLine && latestLine.updatePosition([]);
            this.latestDrawingCompleted = true;
            this.drawgraph(points);
        };

        this.container.append(this.endPointsGroup);

        this.cursorGroup = new CursorGroup(this.scale);
        this.container.append(this.cursorGroup.group);

        this.container.append(this.guideX);
        this.container.append(this.guideY);

        contentGroup.parentElement.append(this.container);
    }

    public stopDraw(forcedStop: boolean = false) {
        if (this.mode === MODE.NONE) {
            return null;
        }
        this.cursorGroup.toogleVisible(false);
        this.setGuideLineVisibility(false);
        this.operationGroup.clearOperation();
        this.operationGroup.lastControlsArray = [];

        this.clearAllEndPoint();
        this.clearDrawedLine();

        if (forcedStop) {
            if (this.originElem) {
                this.originElem.setAttribute('visibility', 'visible');
                this.originElem = null;
            }
            this.mode = MODE.NONE;
            this.clearDrawedLine();

            return null;
        } else {
            if (this.mode === MODE.DRAW) {
                return this.drawComplete();
            } else if (this.mode === MODE.SELECT) {
                return this.transformComplete();
            }
            return null;
        }
    }

    public updateScale(scale: number) { // just change the engineer scale
        this.scale = scale;
        this.attachSpace = ATTACH_SPACE / this.scale;

        this.cursorGroup.updateScale(this.scale);
        this.operationGroup.updateScale(this.scale);
        this.drawedLine.forEach((line) => line.updateScale(this.scale));
        this.guideX.setAttribute('stroke-width', `${1 / this.scale}`);
        this.guideY.setAttribute('stroke-width', `${1 / this.scale}`);
    }

    private init() {
        this.guideX = createSVGElement({
            element: 'line',
            attr: {
                visibility: 'hidden',
                id: 'guideX',
                stroke: 'red'
            }
        });

        this.guideY = createSVGElement({
            element: 'line',
            attr: {
                visibility: 'hidden',
                id: 'guideY',
                stroke: 'red'
            }
        });
        this.endPointsGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'endPointsGroup'
            }
        });
    }

    private drawgraph(points: Array<[number, number]>) {
        const closedLoop = this.cursorGroup.isAttached();
        const line = this.appendLine(points, closedLoop);
        if (line) {
            this.unSelectAllPoint();
            this.endPointsGroup.lastElementChild.setAttribute('fill', THEME_COLOR);
            this.onDrawLine && this.onDrawLine(line.elem, closedLoop);
        }
    }

    public deleteLine(line: SVGPathElement) {
        if (line) {
            return this.delLine(this.getLine(line));
        }
        return null;
    }

    private getPointCoordinate(point: SVGRectElement) {
        const x = point.getAttribute('x');
        const y = point.getAttribute('y');
        return { x: Number(x) + POINT_RADIUS / this.scale, y: Number(y) + POINT_RADIUS / this.scale };
    }

    private setMode(mode: MODE) {
        this.mode = mode;

        this.cursorGroup.setAttachPoint();
        this.unSelectAllPoint();
        this.clearDrawedLine();

        this.operationGroup.mode = mode;
        this.cursorGroup.mode = mode;
        this.operationGroup.clearOperation();
    }

    private get transformation() {
        const transform = this.originElem.transform;
        if (!transform) {
            return null;
        }
        const transformList = transform.baseVal;
        if (transformList.length === 0) {
            return null;
        }

        const scaleX = transformList.getItem(2).matrix.a;
        const scaleY = transformList.getItem(2).matrix.d;
        const angle = transformList.getItem(1).angle;
        return { scaleX, scaleY, angle };
    }

    public startDraw(mode: MODE, elem: SVGPathElement) {
        this.setMode(mode);
        this.clearDrawedLine();


        // 用户区分是编辑还是创建

        if (elem) {
            this.originElem = elem;
            this.modelID = this.originElem?.getAttribute('id');
            this.originElem.setAttribute('visibility', 'hidden');
            this.originPath = elem.getAttribute('d');
            this.generatelines(this.originPath);
        } else {
            this.originPath = '';
            this.originElem = null;
            this.modelID = `id${uuid()}`;
            this.graph.setAttribute('id', this.modelID);
        }
        if (mode !== MODE.NONE) {
            this.onDrawStart && this.onDrawStart(this.originElem);
        }
        this.cursorGroup.toogleVisible(this.mode === MODE.DRAW);
    }

    public resetOperationByselect() {
        this.resetOperation(this.selected.line);
    }

    public resetOperation(line?: Line) {
        this.operationGroup.clearOperation();
        if (!line) {
            line = this.drawedLine[this.drawedLine.length - 1];
        }
        if (line) {
            this.operationGroup.lastControlsArray = [];
            if (line.closedLoop) {
                this.operationGroup.controlsArray = [];
            } else {
                const lastPoint = line.points[line.points.length - 1];
                this.operationGroup.controlsArray = [
                    new EndPoint(lastPoint[0], lastPoint[1])
                ];
            }
            this.operationGroup.updatePrviewByCursor(new EndPoint(...this.cursorPosition));
        }
    }

    private applyTransform(d: string, restore?: boolean) {
        if (!this.transformation) {
            return svgPath(d);
        }

        if (restore) {
            const { scaleX, scaleY, angle } = this.transformation;
            const { x, y, width, height } = this.originElem.getBBox();
            const cx = x + width / 2;
            const cy = y + height / 2;

            return svgPath(d)
                .translate(-cx, -cy)
                .rotate(-angle)
                .scale(1 / scaleX, 1 / scaleY)
                .translate(cx, cy);
        } else {
            const transform = this.originElem.getAttribute('transform');
            return svgPath(d).transform(transform);
        }
    }

    private generatelines(path: string) {
        this.drawedLine = [];
        // const path = paths.join(' ');
        // let preLinePoints = [];
        const svgpath = this.applyTransform(path);

        let startPoint;
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
                    this.appendLine([
                        [x, y],
                        ...points
                    ]);
                    // return;
                } else {
                    startPoint = arr;
                }
                // preLinePoints = arr;
            });
    }

    public appendLine(data: TCoordinate[] | SVGPathElement, closedLoop: boolean = false, fragmentID?: number) {
        if (Array.isArray(data)) {
            const last = data[data.length - 1];
            if (data[0][0] === last[0] && data[0][1] === last[1]) {
                return null;
            }
        }
        const line = new Line(data, this.scale, closedLoop, fragmentID || this.drawedLine.length);
        this.drawedLine.splice(line.fragmentID, 0, line);

        this.endPointsGroup.append(...line.EndPointsEle);
        if (!Array.from(this.graph.childNodes).find((elem) => elem === line.elem)) {
            this.graph.appendChild(line.elem);
        }
        return line;
    }

    public delLine(line: Line) {
        line.del();
        this.drawedLine = this.drawedLine.filter((item) => item !== line);
        line.EndPointsEle.filter((elem) => {
            const flag = this.drawedLine.some((item) => item.EndPointsEle.includes(elem));
            return !flag;
        }).forEach((elem) => elem.remove());
    }

    public getLineByPoint(point: SVGRectElement) {
        const { x, y } = this.getPointCoordinate(point);
        return this.drawedLine.find((item) => {
            return item.points.some((p) => p[0] === x && p[1] === y);
        });
    }

    public getLine(mark: SVGPathElement | SVGRectElement | number) {
        if (typeof mark === 'number') {
            return this.drawedLine.find((line) => line.fragmentID === mark);
        }
        return this.drawedLine.find((item) => {
            if (mark instanceof SVGPathElement) {
                return item.elem === mark;
            } else if (mark instanceof SVGRectElement) {
                const { x, y } = this.getPointCoordinate(mark);
                return item.points.some((p) => p[0] === x && p[1] === y);
            } else {
                return false;
            }
        });
    }



    public onDelete() {
        if (this.selected.line) {
            let deleteLines;
            if (this.selected.pointIndex) {
                this.delLine(this.selected.line);
                deleteLines = [{
                    fragmentID: this.selected.line.fragmentID,
                    points: this.selected.line.points,
                    closedLoop: this.selected.line.closedLoop
                }];
            } else if (this.selected.point) {
                deleteLines = this.drawedLine.filter((line) => {
                    return line.EndPointsEle.findIndex((elem) => elem === this.selected.point) !== -1;
                }).map((line) => {
                    this.delLine(line);
                    return {
                        fragmentID: line.fragmentID,
                        points: line.points,
                        closedLoop: line.closedLoop
                    };
                });
            } else if (this.selected.line) {
                this.delLine(this.selected.line);
                deleteLines = [{
                    fragmentID: this.selected.line.fragmentID,
                    points: this.selected.line.points,
                    closedLoop: this.selected.line.closedLoop
                }];
            }
            this.operationGroup.clearOperation();
            return deleteLines;
        }
        return [];
    }

    public onMouseDown() {
        const [x, y] = this.cursorPosition;
        this.unSelectAllPoint();
        this.clearAllConnectLine();

        if (this.mode === MODE.DRAW) {
            this.latestDrawingCompleted = false;
            if (this.cursorGroup.isAttached() && this.operationGroup.controlsArray.length > 0) {
                const success = this.operationGroup.setEndPoint(x, y);
                if (success) {
                    this.isAttached = true;
                }
            } else {
                this.isAttached = false;
                this.operationGroup.setEndPoint(x, y);
            }
            this.cursorGroup.keyDown();
            return;
        }
        if (this.mode === MODE.SELECT) {
            this.selected.line && this.selected.line.elem.setAttribute('stroke', 'black');
            this.selected.point && this.selected.point.setAttribute('fill', '');
            if (this.preSelectPoint) {
                const parent = this.preSelectPoint.parentElement as unknown as SVGGElement;
                this.preSelectPoint.setAttribute('fill', THEME_COLOR);
                this.selected.line = this.getLine(this.preSelectPoint);
                if (this.selected.line) {
                    this.selected.point = this.preSelectPoint;
                    if (parent === this.operationGroup.controlPoints) {
                        const cx = this.preSelectPoint.getAttribute('x');
                        const cy = this.preSelectPoint.getAttribute('y');
                        this.operationGroup.updateOperation(this.selected.line.elem);

                        this.selected.pointIndex = Array.from(this.operationGroup.controlPoints.children).findIndex((elem) => {
                            if (elem.getAttribute('x') === cx && elem.getAttribute('y') === cy) {
                                elem.setAttribute('fill', THEME_COLOR);
                                return true;
                            } else {
                                return false;
                            }
                        }) + 1;
                        this.operationGroup.updateOperation(this.selected.line.elem);
                    } else {
                        this.selected.pointIndex = null;
                        const elems = this.drawedLine.filter((line) => {
                            return line.EndPointsEle.includes(this.preSelectPoint as SVGRectElement);
                        }).reduce((p, c) => {
                            p.push(c.elem);
                            return p;
                        }, []);
                        this.operationGroup.updateOperation(elems);
                    }

                    this.beforeTransform = this.recordTransform();
                }
                return;
            }
            if (this.preSelectLine) {
                this.preSelectLine.elem.setAttribute('stroke', THEME_COLOR);
                this.preSelectLine.elem.setAttribute('stroke-opacity', '1');

                this.operationGroup.updateOperation(this.preSelectLine.elem);
                this.selected.line = this.preSelectLine;
                this.selected.pointIndex = null;
                this.selected.point = null;
                this.beforeTransform = this.recordTransform();
                return;
            }
            this.selected.line = null;
            this.selected.point = null;
            this.selected.pointIndex = null;
        }
        this.operationGroup.clearOperation();
    }

    public updateAllLinePosition() {
        this.drawedLine.forEach((item) => item.updatePosition([], true));
        this.drawedLine.forEach((item) => this.endPointsGroup.append(...item.EndPointsEle));
    }

    public onMouseUp(event: MouseEvent, cx: number, cy: number) {
        if (event.button === 2) {
            // Do not handle right-click events
            return;
        }
        if (this.mode === MODE.DRAW) {
            this.operationGroup.lastControlsArray = [];
            if (this.isAttached) {
                // this.operationGroup.controlsArray = [];
                this.operationGroup.clearOperation();
            }
            const { x, y, attached } = this.attachCursor(cx, cy);
            if (attached) {
                this.cursorGroup.setAttachPoint(x, y);
            } else {
                this.cursorGroup.setAttachPoint();
            }
            this.cursorGroup.update(false, x, y);
            const lng = this.operationGroup.controlsArray.length;
            if (lng > 0) {
                if (this.operationGroup.controlsArray[lng - 1] instanceof EndPoint) {
                    this.operationGroup.setControlPoint(...this.cursorPosition);
                }
            }
            if (this.redrawLatestLine) {
                const latestLine = this.drawedLine[this.drawedLine.length - 1];
                latestLine && latestLine.updatePosition([]);
            }
            this.redrawLatestLine = false;
            return;
        }
        if (this.mode === MODE.SELECT) {
            if (this.hasTransform) {
                this.hasTransform = false;
                let anotherEndpoint: SVGRectElement = null;
                this.drawedLine.filter((line) => {
                    return line.EndPointsEle.includes(this.selected.point);
                }).some((line) => {
                    const isEndpointCoincidence = line.isEndpointCoincidence();
                    if (isEndpointCoincidence) {
                        anotherEndpoint = line.EndPointsEle.find((elem) => elem !== this.selected.point);
                        return true;
                    }
                    return false;
                });
                if (anotherEndpoint) {
                    this.selected.pointIndex = null;
                    this.selected.point = anotherEndpoint;
                    const x = Number(anotherEndpoint.getAttribute('cx'));
                    const y = Number(anotherEndpoint.getAttribute('cy'));
                    this.transformOperatingPoint([x + manualEndOffset, y + manualEndOffset]);
                }
                this.updateAllLinePosition();
                this.afterTransform = this.recordTransform();
                this.onDrawTransform({ before: this.beforeTransform, after: this.afterTransform });
            }
            this.setGuideLineVisibility(false);
        }
    }

    private setGuideLineVisibility(visible: boolean) {
        if (!visible) {
            setAttributes(this.guideX, {
                x1: 0, y1: 0, x2: 0, y2: 0
            });
            setAttributes(this.guideY, {
                x1: 0, y1: 0, x2: 0, y2: 0
            });
        }
        this.guideX.setAttribute('visibility', visible ? 'visible' : 'hidden');
        this.guideY.setAttribute('visibility', visible ? 'visible' : 'hidden');
    }

    private attachCursor(x: number, y: number): { x: number, y: number, attached: boolean } {
        this.setGuideLineVisibility(false);
        let min: number = this.attachSpace;
        let attachPosition: TCoordinate;
        let guideX: TCoordinate;
        let guideY: TCoordinate;
        this.drawedLine.forEach((line) => {
            const selfIndex = line.EndPointsEle.findIndex((elem) => elem === this.selected.point);
            line.EndPoins.forEach((p, index) => {
                if (selfIndex !== -1 && selfIndex === index) {
                    return;
                }
                if (Math.abs(x - p[0]) <= this.attachSpace || Math.abs(y - p[1]) <= this.attachSpace) {
                    if (Math.abs(x - p[0]) <= this.attachSpace) {
                        guideX = p;
                    }
                    if (Math.abs(y - p[1]) <= this.attachSpace) {
                        guideY = p;
                    }
                    if (Math.abs(x - p[0]) <= this.attachSpace && Math.abs(y - p[1]) <= this.attachSpace) {
                        if ((Math.abs(x - p[0]) < min || Math.abs(y - p[1]) < min)) {
                            attachPosition = p;
                            min = Math.min(Math.abs(x - p[0]), Math.abs(y - p[1]));
                        }
                    }
                }
            });
        });

        if (this.mode === MODE.DRAW) {
            const controlPoints = this.operationGroup.controlPoints.querySelectorAll('[visibility="visible"]');
            const length = controlPoints.length;
            if (length > 1) {
                Array.from(controlPoints).forEach((elem, index) => {
                    if (length === 2 && (index === 1 || elem.getAttribute('rx') === '0')) {
                        return;
                    } else if (length === 3 && index !== 1) {
                        return;
                    }
                    const cx = Number(elem.getAttribute('x')) + POINT_RADIUS / this.scale;
                    const cy = Number(elem.getAttribute('y')) + POINT_RADIUS / this.scale;
                    if (Math.abs(x - cx) <= this.attachSpace) {
                        guideX = [cx, cy];
                    }
                    if (Math.abs(y - cy) <= this.attachSpace) {
                        guideY = [cx, cy];
                    }
                    if (Math.abs(x - cx) <= this.attachSpace && Math.abs(y - cy) <= this.attachSpace) {
                        if ((Math.abs(x - cx) < min || Math.abs(y - cy) < min)) {
                            attachPosition = [cx, cy];
                            min = Math.min(Math.abs(x - cx), Math.abs(y - cy));
                        }
                    }
                });
            }
        }

        if (attachPosition) {
            return { x: attachPosition[0], y: attachPosition[1], attached: true };
        }

        if (guideX || guideY) {
            if (guideX && guideY) {
                this.guideX.setAttribute('x1', `${guideX[0]}`);
                this.guideX.setAttribute('y1', `${guideY[1]}`);
                this.guideX.setAttribute('x2', `${guideX[0]}`);
                this.guideX.setAttribute('y2', `${guideX[1]}`);

                this.guideY.setAttribute('x1', `${guideX[0]}`);
                this.guideY.setAttribute('y1', `${guideY[1]}`);
                this.guideY.setAttribute('x2', `${guideY[0]}`);
                this.guideY.setAttribute('y2', `${guideY[1]}`);

                return { x: guideX[0], y: guideY[1], attached: false };
            }
            if (guideX) {
                this.guideX.setAttribute('visibility', 'visible');
                this.guideX.setAttribute('x1', `${guideX[0]}`);
                this.guideX.setAttribute('y1', `${y}`);
                this.guideX.setAttribute('x2', `${guideX[0]}`);
                this.guideX.setAttribute('y2', `${guideX[1]}`);
                return { x: guideX[0], y, attached: false };
            }
            if (guideY) {
                this.guideY.setAttribute('visibility', 'visible');
                this.guideY.setAttribute('x1', `${x}`);
                this.guideY.setAttribute('y1', `${guideY[1]}`);
                this.guideY.setAttribute('x2', `${guideY[0]}`);
                this.guideY.setAttribute('y2', `${guideY[1]}`);
                return { x, y: guideY[1], attached: false };
            }
        }
        return { x, y, attached: false };
    }

    private transformOperatingPoint([x, y]: TCoordinate) {
        this.hasTransform = true;
        if (typeof this.selected.pointIndex === 'number') {
            this.selected.line.points[this.selected.pointIndex][0] = x;
            this.selected.line.points[this.selected.pointIndex][1] = y;
            this.selected.line.updatePosition(this.selected.line.points);
        } else {
            this.drawedLine.forEach((p) => {
                const index = p.EndPointsEle.findIndex((elem) => elem === this.selected.point);
                if (index !== -1) {
                    p.EndPoins[index][0] = x;
                    p.EndPoins[index][1] = y;
                    p.updatePosition(p.points);
                }
            });
        }
    }

    private queryLink(line: SVGPathElement) {
        const selectedLine = this.getLine(line);
        const links = new Map<Line, { line: Line, indexs: number[], fragmentID: number }>();
        this.drawedLine.forEach((item) => {
            if (item.elem === line) {
                links.set(item, {
                    indexs: Array(item.points.length).fill(0).map((_, index) => index),
                    line: item,
                    fragmentID: item.fragmentID
                });
            } else {
                const circleEles = item.EndPointsEle;
                selectedLine.EndPointsEle.forEach((circle) => {
                    const circleIndex = circleEles.findIndex((i) => circle === i);
                    const index = item.points.findIndex((p) => p === item.EndPoins[circleIndex]);
                    if (index !== -1) {
                        const has = links.get(item);
                        if (has) {
                            has.indexs.push(index);
                        } else {
                            links.set(item, {
                                indexs: [index],
                                line: item,
                                fragmentID: item.fragmentID
                            });
                        }
                    }
                });
            }
        });
        return Array.from(links.values());
    }

    private transformLine(dx: number, dy: number) {
        this.hasTransform = true;

        this.queryLink(this.selected.line.elem).forEach((item) => {
            const _points = cloneDeep(item.line.points);

            item.indexs.forEach((index) => {
                _points[index][0] += dx;
                _points[index][1] += dy;
            });
            item.line.updatePosition(_points);
        });
    }

    private renderPreviewElem(x: number, y: number) {
        let nearest = ATTACH_SPACE / 4;
        let nearestLine: Line;
        let nearestPoint: SVGRectElement;
        this.drawedLine.forEach((line) => {
            const d = line.distanceDetection(x, y);
            if (!(line === this.selected.line && !this.selected.point)) {
                line.elem.setAttribute('stroke', 'black');
                line.elem.setAttribute('stroke-opacity', '1');
            }
            if (d < nearest) {
                nearest = d;
                nearestLine = line;
            }
        });
        nearest = ATTACH_SPACE;
        (Array.from(this.endPointsGroup.children) as unknown[] as SVGRectElement[]).forEach((elem) => {
            const pointX = Number(elem.getAttribute('x'));
            const pointY = Number(elem.getAttribute('y'));
            const space = Math.sqrt((pointX - x) ** 2 + (pointY - y) ** 2);
            elem.setAttribute('stroke', THEME_COLOR);
            elem.setAttribute('stroke-opacity', '1');
            if (space < nearest) {
                if (Math.abs(space - nearest) <= manualEndOffset * 2) {
                    if (Number(nearestPoint.getAttribute('cx')) - Number(elem.getAttribute('cx')) > 0) {
                        nearestPoint = elem;
                    }
                    nearest = space;
                } else {
                    nearest = space;
                    nearestPoint = elem;
                }
            }
        });
        Array.from(this.operationGroup.controlPoints.querySelectorAll<SVGRectElement>('[visibility="visible"]')).forEach((elem) => {
            const pointX = Number(elem.getAttribute('x'));
            const pointY = Number(elem.getAttribute('y'));
            const space = Math.sqrt((pointX - x) ** 2 + (pointY - y) ** 2);
            elem.setAttribute('stroke', THEME_COLOR);
            elem.setAttribute('stroke-opacity', '1');
            if (space < nearest) {
                nearest = space;
                nearestPoint = elem;
            }
        });
        if (nearestPoint) {
            nearestPoint.setAttribute('stroke-opacity', '0.5');
            nearestPoint.setAttribute('stroke', THEME_COLOR);
            this.preSelectPoint = nearestPoint;
        } else {
            this.preSelectPoint = null;
            if (nearestLine) {
                this.preSelectLine = nearestLine;
                if (this.selected.point || nearestLine !== this.selected.line) {
                    nearestLine.elem.setAttribute('stroke-opacity', '0.5');
                    nearestLine.elem.setAttribute('stroke', THEME_COLOR);
                }
            } else {
                this.preSelectLine = null;
            }
        }
    }

    public onMouseMove(event: MouseEvent, [cx, cy]: [number, number], [dx, dy]: [number, number]) {
        if (this.mode === MODE.NONE) {
            return;
        }
        let leftKeyPressed = event.which === 1;

        const { x, y, attached } = this.attachCursor(cx, cy);
        if (attached) {
            if (this.mode === MODE.SELECT) {
                if (leftKeyPressed && this.selected.point) {
                    this.cursorGroup.setAttachPoint(x, y);
                }
            } else {
                this.cursorGroup.setAttachPoint(x, y);
            }
        } else {
            this.cursorGroup.setAttachPoint();
        }
        // const x = cx;
        // const y = cy;
        this.cursorPosition = [x, y];

        if (this.mode === MODE.DRAW) {
            this.setGuideLineVisibility(true);
            if (leftKeyPressed && !this.latestDrawingCompleted && (
                this.operationGroup.lastControlsArray.length === 0 && this.operationGroup.controlsArray.length === 0
            )) {
                this.operationGroup.setEndPoint(x, y);
            }

            if (leftKeyPressed && this.operationGroup.controlsArray[this.operationGroup.controlsArray.length - 1] instanceof ControlPoint) {
                leftKeyPressed = false;
            }
            this.cursorGroup.update(leftKeyPressed, x, y);
            this.operationGroup.updatePrviewByCursor(leftKeyPressed ? new ControlPoint(x, y) : new EndPoint(x, y));
            if (leftKeyPressed && this.drawedLine.length > 0) {
                if (this.operationGroup.controlsArray.length === 0 && this.latestDrawingCompleted) {
                    const latestLine = this.drawedLine[this.drawedLine.length - 1];
                    this.redrawLatestLine = true;
                    latestLine && latestLine.redrawCurve(x, y);
                } else if (
                    this.operationGroup.lastControlsArray.length > 0
                    && this.operationGroup.controlsArray[this.operationGroup.controlsArray.length - 1] instanceof EndPoint
                ) {
                    const latestLine = this.drawedLine[this.drawedLine.length - 1];
                    const latestPoint = latestLine.points[latestLine.points.length - 1];
                    if (latestPoint[0] === this.operationGroup.controlsArray[0].x && latestPoint[1] === this.operationGroup.controlsArray[0].y) {
                        this.redrawLatestLine = true;
                        latestLine && latestLine.redrawCurve(x, y);
                    }
                }
            }
        } else {
            if (leftKeyPressed) {
                if (this.selected.line && this.selected.point) {
                    // move controls points
                    this.setGuideLineVisibility(true);
                    this.transformOperatingPoint([x, y]);
                    if (this.selected.pointIndex) {
                        this.operationGroup.updateOperation(this.selected.line.elem);
                    } else {
                        const elems = this.drawedLine.filter((line) => {
                            return line.EndPointsEle.includes(this.selected.point as SVGRectElement);
                        }).reduce((p, c) => {
                            p.push(c.elem);
                            return p;
                        }, []);
                        this.operationGroup.updateOperation(elems);
                    }
                } else if (this.selected.line) {
                    // move line
                    this.setGuideLineVisibility(true);
                    this.transformLine(dx, dy);
                    this.operationGroup.updateOperation(this.selected.line.elem);
                }
            } else {
                this.setGuideLineVisibility(false);
                this.renderPreviewElem(x, y);
            }
        }
    }

    public onMouseleave() {
        this.mode === MODE.DRAW && this.cursorGroup.toogleVisible(false);
    }

    public onMouseenter() {
        this.mode === MODE.DRAW && this.cursorGroup.toogleVisible(true);
    }

    private generatePath() {
        if (this.drawedLine.length === 0) {
            return null;
        }
        let d = this.drawedLine.reduce((p, c) => {
            p += c.generatePath(c.points);
            p += ' ';
            return p;
        }, '');

        if (this.originElem) {
            const res = this.applyTransform(d, true).round(5).rel();
            d = res.toString();
        }

        return d;
    }

    private drawComplete() {
        if (this.mode !== MODE.DRAW) {
            return null;
        }
        this.setMode(MODE.NONE);
        const path = this.generatePath();
        this.drawedLine = [];
        if (path) {
            if (this.originElem && this.onDrawTransformComplete) {
                this.originElem.setAttribute('d', path);
                this.originElem.setAttribute('visibility', 'visible');
                this.onDrawTransformComplete({
                    modelID: this.modelID,
                    before: this.originPath,
                    after: path
                });
            } else if (!this.originElem && this.onDrawComplete) {
                const temp = createSVGElement({
                    element: 'path',
                    attr: {
                        id: this.modelID,
                        'stroke-width': 1 / this.scale,
                        d: path,
                        fill: 'transparent',
                        stroke: '#000',
                        preset: 'true'
                    }
                }) as SVGPathElement;
                this.container.append(temp);
                this.onDrawComplete(temp);
            }
            return this.modelID;
        } else {
            if (this.onDrawComplete) {
                this.onDrawComplete();
            }
        }
        return null;
    }

    private transformComplete() {
        if (this.mode !== MODE.SELECT) {
            return null;
        }
        this.setMode(MODE.NONE);

        const path = this.generatePath();
        this.drawedLine = [];
        if (path) {
            if (this.originElem) {
                this.originElem.setAttribute('d', path);
                this.originElem.setAttribute('visibility', 'visible');
            }
            // 判断是否有编辑
            if (this.onDrawTransformComplete) {
                this.onDrawTransformComplete({
                    modelID: this.modelID,
                    before: this.originPath,
                    after: path,
                });
            }
        } else {
            if (this.onDrawTransformComplete) {
                this.onDrawTransformComplete({
                    modelID: this.modelID,
                    before: this.originPath,
                    after: '',
                });
            }
        }
        return this.modelID;
    }


    private recordTransform() {
        const pointRecords: TransformRecord[] = [];
        if (this.selected.pointIndex) {
            pointRecords.push({
                fragmentID: this.selected.line.fragmentID,
                points: cloneDeep(this.selected.line.points)
            });
        } else if (this.selected.point) {
            this.drawedLine.forEach((p) => {
                const index = p.EndPointsEle.findIndex((elem) => elem === this.selected.point);
                if (index !== -1) {
                    pointRecords.push({
                        fragmentID: p.fragmentID,
                        points: cloneDeep(p.points)
                    });
                }
            });
        } else if (this.selected.line) {
            this.queryLink(this.selected.line.elem).forEach((item) => {
                pointRecords.push({
                    fragmentID: item.fragmentID,
                    points: cloneDeep(item.line.points)
                });
            });
        }
        return pointRecords;
    }

    private clearAllEndPoint() {
        Array.from(this.endPointsGroup.children).forEach((p) => {
            p.remove();
        });
    }

    private clearDrawedLine() {
        Array.from(this.graph.children).forEach((item) => {
            item.remove();
        });
    }

    private unSelectAllPoint() {
        Array.from(this.endPointsGroup.children).forEach((p) => {
            p.setAttribute('fill', '');
        });
        Array.from(this.operationGroup.controlPoints.children).forEach((p) => {
            p.setAttribute('fill', '');
        });
    }

    private clearAllConnectLine() {
        Array.from(this.operationGroup.connectLines.children).forEach((p) => {
            p.setAttribute('visibility', 'hidden');
        });
    }
}

export default DrawGroup;

