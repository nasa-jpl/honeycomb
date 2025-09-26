import { Group, Object3D } from 'three';

// renders only the active child depending on the "active" flag
/**
 * Class for toggling visibility of children based on an active flag.
 * @extends Group
 */
export class SwitchGroup extends Group {
    _activeIndex: number;
    isSwitchGroup: boolean = true;

    /**
     * The flag indicating which child is visible.
     */
    set active(val: number) {
        const curr = this._activeIndex;
        if (curr < this.children.length) {
            this.children[curr].visible = false;
        }

        if (val < this.children.length) {
            this.children[val].visible = true;
        }
        this._activeIndex = val;
    }

    get active(): number {
        return this._activeIndex;
    }

    constructor(items: Object3D[]) {
        super();

        this._activeIndex = 0;
        this.active = 0;

        for (const o of items) {
            this.add(o);
        }

        for (const c of this.children) {
            c.visible = false;
        }
    }
}
