import TaskManager, {
    Task,
    TaskArray,
    TASK_TYPE_GENERATE_GCODE,
    TASK_TYPE_GENERATE_TOOLPATH,
    TASK_TYPE_GENERATE_VIEWPATH,
    TASK_TYPE_PROCESS_IMAGE,
    TASK_TYPE_CUT_MODEL
} from './TaskManager';

const instance = new TaskManager();

async function loopFunc() {
    await instance.schedule();
    if (instance.hasIdleTask()) {
        setTimeout(loopFunc, 50);
    } else {
        setTimeout(loopFunc, 500);
    }
}

const start = () => {
    loopFunc();
};

const stop = () => {
    // Keep empty currently
};

const addGenerateToolPathTask = (socket, taskArray) => {
    console.log('taskArray[0]', taskArray[0]);
    instance.addTask(new TaskArray(taskArray[0].taskId, socket, taskArray, TASK_TYPE_GENERATE_TOOLPATH, taskArray[0].headType));
};

const addGenerateGcodeTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_GCODE, task.headType));
};

const addGenerateViewPathTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_VIEWPATH, task.headType));
};

const addProcessImageTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_PROCESS_IMAGE, task.headType));
};

const addCutModelTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_CUT_MODEL, task.headType));
};

export default {
    instance,
    start,
    stop,
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    addProcessImageTask,
    addCutModelTask,
    addGenerateViewPathTask
};
