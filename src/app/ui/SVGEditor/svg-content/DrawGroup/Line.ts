import { Bezier } from 'bezier-js';
import { v4 as uuid } from 'uuid';
import { createSVGElement } from '../../element-utils';
import { POINT_SIZE, THEME_COLOR, MINIMUM_SPACING } from './constants';
import { TCoordinate } from './types';

export type TLineConfig = {
    points?: TCoordinate[],
    elem?: SVGPathElement,
    scale?: number;
    pointRadiusWithScale?: number;
    closedLoop?: boolean,
    fragmentID?: string,
    endPointsGroup?: SVGGElement;
    group?: SVGGElement;
}

class Line {
    public points: TCoordinate[];

    public endPoints: TCoordinate[];

    public elem: SVGPathElement;

    public closedLoop: boolean;

    public fragmentID: string;

    private scale: number;
    private pointRadiusWithScale: number;

    private model: Bezier;

    private group: SVGGElement;
    private endPointsGroup: SVGGElement;

    public constructor(config: TLineConfig) {
        this.endPointsGroup = config.endPointsGroup;
        this.group = config.group;

        this.scale = config.scale;
        this.pointRadiusWithScale = config.pointRadiusWithScale;
        this.closedLoop = config.closedLoop || false;
        this.fragmentID = config.fragmentID;

        this.points = config.points;
        this.elem = config.elem;

        if (this.elem && !this.points) {
            this.elem = this.elem;
            this.points = this.parsePoints();
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            if (!this.elem.parentElement) {
                this.group.appendChild(this.elem);
                this.generateEndPointEle();
            }
        } else if (!this.elem && this.points) {
            const path = this.generatePath(this.points);
            const line = createSVGElement({
                element: 'path',
                attr: {
                    'stroke-width': 1 / this.scale,
                    d: path,
                    fill: 'transparent',
                    stroke: 'black',
                    fragmentid: this.fragmentID
                }
            }) as SVGPathElement;
            this.group.appendChild(line);
            this.elem = line;
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            this.generateEndPointEle();
        } else if (this.elem && this.points) {
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
        }

        setTimeout(() => {
            this.updateModel(this.points);
        }, 200);
    }

    private updateModel(points: TCoordinate[]) {
        const params = points.map((item) => {
            return {
                x: item[0],
                y: item[1]
            };
        }, []);
        this.model = new Bezier(params);
    }

    public updatePosition(points?: TCoordinate[], applyMerge?: boolean) {
        if (points && points.length > 0) {
            this.elem.setAttribute('d', this.generatePath(points));
        }
        this.updateEndPointEle(points, applyMerge);
    }

    private parsePoints() {
        const d = this.elem.getAttribute('d');
        const res: string[] = d.match(/\d+\.*\d*/g);
        const points: Array<[number, number]> = [];
        if (res) {
            for (let index = 0; index < res.length; index += 2) {
                points.push([
                    Number(res[index]),
                    Number(res[index + 1])
                ]);
            }
        }
        return points;
    }

    private updateEndPointEle(points?: TCoordinate[], applyMerge?: boolean) {
        if (points && points.length > 0) {
            const endPoints = points ? [
                points[0],
                points[points.length - 1]
            ] : this.endPoints;

            const endPointsEles = this.getEndPointEles();
            if (endPointsEles.length < 2) {
                return;
            }

            endPoints.forEach((item, index) => {
                const x = item[0];
                const y = item[1];
                if (applyMerge) {
                    const circle = this.endPointsGroup.querySelector<SVGRectElement>(`rect[type="end-point"][cx="${x}"][cy="${y}"]:not([fill=""])`) || this.endPointsGroup.querySelector<SVGRectElement>(`rect[type="end-point"][cx="${x}"][cy="${y}"]`);
                    if (circle) {
                        if (circle !== endPointsEles[index]) {
                            endPointsEles[index].remove();
                            endPointsEles[index] = circle;
                        }
                        return;
                    } else {
                        endPointsEles[index] = this.createCircle(item, index);
                        return;
                    }
                }
                endPointsEles[index].setAttribute('x', `${x - this.pointRadiusWithScale}`);
                endPointsEles[index].setAttribute('y', `${y - this.pointRadiusWithScale}`);
                endPointsEles[index].setAttribute('cx', `${x}`);
                endPointsEles[index].setAttribute('cy', `${y}`);
            });
        } else {
            const _points = this.parsePoints();
            this.points = _points;
            this.endPoints = [
                this.points[0],
                this.points[this.points.length - 1]
            ];
            this.updateModel(_points);
            this.updateEndPointEle(_points, applyMerge);
        }
    }

