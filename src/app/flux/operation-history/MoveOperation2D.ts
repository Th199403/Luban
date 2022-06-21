import { ModelTransformation } from '../../models/BaseModel';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import Operation from './Operation';

type TState = {
    target: SvgModel,
    from: ModelTransformation,
    to: ModelTransformation,
    machine: {
        size: { x: number, y: number }
    },
    svgActions: SVGActionsFactory,
    oldPaths?: string[];
    newPaths?: string[];
}

export default class MoveOperation2D extends Operation<TState> {
    public constructor(state) {
        super();
        this.state = {
            target: null, // SvgModel
            from: null, // original SvgModel.transformation
            to: null, // distination SvgModel.transformation
            machine: null, // machine series info, the size may be changed
            svgActions: null, // SVGActionsFactory instance
            ...state
        };
        this.updateSvgPaths(this.state.from);
    }

    private updateSvgPaths(preTransform: ModelTransformation) {
        const svgModel = this.state.target;

        if (svgModel.config.editable && svgModel.type === 'image') {
            svgModel.updateSvgPaths(preTransform);
        }
    }

    public redo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
        this.updateSvgPaths(this.state.from);
    }

    public undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.from.positionX + this.state.machine.size.x,
            newY: -this.state.from.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
        this.updateSvgPaths(this.state.to);
    }
}
