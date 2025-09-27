import { DirectionalLight, Vector3, Object3D, CameraHelper, Euler, Group, MathUtils } from 'three';
import { Viewer } from './Viewer';

type Constructor = new (...args: any) => Viewer;
export function TightShadowViewerMixin<TBase extends Constructor>(base: TBase) {
    return class extends base {
        private directionalLight: DirectionalLight;
        private directionalLightHelper: CameraHelper;
        shadowTargets: Object3D[];

        constructor(...args: any) {
            super(...args);

            const light = new DirectionalLight(0xffffff, 1);
            light.add(light.target);

            (light.target as any).isPsuedoObject = true;
            light.target.visible = false;
            light.target.position.set(1, 0, 0);
            light.position.set(6, 0, 0);

            light.castShadow = true;
            light.shadow.mapSize.setScalar(2048);
            light.shadow.bias = -0.001;//-1e-6;
            light.shadow.normalBias = 0.01;// 1e-4;
            light.shadow.camera.near = 0;
            
            const frustumSize = 5;
            light.shadow.camera.top = frustumSize;
            light.shadow.camera.bottom = -frustumSize;
            light.shadow.camera.left = -frustumSize;
            light.shadow.camera.right = frustumSize;

            this.shadowTargets = [];
            this.directionalLight = light;

            // make the light be a child of a parent so that it's
            // easy to rotate (the parent) so that the directional
            // light moves like the sun (otherwise you'll have to
            // both rotate and move the directional light).
            const dirLightParent = new Group();
            dirLightParent.name = 'Directional Light Parent';
            dirLightParent.rotateX(-30 * MathUtils.DEG2RAD);
            dirLightParent.rotateY(30 * MathUtils.DEG2RAD);
            dirLightParent.add(this.directionalLight);
            this.world.add(dirLightParent);

            // point towards the origin
            this.directionalLight.rotateZ(180 * MathUtils.DEG2RAD);

            // For debug
            this.directionalLightHelper = new CameraHelper( this.directionalLight.shadow.camera );
            this.directionalLightHelper.visible = false;
            this.world.parent?.add( this.directionalLightHelper );

            this.dispatchEvent({ type: 'add-object', object: this.directionalLight });
        }

        setSunAzimuth(azimuth: number) {
            const rotation = this.directionalLight.parent?.rotation;
            if (rotation) {
                rotation.set(
                    0,
                    rotation.y,
                    azimuth,
                    'ZYX'
                );
            }
        }

        setSunElevation(elevation: number) {
            const rotation = this.directionalLight.parent?.rotation;
            if (rotation) {
                rotation.set(
                    0,
                    elevation,
                    rotation.z,
                    'ZYX'
                );
            }
        }

        getLightDirection(): Euler {
            return (new Euler).setFromQuaternion(this.directionalLight.quaternion);
        }

        setLightDirection(direction: Vector3) {
            this.directionalLight.quaternion.setFromEuler(
                new Euler(direction.x, direction.y, direction.z)
            );
        }

        getLightIntensity(): number {
            return this.directionalLight.intensity;
        }

        setLightIntensity(intensity: number) {
            this.directionalLight.intensity = intensity;
        }

        getDirectionalLight(): DirectionalLight {
            return this.directionalLight;
        }

        getDirectionalLightHelper(): CameraHelper {
            return this.directionalLightHelper;
        }
    };
}