    public generatePath(points: TCoordinate[]) {
        const length = points.length;
        switch (length) {
            case 2:
                return `M ${points[0].join(' ')} L ${points[1].join(' ')}`;
            case 3:
                return `M ${points[0].join(' ')} Q ${points[1].join(' ')}, ${points[2].join(' ')}`;
            case 4:
                return `M ${points[0].join(' ')} C ${points[1].join(' ')}, ${points[2].join(' ')}, ${points[3].join(' ')}`;
            default:
                return '';
        }
    }

    public getEndPointEles() {
        return [
            this.endPointsGroup.querySelector<SVGRectElement>(`[data-${this.fragmentID}="0"]`),
            this.endPointsGroup.querySelector<SVGRectElement>(`[data-${this.fragmentID}="1"]`)
        ];
    }

    public generateEndPointEle() {
        this.endPoints.forEach((item, index) => {
            if (!item || !item[0]) {
                return;
            }
            let circle = this.endPointsGroup.querySelector<SVGRectElement>(`rect[type="end-point"][x="${item[0] - this.pointRadiusWithScale}"][y="${item[1] - this.pointRadiusWithScale}"]`);
            if (!circle) {
                circle = this.createCircle(item, index);
            } else {
                circle.dataset[`${this.fragmentID}`] = `${index}`;
            }
        });
    }

    private createCircle([x, y]: TCoordinate, index: number) {
        const elem = createSVGElement({
            element: 'rect',
            attr: {
                type: 'end-point',
                fill: '',
                'fill-opacity': 1,
                rx: `${this.pointRadiusWithScale}`,
                ry: `${this.pointRadiusWithScale}`,
                width: POINT_SIZE / this.scale,
                height: POINT_SIZE / this.scale,
                x: x - this.pointRadiusWithScale,
                cx: x,
                y: y - this.pointRadiusWithScale,
                cy: y,
                stroke: THEME_COLOR,
                'stroke-width': 1 / this.scale,
                'pointer-events': 'all',
                id: uuid()
            }
        });
        elem.dataset[`${this.fragmentID}`] = index;
        this.endPointsGroup.appendChild(elem);
        return elem;
    }

    private calcSymmetryPoint([x, y]: TCoordinate, [x1, y1]: TCoordinate): TCoordinate {
        if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2) <= MINIMUM_SPACING) {
            return null;
        }
        return [2 * x1 - x, 2 * y1 - y];
    }

    public redrawCurve(x: number, y: number) {
        let points: TCoordinate[];
        if (this.points.length === 2) {
            const p = this.calcSymmetryPoint([x, y], this.points[1]);
            if (!p) {
                points = this.points;
            } else {
                points = [this.points[0], p, this.points[1]];
            }
        } else {
            const p = this.calcSymmetryPoint([x, y], this.points[2]);
            if (!p) {
                points = this.points;
            } else {
                points = [this.points[0], this.points[1], p, this.points[2]];
            }
        }
        const path = this.generatePath(points);
        this.elem.setAttribute('d', path);
    }

    public del() {
        this.elem.remove();
    }

    public updateScale(scale: number, pointRadiusWithScale: number) {
        this.scale = scale;
        this.pointRadiusWithScale = pointRadiusWithScale;

        this.elem.setAttribute('stroke-width', `${1 / this.scale}`);
        this.getEndPointEles().forEach((elem) => {
            const index = elem.dataset[this.fragmentID];
            const item = this.endPoints[index];

            elem.setAttribute('width', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('height', `${POINT_SIZE / this.scale}`);
            elem.setAttribute('rx', `${this.pointRadiusWithScale}`);
            elem.setAttribute('ry', `${this.pointRadiusWithScale}`);
            elem.setAttribute('x', `${item[0] - this.pointRadiusWithScale}`);
            elem.setAttribute('y', `${item[1] - this.pointRadiusWithScale}`);
            elem.setAttribute('stroke-width', `${1 / scale}`);
        });
    }

    public distanceDetection(x: number, y: number) {
        if (!this.model) {
            return 999;
        }
        const nearestPoint = this.model.project({ x, y });

        const a = nearestPoint.x - x;
        const b = nearestPoint.y - y;
        return Math.sqrt(a * a + b * b);
    }

    public isEndpointCoincidence() {
        const endPointEles = this.getEndPointEles();
        if (endPointEles.length < 2) {
            return false;
        }
        return (
            endPointEles[0].getAttribute('x') === endPointEles[1].getAttribute('x')
            && endPointEles[0].getAttribute('y') === endPointEles[1].getAttribute('y')
        );
    }
}

export default Line;
