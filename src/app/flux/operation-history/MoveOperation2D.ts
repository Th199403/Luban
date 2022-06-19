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
        // const svgModel = this.state.target;
        // if (svgModel.config.editable) {
        //     this.state.oldPaths = svgModel.paths;
        //     // svgModel.updateSvgPaths(this.state.from);
        //     svgModel.paths = this.state.newPaths;
        //     this.state.newPaths = svgModel.paths;
        // }
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
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
        this.updatePaths(this.state.newPaths);
    }

    public undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.from.positionX + this.state.machine.size.x,
            newY: -this.state.from.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
        this.updatePaths(this.state.oldPaths);
    }
}
