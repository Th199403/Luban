import ThreeGroup from '../../models/ThreeGroup';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';

export default class AddOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            parent: null,
            transform: new Map(),
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        if (model.supportTag) {
            if (!model.target) return;
            model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else {
            modelGroup.object.add(model.meshObject);
        }

        if (model instanceof ThreeGroup) {
            const children = model.children.concat();
            model.children = [];

            children.forEach((subModel) => {
                modelGroup.recoveryGroup(model, subModel);
            });
            model.children.forEach((subModel) => {
                const transform = this.state.transform.get(subModel.modelID);
                subModel.meshObject.position.copy(transform.position);
                subModel.meshObject.scale.copy(transform.scale);
                subModel.meshObject.rotation.copy(transform.rotation);
            });
        }

        const transform = this.state.transform.get(model.modelID);
        model.meshObject.position.copy(transform.position);
        model.meshObject.scale.copy(transform.scale);
        model.meshObject.rotation.copy(transform.rotation);

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.models = modelGroup.models.concat(model); // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (model.supportTag) {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            }
        }

        if (model instanceof ThreeGroup) {
            model.children.forEach((subModel) => {
                this.state.transform.set(subModel.modelID, {
                    position: subModel.meshObject.position.clone(),
                    scale: subModel.meshObject.scale.clone(),
                    rotation: subModel.meshObject.rotation.clone()
                });
            });
        }
        this.state.transform.set(model.modelID, {
            position: model.meshObject.position.clone(),
            scale: model.meshObject.scale.clone(),
            rotation: model.meshObject.rotation.clone()
        });

        modelGroup.removeModel(model);
        if (model.isSelected) {
            model.setSelected(false);
            // trigger <VisualizerLeftBar> component hidden
            modelGroup.unselectAllModels();
        }
        modelGroup.modelChanged();
    }
}
