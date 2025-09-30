import {
    BufferGeometry,
    CylinderGeometry,
    ConeGeometry,
} from 'three';

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface ArrowParameters {
    /**
     * Height of the top cone
     * scale factor of the total arrow length
     * @default 0.15
     */
    coneLength: number;

    /**
     * Radius of the bottom of the code
     * scale factor of the total arrow length
     * @default 0.05
     */
    coneRadius: number;

    /**
     * Radius of the line/cylinder geometry
     * scale factor of the total arrow length
     * @default 0.01
     */
    lineRadius: number;
}

export const DEFAULT_ARROW_PARAMETERS: ArrowParameters = {
    coneLength: 0.15,
    coneRadius: 0.05,
    lineRadius: 0.01
};

export class ArrowGeometry extends BufferGeometry {
    update(length: number, params?: Partial<ArrowParameters>) {
        const fullParams = {
            ...DEFAULT_ARROW_PARAMETERS,
            ...params
        } as ArrowParameters;

        const lineRadius = fullParams.lineRadius * length;
        const coneLength = fullParams.coneLength * length;
        const lineLength = length - coneLength;

        //using cylinder geometry to create line
        // let geometry = new CylinderGeometry(this.cylLineRadius, this.cylLineRadius, this.lineLength, this.cylLineRadialSegment, this.cylLineHeightSegment);
        const lineGeometry = new CylinderGeometry(
            lineRadius,
            lineRadius,
            lineLength,
            16, 2
        );

        lineGeometry.rotateZ(Math.PI / 2);
        lineGeometry.translate(lineLength / 2, 0, 0);

        const coneGeometry = new ConeGeometry(
            length * fullParams.coneRadius,
            length * fullParams.coneLength,
            16, 2
        );

        coneGeometry.rotateZ(-Math.PI / 2);
        coneGeometry.translate(length - (coneLength / 2), 0, 0);

        const mergedGeometry = mergeGeometries([lineGeometry, coneGeometry], false);

        this.attributes = mergedGeometry.attributes;
        this.index = mergedGeometry.index;
    }
}
