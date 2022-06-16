import SvgModel from '../../models/SvgModel';
import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import Operation from './Operation';

type TSvgInfo = {
    paths: string[];
    uploadName: string;
    width: number;
    height: number;
    x: number;
    y: number;
}

type DrawTransformCompleteProp = {
    before: TSvgInfo,
    after: TSvgInfo,
    drawGroup: DrawGroup,
    svgModel: SvgModel
}

export default class DrawTransformComplete extends Operation<DrawTransformCompleteProp> {
    public constructor(props: DrawTransformCompleteProp) {
        super();
        this.state = {
            svgModel: props.svgModel,
            before: props.before,
            after: props.after,
            drawGroup: props.drawGroup,
        };
        this.setSvgTransform(this.state.after);
        this.state.svgModel.onTransform();
        this.state.svgModel.refresh();
    }

    private setSvgTransform({ paths, uploadName, width, height, x, y }: TSvgInfo) {
        const model = this.state.svgModel;
        model.paths = paths;
        model.elem.setAttribute('href', `/data/Tmp/${uploadName}`);
        model.elem.setAttribute('width', `${width}`);
        model.elem.setAttribute('height', `${height}`);
        model.elem.setAttribute('x', `${x}`);
        model.elem.setAttribute('y', `${y}`);
    }

    public redo() {
        this.setSvgTransform(this.state.after);
        this.state.svgModel.onTransform();
    }

    public undo() {
        this.setSvgTransform(this.state.before);
        this.state.svgModel.onTransform();
    }
}
