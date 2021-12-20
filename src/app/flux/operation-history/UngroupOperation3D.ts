import type ModelGroup from '../../models/ModelGroup';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import type { ModelTransformation } from '../../models/ThreeBaseModel';
import Operation from './Operation';

type ModelState = {
    target: ThreeModel,
    transformation: ModelTransformation
};

type UngroupState = {
    modelsBeforeUngroup: Array<ThreeModel | ThreeGroup>,
    target: ThreeGroup,
    groupTransformation: ModelTransformation,
    subModelStates: ModelState[]
    modelGroup: ModelGroup
};
export default class UngroupOperation3D extends Operation {
    state: UngroupState;

    constructor(state) {
        super();
        this.state = {
            modelsBeforeUngroup: [],
            target: null,
            groupTransformation: null,
            subModelStates: [],
            modelGroup: null,
            ...state
        };
    }

    redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();
        modelGroup.unselectAllModels();
    }

    undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;
        const subModelStates = this.state.subModelStates;

        modelGroup.unselectAllModels();
        const subModels = [];
        subModelStates.forEach(item => {
            item.target.updateTransformation(item.transformation);
            subModels.push(item.target);
        });
        target.updateTransformation(this.state.groupTransformation);
        target.add(subModels);
        modelGroup.object.add(target.meshObject);
        modelGroup.models = [...this.state.modelsBeforeUngroup];
    }
}
