import { v4 as uuid } from 'uuid';
import { cloneDeep, debounce, noop } from 'lodash';
import svgPath from 'svgpath';
import { createSVGElement, setAttributes } from '../../element-utils';
import { MODE, THEME_COLOR, ATTACH_SPACE, POINT_RADIUS } from './constants';
import { TCoordinate } from './types';
import { EndPoint, ControlPoint } from './Point';
import Line, { TLineConfig } from './Line';
import OperationGroup from './OperationGroup';
import CursorGroup from './CursorGroup';
import workerManager from '../../../../lib/manager/workerManager';

export type TransformRecord = {
    fragmentID: number,
    points: TCoordinate[]
}

type TSplitPathResult = {
    points: { send: TCoordinate[][] },
    d: string,
    pointsElemStr: string
}

const manualEndOffset = 0.0000001;

class DrawGroup {
    public mode: MODE = MODE.NONE;

    private scale: number;
    private pointRadiusWithScale: number;

    private cursorGroup: CursorGroup;

    private cursorPosition: TCoordinate

    private operationGroup: OperationGroup;

    private container: SVGGElement;

    private endPointsGroup: SVGGElement;

    private drawedLine = new Map<number, Line>()

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

    // private guideLineVisibility: boolean;

    public updateScale = debounce(this._updateScale, 300)

