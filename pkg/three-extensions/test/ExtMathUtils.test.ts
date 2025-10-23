import { Vector3 } from 'three';
import { ExtMathUtils } from '../src/utilities/ExtMathUtils';

describe('fitPlaneToPoints', () => {
    it('should fit a plane to the points.', () => {
        const pos = new Vector3();
        const dir = new Vector3();

        ExtMathUtils.fitPlaneFromPoints([
            new Vector3(1, 0, 0),
            new Vector3(0, 1, 0),
            new Vector3(1, 1, 0),
            new Vector3(0, 0, 0),
        ], pos, dir);
        expect(pos).toEqual(new Vector3(0.5, 0.5, 0));
        expect(dir).toEqual(new Vector3(0, 0, 1));

        ExtMathUtils.fitPlaneFromPoints([
            new Vector3(1, 0, 0),
            new Vector3(0, 0, 1),
            new Vector3(1, 0, 1),
            new Vector3(0, 0, 0),
            new Vector3(0.5, 0, 0.5),
        ], pos, dir);
        expect(pos).toEqual(new Vector3(0.5, 0, 0.5));
        expect(dir).toEqual(new Vector3(0, 1, 0));

        ExtMathUtils.fitPlaneFromPoints([
            new Vector3(1, 0, 1),
            new Vector3(0, 1, 0),
            new Vector3(1, 1, 1),
            new Vector3(0, 0, 0),
            new Vector3(0.5, 0.5, 0.5),
        ], pos, dir);
        expect(pos).toEqual(new Vector3(0.5, 0.5, 0.5));

        const dirDist = dir.distanceTo(new Vector3(Math.sqrt(2)/2, 0, -Math.sqrt(2)/2));
        expect(dirDist).toBeLessThan(1e-10);
    });
});
