import { ModelTransformation } from '../../models/BaseModel';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import Operation from './Operation';

type Transform = ModelTransformation & {
    refImage: string
}

type TState = {
    target: SvgModel,
    from: Transform, // original SvgModel.transformation
    to: Transform, // distination SvgModel.transformation
    machine: { // machine series info, the size may be changed
        size: { x: number, y: number }
    },
    svgActions: SVGActionsFactory, // SVGActionsFactory instance
    oldPaths?: string[];
    newPaths?: string[];
}

export default class ScaleOperation2D extends Operation<TState> {
    public constructor(state) {
        super();
        this.state = {
            target: state.target, // SvgModel
            from: state.from, // original SvgModel.transformation
            to: state.to, // distination SvgModel.transformation
            machine: state.machine, // machine series info, the size may be changed
            svgActions: state.svgActions, // SVGActionsFactory instance
        };
        const svgModel = this.state.target;
        if (svgModel.config.editable) {
            this.state.oldPaths = svgModel.paths;
            svgModel.updateSvgPaths(this.state.from);
            this.state.newPaths = svgModel.paths;
        }
    }

    private updatePaths(paths: string[]) {
        const svgModel = this.state.target;

        if (svgModel.config.editable && paths) {
            svgModel.paths = paths;
        }
    }

    public redo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        const elements = [model.elem];
        const isImageElement = model.elem.tagName.toLowerCase() === 'image';
        const restore = () => {
            svgActions.resizeElementsImmediately(elements, {
                newWidth: this.state.to.width,
                newHeight: this.state.to.height,
                imageWidth: isImageElement ? this.state.to.width : null,
                imageHeight: isImageElement ? this.state.to.height : null
            });
            svgActions.moveElementsImmediately(elements, {
                newX: this.state.to.positionX + this.state.machine.size.x,
                newY: -this.state.to.positionY + this.state.machine.size.y
            });
            svgActions.resetFlipElements(elements, {
                x: this.state.to.scaleX,
                y: this.state.to.scaleY
            });
            svgActions.clearSelection();
            model.elem.onload = null;
        };
        if (isImageElement) {
            model.elem.onload = restore;
            model.elem.setAttribute('href', this.state.to.refImage);
        } else {
            restore();
        }
        this.updatePaths(this.state.newPaths);
    }

    public undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        const elements = [model.elem];
        const isImageElement = model.elem.tagName.toLowerCase() === 'image';
        const restore = () => {
            svgActions.resizeElementsImmediately(elements, {
                newWidth: this.state.from.width,
                newHeight: this.state.from.height,
                imageWidth: isImageElement ? this.state.from.width : null,
                imageHeight: isImageElement ? this.state.from.height : null
            });
            svgActions.moveElementsImmediately(elements, {
                newX: this.state.from.positionX + this.state.machine.size.x,
                newY: -this.state.from.positionY + this.state.machine.size.y
            });
            svgActions.resetFlipElements(elements, {
                x: this.state.from.scaleX,
                y: this.state.from.scaleY
            });
            svgActions.clearSelection();
            model.elem.onload = null;
        };
        if (isImageElement) {
            model.elem.onload = restore;
            model.elem.setAttribute('href', this.state.from.refImage);
        } else {
            restore();
        }
        this.updatePaths(this.state.oldPaths);
    }
}
