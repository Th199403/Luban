import ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';


export default class DeleteOperation3D extends Operation {
    constructor(state) {
        super();
        this.state = {
            target: null,
            ...state,
            transformation: {}
        };
        // an object to be deleted will be selected at first, unwrapped from parent group
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (!model.supportTag) {
                if (model.parent) {
                    ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
                } else {
                    ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
                }
            } else {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            }
        }
        this.state.transformation = {
            position: model.meshObject.position.clone(),
            scale: model.meshObject.scale.clone(),
            rotation: model.meshObject.rotation.clone()
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (!model.supportTag) {
                if (model.parent) {
                    ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
                } else {
                    ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
                }
            } else {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            }
        }
        modelGroup.removeModel(model);
        if (model.isSelected) {
            model.setSelected(false);
            // trigger <VisualizerLeftBar> popup component hidden
            modelGroup.unselectAllModels();
        }
        modelGroup.modelChanged();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup as ModelGroup;

        if (model.supportTag) {
            if (!model.target) return;
            modelGroup.models = modelGroup.models.concat(model);
            model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else if (!model.parent) {
            modelGroup.models = modelGroup.models.concat(model);
            modelGroup.object.add(model.meshObject);
        } else if (model.parent && model.parent instanceof ThreeGroup) {
            if (modelGroup.models.find(m => m.modelID === model.parent.modelID)) {
                modelGroup.recoveryGroup(model.parent, model);
            } else {
                modelGroup.models = modelGroup.models.concat(model.parent);
                ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
                ThreeUtils.setObjectParent(model.parent.meshObject, modelGroup.object);

                model.meshObject.position.copy(this.state.transformation.position);
                model.meshObject.scale.copy(this.state.transformation.scale);
                model.meshObject.rotation.copy(this.state.transformation.rotation);
            }
            model.stickToPlate();
        }
        if (model.isSelected) {
            model.setSelected(false);
        }

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.modelChanged();
    }
}
