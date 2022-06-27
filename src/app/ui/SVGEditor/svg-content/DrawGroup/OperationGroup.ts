import { createSVGElement, setAttributes } from '../../element-utils';
import { MODE, MINIMUM_SPACING, POINT_SIZE, POINT_WEIGHT, THEME_COLOR } from './constants';
import { ControlPoint, EndPoint } from './Point';
import { TCoordinate } from './types';

class OperationGroup {
    public mode: MODE;

    public controlsArray: (ControlPoint | EndPoint)[] = [];

    public lastControlsArray: (ControlPoint | EndPoint)[] = [];

    public controlPoints: SVGGElement;

    public connectLines: SVGElement;

    private previewLine: SVGPathElement

    public onDrawgraph: (points: TCoordinate[]) => void;

    private scale: number;
    private pointRadiusWithScale: number;

    public constructor(container: SVGGElement, scale: number, pointRadiusWithScale: number) {
        this.scale = scale;
        this.pointRadiusWithScale = pointRadiusWithScale;

        this.connectLines = createSVGElement({
            element: 'g',
            attr: {
                id: 'connectLines'
            }
        });

        this.previewLine = createSVGElement({
            element: 'path',
            attr: {
                'stroke-width': POINT_WEIGHT / this.scale,
                id: 'previewLine',
                fill: 'transparent',
                stroke: THEME_COLOR
            }
        });

        this.controlPoints = createSVGElement({
            element: 'g',
            attr: {
                id: 'controlPoints'
            }
        });

        container.append(this.connectLines);
        container.append(this.previewLine);
        container.append(this.controlPoints);
    }

    private createLine(a: TCoordinate, b: TCoordinate) {
        return createSVGElement({
            element: 'path',
            attr: {
                'stroke-width': POINT_WEIGHT / this.scale,
                d: `M ${a.join(' ')} L ${b.join(' ')} Z`,
                fill: '',
                stroke: THEME_COLOR
            }
        });
    }

    private createPoint(point: ControlPoint | EndPoint): SVGRectElement {
        const attr = {
            fill: '',
            'fill-opacity': 1,
            width: POINT_SIZE / this.scale,
            height: POINT_SIZE / this.scale,
            x: point.x - (this.pointRadiusWithScale),
            y: point.y - (this.pointRadiusWithScale),
            stroke: THEME_COLOR,
            'stroke-width': POINT_WEIGHT / this.scale,
            rx: '0',
            ry: '0',
            'pointer-events': 'all',
            'is-controls': true
        };
        if (point instanceof EndPoint) {
            attr.rx = `${this.pointRadiusWithScale}`;
            attr.ry = `${this.pointRadiusWithScale}`;
        }
        return createSVGElement({
            element: 'rect',
            attr
        });
    }

    private renderCurve(curveData: [TCoordinate, TCoordinate, TCoordinate]) {
        const d = curveData.length === 3 ? `M ${curveData[0].join(' ')} Q ${curveData[1].join(' ')}, ${curveData[2].join(' ')}` : `M ${curveData[0].join(' ')} L ${curveData[1].join(' ')}`;
        this.previewLine.setAttribute('visibility', 'visible');
        this.previewLine.setAttribute('d', d);
    }

    private renderPoints(pointData: Array<ControlPoint | EndPoint>) {
        pointData.forEach((item, index) => {
            const elem = this.controlPoints.children[index];
            if (elem) {
                setAttributes(elem, {
                    fragmentid: `${item.fragmentID}`,
                    cx: `${item.x}`,
                    cy: `${item.y}`,
                    x: `${item.x - this.pointRadiusWithScale}`,
                    y: `${item.y - this.pointRadiusWithScale}`,
                    rx: item instanceof ControlPoint ? '0' : `${this.pointRadiusWithScale}`,
                    ry: item instanceof ControlPoint ? '0' : `${this.pointRadiusWithScale}`,
                    visibility: 'visible',
                });
            } else {
                this.controlPoints.append(this.createPoint(item));
            }
        });
        Array(this.controlPoints.childElementCount - pointData.length).fill('').forEach((_, index) => {
            setAttributes(this.controlPoints.children[this.controlPoints.childElementCount - index - 1], {
                visibility: 'hidden',
                x: 0,
                y: 0
            });
        });
    }

