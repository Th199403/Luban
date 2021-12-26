import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';

type VisibleState = {
    target: ThreeModel | ThreeGroup,
    visible: boolean
};

export default class VisibleOperation3D extends Operation {
    state: VisibleState;

    constructor(state) {
        super();
        this.state = {
            target: null,
            visible: true,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        modelGroup.toggleModelsVisible(this.state.visible, [model]);
        modelGroup.modelChanged();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        modelGroup.toggleModelsVisible(!this.state.visible, [model]);
        modelGroup.modelChanged();
    }
}
