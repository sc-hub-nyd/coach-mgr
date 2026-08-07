/**
 * TacticsStore - Single Source of Truth for CoachMgr Tactics Canvas
 * Manages objects, frames, active tool, selection, dirty status, etc.
 */

class TacticsStore {
    constructor() {
        this.state = {
            objects: [],
            frames: [],
            currentFrameIndex: 0,
            selectedObject: null,
            currentTool: 'select',
            isDirty: false,
            isPlaying: false,
            pitchTemplate: 'full'
        };
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(eventType, data) {
        for (const listener of this.listeners) {
            try {
                listener(eventType, data, this.state);
            } catch (err) {
                console.error('[TacticsStore] Listener error:', err);
            }
        }
    }

    get objects() { return this.state.objects; }
    get frames() { return this.state.frames; }
    get currentFrameIndex() { return this.state.currentFrameIndex; }
    get selectedObject() { return this.state.selectedObject; }
    get currentTool() { return this.state.currentTool; }
    get isDirty() { return this.state.isDirty; }
    get isPlaying() { return this.state.isPlaying; }

    setObjects(newObjects, triggerNotify = true) {
        this.state.objects = newObjects ? JSON.parse(JSON.stringify(newObjects)) : [];
        this.state.isDirty = true;
        this.syncCurrentFrame();
        if (triggerNotify) this.notify('objectsChanged', this.state.objects);
    }

    setSelectedObject(obj) {
        this.state.selectedObject = obj;
        this.notify('selectionChanged', obj);
    }

    setTool(toolName) {
        this.state.currentTool = toolName;
        this.notify('toolChanged', toolName);
    }

    setIsPlaying(playing) {
        this.state.isPlaying = playing;
        this.notify('playStateChanged', playing);
    }

    setFrames(frames, currentIdx = 0) {
        this.state.frames = Array.isArray(frames) ? JSON.parse(JSON.stringify(frames)) : [];
        if (this.state.frames.length === 0) {
            this.state.frames = [{ objects: [], title: '', caption: '', pauseDuration: 0 }];
        }
        this.state.currentFrameIndex = Math.max(0, Math.min(currentIdx, this.state.frames.length - 1));
        const curFrame = this.state.frames[this.state.currentFrameIndex];
        if (curFrame && Array.isArray(curFrame.objects)) {
            this.state.objects = JSON.parse(JSON.stringify(curFrame.objects));
        } else {
            this.state.objects = [];
        }
        this.notify('framesChanged', this.state.frames);
    }

    setCurrentFrameIndex(index) {
        if (index < 0 || index >= this.state.frames.length) return;
        this.syncCurrentFrame();
        this.state.currentFrameIndex = index;
        const curFrame = this.state.frames[index];
        const objs = (curFrame && Array.isArray(curFrame.objects)) ? curFrame.objects : (Array.isArray(curFrame) ? curFrame : []);
        this.state.objects = JSON.parse(JSON.stringify(objs));
        this.state.selectedObject = null;
        this.notify('frameSelected', { index, frame: curFrame, objects: this.state.objects });
    }

    syncCurrentFrame() {
        if (!this.state.frames || this.state.frames.length === 0) {
            this.state.frames = [{ objects: JSON.parse(JSON.stringify(this.state.objects)), title: '', caption: '', pauseDuration: 0 }];
            this.state.currentFrameIndex = 0;
            return;
        }
        const idx = Math.max(0, Math.min(this.state.currentFrameIndex, this.state.frames.length - 1));
        const curFrame = this.state.frames[idx];
        if (Array.isArray(curFrame)) {
            this.state.frames[idx] = {
                objects: JSON.parse(JSON.stringify(this.state.objects)),
                title: '',
                caption: '',
                pauseDuration: 0
            };
        } else if (typeof curFrame === 'object' && curFrame !== null) {
            curFrame.objects = JSON.parse(JSON.stringify(this.state.objects));
        }
    }
}

export const tacticsStore = new TacticsStore();
