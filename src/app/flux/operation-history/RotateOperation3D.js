import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';

export default class RotateOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            ...state
        };
    }

    redo() {
        this.exec(this.state.to);
    }

    undo() {
        this.exec(this.state.from);
    }

    exec({ positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ }) {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        modelGroup.unselectAllModels();
        if (model.parent) {
            ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
        } else {
            ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
        }
        model.meshObject.position.set(positionX, positionY, positionZ);
        model.meshObject.rotation.set(rotationX, rotationY, rotationZ);
        model.meshObject.scale.set(scaleX, scaleY, scaleZ);

        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