    private renderControlLines(lineEndPoints: Array<[TCoordinate, TCoordinate]>) {
        lineEndPoints.forEach((item, index) => {
            const elem = this.connectLines.children[index];
            if (elem) {
                setAttributes(elem, {
                    visibility: 'visible',
                    d: `M ${item[0].join(' ')} L ${item[1].join(' ')} Z`
                });
            } else {
                this.connectLines.append(this.createLine(item[0], item[1]));
            }
        });
        Array(this.connectLines.childElementCount - lineEndPoints.length).fill('').forEach((_, index) => {
            setAttributes(this.connectLines.children[this.connectLines.childElementCount - index - 1], {
                visibility: 'hidden',
                d: ''
            });
        });
    }

    private updateControlsLine(controlsArray: (ControlPoint | EndPoint)[], lastControlsArray?: (ControlPoint | EndPoint)[]) {
        if (controlsArray.length === 0) {
            return;
        }

        const pointData = [];
        const curveData = [] as unknown as [TCoordinate, TCoordinate, TCoordinate];
        const lineEndPoints = controlsArray.reduce((p, item, index) => {
            // render end points
            if (item instanceof EndPoint) {
                const circle = Array.from(document.querySelectorAll<SVGRectElement>('rect[type="end-point"]')).find((elem) => {
                    return elem.getAttribute('x') === `${item.x - this.pointRadiusWithScale}` && elem.getAttribute('y') === `${item.y - this.pointRadiusWithScale}`;
                });
                if (circle) {
                    item.fragmentID && circle.setAttribute('fragmentid', `${item.fragmentID}`);
                } else {
                    pointData.push(item);
                }
            } else {
                pointData.push(item);
            }

            if (this.mode === MODE.DRAW) {
                if (item instanceof ControlPoint) {
                    const a = controlsArray[index - 1];
                    const b = controlsArray[index + 1];
                    a && a instanceof EndPoint && b && b instanceof EndPoint && curveData.push([a.x, a.y], [item.x, item.y], [b.x, b.y]);
                } else {
                    const b = controlsArray[index + 1];
                    b && b instanceof EndPoint && curveData.push([item.x, item.y], [b.x, b.y]);
                }
            }

            // generate line's endpoints
            const next = controlsArray[index + 1];
            if (next && !(item instanceof ControlPoint && next instanceof ControlPoint) && !(item instanceof EndPoint && next instanceof EndPoint)) {
                p.push([
                    [item.x, item.y], [next.x, next.y]
                ]);
            }
            return p;
        }, []) as Array<[[number, number], [number, number]]>;

        lastControlsArray && lastControlsArray.forEach((item, index) => {
            // generate line's endpoints
            const next = lastControlsArray[index + 1];
            if (next && !(item instanceof ControlPoint && next instanceof ControlPoint) && !(item instanceof EndPoint && next instanceof EndPoint)) {
                lineEndPoints.push([
                    [item.x, item.y], [next.x, next.y]
                ]);
            }
            if (item instanceof ControlPoint) {
                pointData.push(item);
            }
        });

        this.renderControlLines(lineEndPoints);
        this.renderPoints(pointData);
        curveData.length > 0 && this.renderCurve(curveData);
    }

    private setControlsArray(point: EndPoint | ControlPoint) {
        if (this.controlsArray.length > 0 && point instanceof EndPoint) {
            // emit draw line
            this.onDrawgraph && this.onDrawgraph([...this.controlsArray, point].map((item) => {
                return [item.x, item.y];
            }));
            this.lastControlsArray = [...this.controlsArray, point];
            this.clearOperation();
            this.controlsArray = [point];
        } else {
            this.controlsArray.push(point);
        }

        this.updateControlsLine(this.controlsArray);
    }

    private parseLine(elem: SVGPathElement): Array<(EndPoint | ControlPoint)> {
        const fragmentID = Number(elem.getAttribute('fragmentid'));
        const controlsArray = [];
        const d = elem.getAttribute('d');
        const res: string[] = d.match(/\d+\.*\d*/g);
        const points: Array<TCoordinate> = [];
        if (res) {
            for (let index = 0; index < res.length; index += 2) {
                points.push([
                    Number(res[index]),
                    Number(res[index + 1])
                ]);
            }
        }
        points.forEach((item, index) => {
            if (index === 0 || index === points.length - 1) {
                controlsArray.push(new EndPoint(...item, fragmentID));
            } else {
                controlsArray.push(new ControlPoint(...item, fragmentID));
            }
        });
        return controlsArray;
    }

