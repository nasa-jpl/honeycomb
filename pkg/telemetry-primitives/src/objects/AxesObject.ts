import {
    Mesh,
    Object3D,
    Group,
    Vector3,
    Box3,
    BoxGeometry,
    MeshBasicMaterial,
    Color,
    FrontSide
} from 'three';

import { ArrowGeometry, DEFAULT_ARROW_PARAMETERS, type ArrowParameters } from './ArrowGeometry';

function basicMaterial(color: [r: number, g: number, b: number, a: number]) {
    const mat = new MeshBasicMaterial({
        color: new Color(color[0], color[1], color[2]),
        opacity: color[3],
        transparent: true
    });

    mat.side = FrontSide;
    mat.shadowSide = FrontSide;
    return mat;
}

export class ArrowMesh extends Mesh<ArrowGeometry, MeshBasicMaterial> {
    readonly isPsuedoObject = true;

    constructor(color: [r: number, g: number, b: number, a: number]) {
        super(new ArrowGeometry());
        this.material = basicMaterial(color);
    }
}

const boxGeometry = new BoxGeometry(1, 1, 1);
class ClickableSphere extends Mesh {
    readonly isPsuedoObject = true;
    readonly isClickable = true;

    constructor() {
        super(boxGeometry);
        this.visible = false;
    }

    set size(s: number) {
        this.scale.set(s, s, s);
    }
}

export class AxesObject extends Group {
    readonly isPsuedoObject = true;
    readonly type = "AxisHelper";

    readonly click: ClickableSphere;
    readonly x: ArrowMesh;
    readonly y: ArrowMesh;
    readonly z: ArrowMesh;

    private _opacity: number;

    private _size: number;
    private _parameters: ArrowParameters;

    constructor(size?: number, parameters?: Partial<ArrowParameters>) {
        super();

        this._opacity = 0.75;

        this.click = new ClickableSphere();
        this.x = new ArrowMesh([1, 0, 0, this._opacity]);
        this.y = new ArrowMesh([0, 1, 0, this._opacity]);
        this.z = new ArrowMesh([0, 0, 1, this._opacity]);

        this.y.rotateZ(Math.PI / 2);
        this.z.rotateY(-Math.PI / 2);

        this._size = size ?? 1;
        this._parameters = {
            ...DEFAULT_ARROW_PARAMETERS,
            ...parameters
        };

        this.add(this.click);
        this.add(this.x);
        this.add(this.y);
        this.add(this.z);

        this.x.material.depthTest = false;
        this.y.material.depthTest = false;
        this.z.material.depthTest = false;

        this._update();
    }

    /**
     * Compute the recommended size of the 
     * @param object 
     */
    static defaultLength(object: Object3D): number {
        // Scale the axes helper relative to the size of the object itself
        const boundingBox = new Box3().setFromObject(object);
        const size = new Vector3();
        boundingBox.getSize(size);

        return Math.min((Math.max(size.x, size.y, size.z) || 1) * 0.75, 1);
    }

    private _update() {
        this.x.geometry.update(this._size, this._parameters);
        this.y.geometry.update(this._size, this._parameters);
        this.z.geometry.update(this._size, this._parameters);

        this.x.material.opacity = this._opacity;
        this.y.material.opacity = this._opacity;
        this.z.material.opacity = this._opacity;

        this.click.size = this._size * 0.1;
    }

    set size(s: number) {
        this._size = s;
        this._update();
    }

    get size(): number {
        return this._size;
    }

    get opacity(): number {
        return this._opacity;
    }

    set opacity(o: number) {
        this._opacity = o;
        this._update();
    }

    set parameters(p: Partial<ArrowParameters>) {
        this._parameters = {
            ...this._parameters,
            ...p
        };
        this._update();
    }

    get parameters(): ArrowParameters {
        return this._parameters;
    }
}
