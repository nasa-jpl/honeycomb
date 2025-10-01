import { OptimizedPlaneBufferGeometry } from '../src/geometry/OptimizedPlaneBufferGeometry';
import { PlaneBufferGeometry } from 'three';

describe('OptimizedPlaneBufferGeometry', () => {
    it('should have the same values as native PlaneBufferGeometry.', () => {
        const native = new PlaneBufferGeometry(2, 3, 10, 11);
        const optimized = new OptimizedPlaneBufferGeometry(2, 3, 10, 11);

        const nativePosAttr = native.getAttribute('position');
        const nativeIndexAttr = native.getIndex();

        const optimizedPosAttr = optimized.getAttribute('position');
        const optimizedIndexAttr = optimized.getIndex();

        expect(optimizedPosAttr).toEqual(nativePosAttr);
        expect(optimizedIndexAttr).toEqual(nativeIndexAttr);
    });
});
