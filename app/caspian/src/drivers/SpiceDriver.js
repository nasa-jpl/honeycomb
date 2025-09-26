import { Driver } from '@gov.nasa.jpl.honeycomb/core';

export class SpiceDriver extends Driver {
    constructor(options, manager) {
        super(manager, options);

        this.type = 'SpiceDriver';
        this.isSpiceDriver = true;
    }

    update(state, diff) {
        const telemetryField = this.options.telemetry;
        const telemetryState = state && state[telemetryField];

        if (diff.didChange(telemetryField) && telemetryState) {
            this._applySunPosition(telemetryState);
        }
    }

    _applySunPosition(tel) {
        if (tel.sun_x && tel.sun_y && tel.sun_z) {
            const viewer = this.viewer;
            viewer.lightDirection
                .set(tel.sun_x, tel.sun_y, tel.sun_z)
                .multiplyScalar(-1)
                .normalize();

            viewer.dirty = true;
        }
    }
}
