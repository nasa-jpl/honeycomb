import { Object3D, Mesh, InstancedMesh } from 'three';

// TODO: Look at instancing to manage these objects if we have to render a lot of them
// https://stackoverflow.com/questions/41880864/how-to-use-three-js-instancedbuffergeometry-instancedbufferattribute
// Sounds like now you just use InstancedMesh...
// https://stackoverflow.com/questions/41880864/how-to-use-three-js-instancedbuffergeometry-instancedbufferattribute#comment135000316_43476114

type Constructor = new (...args: any[]) => object;
export function AnnotationMixin<TBase extends Constructor>(baseClass: TBase) {
    return class extends baseClass {
        isAnnotation = true;
    };
}

export class Annotation extends AnnotationMixin(Object3D) { }
export class MeshAnnotation extends AnnotationMixin(Mesh) { }
export class InstancedMeshAnnotation extends AnnotationMixin(InstancedMesh) { }
