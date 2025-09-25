import { Group, Object3DEventMap } from 'three';

export type UpOrientation = (
    "+X" | "-X" |
    "+Y" | "-Y" |
    "+Z" | "-Z"
);

/**
 * @extends Group
 * @fires orientation-changed
 * Fired whenever the up direction is changed.
 */
export class World extends Group<{
    "orientation-changed": { up: UpOrientation }
} & Object3DEventMap> {
    isWorld: boolean;
    private _upDirection: UpOrientation;

    constructor() {
        super();
        this.name = 'World';
        this.isWorld = true;
        this._upDirection = '+Y';
    }

    /**
     * Returns the up direction of the world object in the form of [+-][XYZ].
     * @returns {String}
     */
    getUpDirection(): string {
        return this._upDirection;
    }

    /**
     * Takes the up axis orientation as a string in the form of [+-][XYZ].
     */
    setUpDirection(upString: UpOrientation) {
        upString = upString.toUpperCase() as UpOrientation;
        if (/^[-+]?[XYZ]$/.test(upString)) {
            const neg = /^-/.test(upString);
            const axis = upString.replace(/[^XYZ]/gi, '')[0] || 'Y';

            const PI = Math.PI;
            const HALFPI = PI / 2;
            if (axis === 'X') { this.rotation.set(0, 0, !neg ? HALFPI : -HALFPI); }
            if (axis === 'Z') { this.rotation.set(!neg ? -HALFPI : HALFPI, 0, 0); }
            if (axis === 'Y') { this.rotation.set(!neg ? 0 : PI, 0, 0); }

            this._upDirection = upString;

            this.updateMatrix();
            this.updateMatrixWorld();

            this.dispatchEvent({ type: 'orientation-changed', up: upString });
        } else {
            throw new Error(`World: String "${upString}" is not a valid up direction.`);
        }
    }
}
