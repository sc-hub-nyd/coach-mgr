/**
 * CommandStack & Commands for Undo/Redo
 * Replaces heavy JSON full-snapshot stack with action-based reversible commands.
 */

export class CommandStack {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        for (const listener of this.listeners) {
            try {
                listener({
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            } catch (e) {
                console.error('[CommandStack] listener error:', e);
            }
        }
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.notify();
    }

    undo() {
        if (!this.canUndo()) return false;
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        this.notify();
        return true;
    }

    redo() {
        if (!this.canRedo()) return false;
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        this.notify();
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.notify();
    }
}

export class SetObjectsCommand {
    constructor(store, newObjects, prevObjects) {
        this.store = store;
        this.newObjects = JSON.parse(JSON.stringify(newObjects));
        this.prevObjects = JSON.parse(JSON.stringify(prevObjects));
    }

    execute() {
        this.store.setObjects(this.newObjects);
    }

    undo() {
        this.store.setObjects(this.prevObjects);
    }
}

export const commandStack = new CommandStack();
