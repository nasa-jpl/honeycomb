import { SubLoadingManager } from './SubLoadingManager';
import { StateDiff } from './StateDiff';
import { LoadingManager } from '.';
import { AnimatedViewer } from './AnimatedViewer';

const CHANGED_STATE_DIFF = new StateDiff(true);

/**
 * The Driver class is the interpreter of data to visualizations. It takes a set of options and is attached
 * to a viewer to add visualizations into. When data is changed the "update" function is called either from
 * viewer or manually to update the display of the annotations.
 */
export abstract class Driver<T> {
    private _lastState: T;

    type: string = "Driver";
    readonly isDriver = true;

    /**
     * The manager passed into the constructor useful for resolving file paths for assets that need to be loaded.
     * @member {LoadingManager}
     */
    manager: LoadingManager;

    /**
     * The viewer this driver has been attached to.
     * @member {Viewer}
     */
    viewer?: AnimatedViewer;
    id?: string;

    /**
     * The order in which this driver will be updated relative to other drivers by the viewer.
     * @member {Number}
     */
    updateOrder: number;

    /**
     * The set of options passed into the constructor used for updating the driver.
     * @member {any}
     */
    options: any;

    /**
     * @param {LoadingManager} manager
     */
    constructor(manager: LoadingManager = new SubLoadingManager(), options: any = {}) {
        this._lastState = {} as T;
        this.manager = manager;
        this.updateOrder = 0;
        this.options = options;
    }

    /**
     * Called when added to a viewer
     */
    initialize() {
    }

    /**
     * The function to call when adjusting the state that should be visualized.
     * @param {T} state
     * @param {StateDiff<T>} [diff=ALL_CHANGED_DIFF]
     */
    setState(state: T | Partial<T>, diff: StateDiff<T> = CHANGED_STATE_DIFF) {
        this._lastState = state as T;
        this.update(state as T, diff);
    }

    /**
     * The function to call to force a rerun of "update" with a diff indicating everything in the state has changed.
     * This can be used if member variables or options not represented in the state are adjusted and impact visualizations.
     */
    forceUpdate() {
        this.update(this._lastState, CHANGED_STATE_DIFF);
    }

    /**
     * Not intended to be called manually. This function should be overridden by a Driver implementation and is called when a
     * drivers state has been updated or a force update has been made.
     * @virtual
     * @param {Object} state
     * @param {StateDiff} diff
     */
    abstract update(state: T, diff: StateDiff<T>): void;

    /**
     * Not intended to be called manually. This function should be overridden by a Driver implementation and is called when a
     * viewer is being disposed of or the drive is removed from a viewer.
     * @virtual
     */
    dispose() {}
}
