import ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';


export default class DeleteOperation3D extends Operation {
    constructor(state) {
        super();
        this.state = {
            target: null,
            ...state
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
                ThreeUtils.setObjectParent(model.meshObject, model.meshObject);
            }
        }
        model.onTransform();
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
        model.onTransform();
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

        modelGroup.models = modelGroup.models.concat(model);
        if (model.supportTag) {
            // if (!model.target) return;
            model.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else if (!model.parent) {
            // 需不需要手动设置models
            modelGroup.object.add(model.meshObject);
        } else if (model.parent && model.parent instanceof ThreeGroup) {
            modelGroup.unselectAllModels({ recursive: true });
            modelGroup.recoveryGroup(model.parent, model);
        }
        if (model.isSelected) {
            model.setSelected(false);
        }

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.modelChanged();
    }
}
