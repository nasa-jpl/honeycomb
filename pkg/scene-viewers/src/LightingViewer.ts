import { CameraHelper, DirectionalLight, Group, Vector3 } from "three";
import { Viewer } from "./Viewer";

const unitX = new Vector3(1, 0, 0);
const tempVec3a = new Vector3();

type Constructor = new (...args: any) => Viewer;
export function LightingViewerMixin<TBase extends Constructor>(base: TBase) {
    return class extends base {

        directionalLightParent: Group;
        directionalLight: DirectionalLight;
        directionalLightHelper: CameraHelper;

        constructor(...args: any) {
            super(...args);

            const light = new DirectionalLight(0xffffff, 1);

            light.target.visible = false;
            // Orientation of light will point to the target
            light.target.position.set(0, 0, 0);

            light.position.set(100, 0, 0);

            light.castShadow = true;
            light.shadow.mapSize.setScalar(2048 * 4);
            light.shadow.bias = -1e-6;
            light.shadow.normalBias = 1e-4;
            light.shadow.camera.near = 0;
            // light.shadow.camera.far = 3500;
            light.shadow.intensity = 1;

            const frustumSize = 300;
            light.shadow.camera.top = frustumSize;
            light.shadow.camera.bottom = -frustumSize;
            light.shadow.camera.left = -frustumSize;
            light.shadow.camera.right = frustumSize;

            this.directionalLight = light;
            this.directionalLightParent = new Group();
            this.directionalLightParent.position.set(0, 0, 0);

            this.directionalLightHelper = new CameraHelper(this.directionalLight.shadow.camera);
            this.directionalLightHelper.visible = false;

            this.directionalLightParent.add(this.directionalLight);
            this.directionalLightParent.add(light.target);

            this.world.add(this.directionalLightParent);
            this.scene.add(this.directionalLightHelper);
        }

        setSunDirection(direction: Vector3) {
            tempVec3a.copy(direction);
            tempVec3a.normalize();

            // Point the directional light torward the sun direction vector
            this.directionalLightParent.quaternion.setFromUnitVectors(
                unitX,
                tempVec3a
            );
        }

        getSunDirection(): Vector3 {
            tempVec3a.copy(unitX);
            tempVec3a.applyQuaternion(this.directionalLightParent.quaternion);
            return tempVec3a.clone();
        }
    };
}