    public constructor(contentGroup: SVGGElement, scale: number, drawableGroup: SVGGElement) {
        this.scale = scale;
        this.pointRadiusWithScale = Number((POINT_RADIUS / scale).toFixed(5));

        this.init();
        this.graph = drawableGroup;

        this.container = createSVGElement({
            element: 'g',
            attr: {
                id: 'draw-group-container'
            }
        });

        this.operationGroup = new OperationGroup(this.container, this.scale, this.pointRadiusWithScale);
        this.operationGroup.onDrawgraph = (points: Array<[number, number]>) => {
            const latestLine = this.getLatestDrawnLine();
            latestLine && latestLine.updatePosition([]);
            this.latestDrawingCompleted = true;
            this.drawgraph(points);
        };

        this.container.append(this.endPointsGroup);

        this.cursorGroup = new CursorGroup(this.scale, this.pointRadiusWithScale);
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

    public _updateScale(scale: number) { // just change the engineer scale
        if (scale === this.scale) {
            return;
        }
        this.scale = scale;
        this.attachSpace = ATTACH_SPACE / this.scale;
        this.pointRadiusWithScale = Number((POINT_RADIUS / scale).toFixed(5));

        this.cursorGroup.updateScale(this.scale, this.pointRadiusWithScale);
        this.operationGroup.updateScale(this.scale, this.pointRadiusWithScale);
        this.drawedLine.forEach((line) => line.updateScale(this.scale, this.pointRadiusWithScale));
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
        const line = this.appendLine({
            points,
            closedLoop
        });
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

    // private getPointCoordinate(point: SVGRectElement) {
    //     const x = point.getAttribute('x');
    //     const y = point.getAttribute('y');
    //     return { x: Number(x) + this.pointRadiusWithScale, y: Number(y) + this.pointRadiusWithScale };
    // }

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

    // draw
    public resetOperation(line?: Line) {
        this.operationGroup.clearOperation();
        if (!line) {
            line = this.getLatestDrawnLine();
        }
        if (line) {
            this.operationGroup.lastControlsArray = [];
            if (line.closedLoop) {
                this.operationGroup.controlsArray = [];
            } else {
                const lastPoint = line.points[line.points.length - 1];
                this.operationGroup.controlsArray = [
                    new EndPoint(lastPoint[0], lastPoint[1], null)
                ];
            }
            this.operationGroup.updatePrviewByCursor(new EndPoint(...this.cursorPosition, null));
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
        let now;
        workerManager.splitPath<TSplitPathResult>({
            path,
            transform: this.transformation ? this.originElem.getAttribute('transform') : '',
            scale: this.scale
        }, (res) => {
            this.drawedLine = new Map();

            now = new Date().getTime();
            // str += `<path fill="transparent" fill-opacity="0" stroke="black" stroke-width="0.4594017094017094" d="${res.d}"></path>`;
            // allEndPointStr += res.pointsElemStr;

            this.graph.innerHTML = res.d;
            this.endPointsGroup.innerHTML = res.pointsElemStr;

            console.log(`渲染耗时 ${new Date().getTime() - now}`);

            const childsElem = Array.from(this.graph.children) as unknown as SVGPathElement[];
            res.points.send.forEach((points, index) => {
                this.appendLine({
                    elem: childsElem[index],
                    points,
                    fragmentID: this.drawedLine.size,
                    scale: this.scale
                });
            });
            console.log(`构造耗时 ${new Date().getTime() - now}`);
        }, () => {
            // console.warn(`解析耗时 ${cost}, 一共${num}条, 平均 ${cost / num}`);
            // this.graph.innerHTML = str;
            // this.endPointsGroup.innerHTML = allEndPointStr;
            this.originElem.setAttribute('visibility', 'hidden');
        });
    }

    public appendLine(config: TLineConfig) {
        const line = new Line({
            ...config,
            scale: this.scale,
            pointRadiusWithScale: this.pointRadiusWithScale,
            endPointsGroup: this.endPointsGroup,
            group: this.graph,
            fragmentID: config.fragmentID || this.drawedLine.size,
        });
        this.drawedLine.set(line.fragmentID, line);
        return line;
    }

    private getLatestDrawnLine() {
        const fragmentIDs = Array.from(this.drawedLine.keys());
        const LatestFragmentID = fragmentIDs[fragmentIDs.length - 1];
        return this.drawedLine.get(LatestFragmentID);
    }

    private getEndPointfragmentIDs(elem: SVGRectElement) {
        if (!elem.dataset || !elem.dataset.fragmentids) {
            return [];
        }
        return elem.dataset.fragmentids.split(',').map(i => Number(i));
    }

    public delLine(line: Line) {
        line.del();
        this.drawedLine.delete(line.fragmentID);
        line.EndPointsEle.forEach((elem) => {
            const useful = this.getEndPointfragmentIDs(elem).some((id) => {
                return this.drawedLine.has(id);
            });
            if (!useful) {
                elem.remove();
            }
        });
    }

    public getLine(mark: SVGPathElement | SVGRectElement | number) {
        if (typeof mark === 'number') {
            return this.drawedLine.get(mark);
        }
        if (!mark) {
            return null;
        }
        if (mark instanceof SVGRectElement) {
            if (mark.parentNode === this.operationGroup.controlPoints) {
                // control point
                const fragmentID = Number(mark.getAttribute('fragmentid'));
                return this.getLine(fragmentID);
            } else {
                // end point
                const fragmentIDs = this.getEndPointfragmentIDs(mark);
                const fragmentID = fragmentIDs.find(id => this.drawedLine.has(id));
                return this.getLine(fragmentID);
            }
        } else if (mark instanceof SVGPathElement) {
            const fragmentID = Number(mark.getAttribute('fragmentid'));
            return this.getLine(fragmentID);
        }
        return null;
    }

    /**
     * Finds lines associated with the selected control points or selected lines
     */
    public getSelectedRelationLines(relationType?: 'point', elem?: SVGRectElement): Line[];
    public getSelectedRelationLines(relationType: 'line', line: Line): Line[];
    public getSelectedRelationLines(relationType = 'point', elem: unknown = this.selected.point): Line[] {
        if (relationType === 'point' && !elem) {
            return [];
        }
        if (relationType === 'point' && elem instanceof SVGRectElement) {
            if (elem === this.selected.point && elem.parentNode === this.operationGroup.controlPoints) {
                return [this.selected.line];
            }
            const fragmentIDs = this.getEndPointfragmentIDs(elem);

            return fragmentIDs.filter((id) => {
                return this.drawedLine.has(id);
            }).map((id) => {
                return this.drawedLine.get(id);
            });
        } else if (relationType === 'line' && elem instanceof Line) {
            return elem.EndPointsEle.reduce((prev, point) => {
                prev.push(...this.getSelectedRelationLines('point', point));
                return prev;
            }, []);
        }
        return [];
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
                deleteLines = this.getSelectedRelationLines().map((line) => {
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
                        this.preSelectPoint.setAttribute('fill', THEME_COLOR);
                        this.selected.pointIndex = null;
                        const elems = this.getSelectedRelationLines().reduce((p, c) => {
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
                const latestLine = this.getLatestDrawnLine();
                latestLine && latestLine.updatePosition([]);
            }
            this.redrawLatestLine = false;
            return;
        }
        if (this.mode === MODE.SELECT) {
            if (this.hasTransform) {
                this.hasTransform = false;
                let anotherEndpoint: SVGRectElement = null;
                const relationLines = this.getSelectedRelationLines();
                relationLines.some((line) => {
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
                this.getSelectedRelationLines('line', this.selected.line).forEach((line) => {
                    line.updatePosition([], true);
                });
                this.afterTransform = this.recordTransform();
                this.onDrawTransform({ before: this.beforeTransform, after: this.afterTransform });
            }
            this.setGuideLineVisibility(false);
        }
    }

    private setGuideLineVisibility(visible: boolean) {
        // if (visible === this.guideLineVisibility) {
        //     // Avoid repeated styling
        //     return;
        // }
        // this.guideLineVisibility = visible;
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
            line.endPoints.forEach((p, index) => {
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
                    const cx = Number(elem.getAttribute('x')) + this.pointRadiusWithScale;
                    const cy = Number(elem.getAttribute('y')) + this.pointRadiusWithScale;
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
                    p.endPoints[index][0] = x;
                    p.endPoints[index][1] = y;
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
                    const index = item.points.findIndex((p) => p === item.endPoints[circleIndex]);
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
        let nearest = this.attachSpace;
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
        nearest = this.attachSpace;
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
            this.operationGroup.updatePrviewByCursor(leftKeyPressed ? new ControlPoint(x, y, null) : new EndPoint(x, y, null));

            if (leftKeyPressed && this.drawedLine.size > 0) {
                if (this.operationGroup.controlsArray.length === 0 && this.latestDrawingCompleted) {
                    const latestLine = this.getLatestDrawnLine();
                    this.redrawLatestLine = true;
                    latestLine && latestLine.redrawCurve(x, y);
                } else if (
                    this.operationGroup.lastControlsArray.length > 0
                    && this.operationGroup.controlsArray[this.operationGroup.controlsArray.length - 1] instanceof EndPoint
                ) {
                    const latestLine = this.getLatestDrawnLine();
                    const latestPoint = latestLine.points[latestLine.points.length - 1];
                    if (latestPoint[0] === this.operationGroup.controlsArray[0].x && latestPoint[1] === this.operationGroup.controlsArray[0].y) {
                        this.redrawLatestLine = true;
                        latestLine && latestLine.redrawCurve(x, y);
                    }
                }
            }
        } else {
            if (leftKeyPressed && this.selected.line) {
                // const n = new Date().getTime();
                if (this.selected.line && this.selected.point) {
                    this.setGuideLineVisibility(true);
                    this.transformOperatingPoint([x, y]);
                    if (this.selected.pointIndex) {
                        // console.warn('move controls points');
                        this.operationGroup.updateOperation(this.selected.line.elem);
                    } else {
                        // const n2 = new Date().getTime();
                        // console.warn('move end points', n2 - n);
                        const elems = this.getSelectedRelationLines().map((line) => {
                            return line.elem;
                        });
                        // console.warn('find relation lines', new Date().getTime() - n2);
                        this.operationGroup.updateOperation(elems);
                    }
                } else if (this.selected.line) {
                    // console.warn('move line');
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
        if (this.drawedLine.size === 0) {
            return null;
        }
        let d = '';
        for (const [, line] of this.drawedLine.entries()) {
            d += line.generatePath(line.points);
            d += ' ';
        }

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
        this.drawedLine = new Map();
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
        this.drawedLine = new Map();
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