    public setControlPoint(x: number, y: number) {
        if (this.controlsArray.length === 0) {
            return;
        }
        const lasetEndPoint = this.controlsArray[this.controlsArray.length - 1];

        if (Math.sqrt((lasetEndPoint.x - x) ** 2 + (lasetEndPoint.y - y) ** 2) <= MINIMUM_SPACING) {
            return;
        }
        const point = new ControlPoint(x, y, null);

        this.setControlsArray(point);
    }

    public setEndPoint(x: number, y: number) {
        if (this.controlsArray.length > 0) {
            const lasetPoint = this.controlsArray[this.controlsArray.length - 1];
            if (lasetPoint instanceof ControlPoint) {
                if (Math.sqrt((lasetPoint.x - x) ** 2 + (lasetPoint.y - y) ** 2) <= MINIMUM_SPACING) {
                    return false;
                }
                const lasetEndPoint = this.controlsArray[this.controlsArray.length - 2];
                if (lasetEndPoint.x === x && lasetEndPoint.y === y) {
                    this.controlsArray = [];
                    this.clearOperation();
                    return false;
                }
            } else {
                if (lasetPoint.x === x && lasetPoint.y === y) {
                    this.controlsArray = [];
                    this.clearOperation();
                    return false;
                }
            }
        }
        const point = new EndPoint(x, y, null);

        this.setControlsArray(point);
        return true;
    }

    public updateOperation(elem: SVGPathElement | SVGPathElement[]) {
        if (Array.isArray(elem)) {
            const points = elem.map((item) => {
                return this.parseLine(item);
            }).reduce((p, c) => {
                p.push(...c);
                return p;
            }, []);
            // fragmentID
            this.updateControlsLine(points);
        } else {
            this.controlsArray = this.parseLine(elem);
            this.updateControlsLine(this.controlsArray);
        }
    }

    private calcSymmetryPoint([x, y]: TCoordinate, [x1, y1]: TCoordinate): TCoordinate {
        return [2 * x1 - x, 2 * y1 - y];
    }

    public updatePrviewByCursor(cursorPoint: ControlPoint | EndPoint) {
        if (this.controlsArray.length === 0 || this.mode !== MODE.DRAW) {
            return;
        }

        const lastControlsArray = [...this.lastControlsArray];
        if (cursorPoint instanceof ControlPoint && lastControlsArray.length > 0) {
            if (lastControlsArray.length === 2) {
                const p = this.calcSymmetryPoint([cursorPoint.x, cursorPoint.y], [lastControlsArray[1].x, lastControlsArray[1].y]);

                lastControlsArray.splice(1, 0, new ControlPoint(...p, null));
            } else {
                const p = this.calcSymmetryPoint([cursorPoint.x, cursorPoint.y], [lastControlsArray[2].x, lastControlsArray[2].y]);
                lastControlsArray.splice(2, 0, new ControlPoint(...p, null));
            }
            // const path = this.generatePath(points);
        } else {
            this.lastControlsArray = [];
        }
        this.updateControlsLine([...this.controlsArray, cursorPoint], lastControlsArray);
    }

    public clearOperation() {
        this.controlsArray = [];
        Array.from(this.controlPoints.children).forEach((elem) => {
            elem.setAttribute('visibility', 'hidden');
        });
        Array.from(this.connectLines.children).forEach((elem) => {
            elem.setAttribute('visibility', 'hidden');
        });
        this.previewLine.setAttribute('visibility', 'hidden');
    }

    public updateScale(scale: number, pointRadiusWithScale: number) { // just change the engineer scale
        this.scale = scale;
        this.pointRadiusWithScale = pointRadiusWithScale;

        Array.from(this.controlPoints.children).forEach((elem) => {
            elem.setAttribute('width', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('height', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('stroke-width', `${1 / this.scale}`);

            const rx = elem.getAttribute('rx');
            const ry = elem.getAttribute('ry');
            if (rx !== '0' && ry !== '0') {
                elem.setAttribute('rx', `${this.pointRadiusWithScale}`);
                elem.setAttribute('ry', `${this.pointRadiusWithScale}`);
            }
        });

        Array.from(this.connectLines.children).forEach((elem) => {
            elem.setAttribute('stroke-width', `${1 / this.scale}`);
        });

        this.previewLine.setAttribute('stroke-width', `${1 / this.scale}`);
    }
}

export default OperationGroup;
