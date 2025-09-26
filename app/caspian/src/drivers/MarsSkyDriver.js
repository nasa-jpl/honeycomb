import { MarsSky } from '@gov.nasa.jpl.honeycomb/mars-sky';
import { SpiceDriver } from './SpiceDriver.js';

export class MarsSkyDriver extends SpiceDriver {
    constructor(options, manager) {
        super(manager, options);

        this.sky = null;
        this.type = 'MarsSkyDriver';
        this.isMarsSkyDriver = true;
    }

    initialize() {
        super.initialize();
        const viewer = this.viewer;

        const sky = new MarsSky();
        sky.scale.setScalar(45000);
        viewer.world.add(sky);
        viewer.perspectiveCamera.far = 45000 * 3;
        viewer.perspectiveCamera.updateProjectionMatrix();
        viewer.tags.addTag(sky, 'sky');

        this.sky = sky;
    }

    update(state, diff) {
        super.update(state, diff);

        // If we don't have any sun data then just set the sun position from the current light pos
        const telemetryField = this.options.telemetry;
        const telemetryState = state && state[telemetryField];
        if (!telemetryState) {
            const viewer = this.viewer;
            this.sky.sunPosition.copy(viewer.lightDirection).multiplyScalar(-1);
            this._updateLights();
        }
    }

    _applySunPosition(tel) {
        if (tel.sunDir) {
            this.sky.sunPosition.set(tel.sunDir[0], tel.sunDir[1], tel.sunDir[2]).normalize();
            this._updateLights();
            this.viewer.dirty = true;
        }
    }

    _updateLights() {
        const { viewer, sky } = this;

        // the current CSM plugin for three.js does not currently update the already
        // created lights when setting the lightIntensity field so we iterate over them
        // for now.
        const lightIntensity = sky.getDirectionalIntensity();
        viewer.setLightIntensity(lightIntensity);
        viewer.lightDirection.copy(sky.sunPosition).multiplyScalar(-1);

        sky.getColor(viewer.ambientLight.color);
        viewer.ambientLight.intensity = sky.getAmbientIntensity();

        viewer.dirty = true;
    }
}
