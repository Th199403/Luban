import Operation from './Operation';

export default class ScaleOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
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
        model.modelGroup.unselectAllModels({ recursive: !!model.parent });

        if (model.supportTag) {
            modelGroup.addModelToSelectedGroup(model);
            model.meshObject.parent.position.set(positionX, positionY, 0);
            model.meshObject.parent.scale.set(scaleX, scaleY, scaleZ);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
            model.computeBoundingBox();
            model.target.stickToPlate();
            model.target.computeBoundingBox();
        } else {
            model.meshObject.position.set(positionX, positionY, positionZ);
            model.meshObject.rotation.set(rotationX, rotationY, rotationZ);
            model.meshObject.scale.set(scaleX, scaleY, scaleZ);
            model.stickToPlate();
            model.computeBoundingBox();
        }
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
