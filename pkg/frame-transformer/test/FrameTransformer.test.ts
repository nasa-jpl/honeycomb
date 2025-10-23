const THREE = require('three');

global.THREE = THREE;
const { FrameTransformer } = require('../src/FrameTransformer');

function isCloseTo(a, b) {
    return Math.abs(a - b) < 0.005;
}

function isVectorCloseTo(a, b) {
    return isCloseTo(a.x, b.x) && isCloseTo(a.y, b.y) && isCloseTo(a.z, b.z);
}

const isQuaternionCloseTo = (function() {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    return function(a, b) {
        p1.set(1, 0, 0).applyQuaternion(a);
        p2.set(1, 0, 0).applyQuaternion(b);
        if (!isVectorCloseTo(p1, p2)) return false;

        p1.set(0, 1, 0).applyQuaternion(a);
        p2.set(0, 1, 0).applyQuaternion(b);
        if (!isVectorCloseTo(p1, p2)) return false;

        p1.set(0, 0, 1).applyQuaternion(a);
        p2.set(0, 0, 1).applyQuaternion(b);
        if (!isVectorCloseTo(p1, p2)) return false;

        return true;
    };
})();

const areMatricesEqual = (function() {
    const pos1 = new THREE.Vector3();
    const sca1 = new THREE.Vector3();
    const pos2 = new THREE.Vector3();
    const sca2 = new THREE.Vector3();
    const quat1 = new THREE.Quaternion();
    const quat2 = new THREE.Quaternion();
    return function(m1, m2) {
        let same = true;
        for (let i = 0; i < 16; i++) {
            same = same && isCloseTo(m1.elements[i], m2.elements[i]);
        }
        if (same) return true;

        m1.decompose(pos1, quat1, sca1);
        m2.decompose(pos2, quat2, sca2);

        if (!isVectorCloseTo(pos1, pos2)) return false;

        console.log(sca1, sca2);
        if (!isVectorCloseTo(sca1, sca2)) return false;
        console.log('SAC');
        if (!isQuaternionCloseTo(quat1, quat2)) return false;
        console.log('aFTER');

        pos1.set(1, 0, 0).applyMatrix3(m1);
        pos2.set(1, 0, 0).applyMatrix3(m2);
        if (!isVectorCloseTo(pos1, pos2)) return false;

        pos1.set(0, 1, 0).applyMatrix3(m1);
        pos2.set(0, 1, 0).applyMatrix3(m2);
        if (!isVectorCloseTo(pos1, pos2)) return false;

        pos1.set(0, 0, 1).applyMatrix3(m1);
        pos2.set(0, 0, 1).applyMatrix3(m2);
        if (!isVectorCloseTo(pos1, pos2)) return false;

        return true;
    };
})();

function rand(min = -0.5, max = 0.5) {
    const delta = max - min;
    return min + Math.random() * delta;
}

function randomVector(tg, min, max) {
    tg.x = rand(min, max);
    tg.y = rand(min, max);
    tg.z = rand(min, max);
}

const randomQuaternion = (function() {
    const tempEuler = new THREE.Euler();
    return function(tg) {
        tempEuler.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        tg.setFromEuler(tempEuler);
    };
})();

const randomFrame = (function() {
    const tempPos = new THREE.Vector3();
    const tempSca = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    return function(tg) {
        randomVector(tempPos, -5, 5);
        randomVector(tempSca, 0.1, 5);
        randomQuaternion(tempQuat);

        tg.compose(
            tempPos,
            tempQuat,
            tempSca,
        );
    };
})();

describe('FrameTransformer', () => {
    describe('should between frames consistently', () => {
        for (let i = 0; i < 50; i++) {
            describe(`suite ${i}`, () => {
                let f1 = null;
                let f2 = null;

                let m1 = null;
                let m2 = null;
                let m3 = null;

                let pt1 = null;
                let pt2 = null;
                let pt3 = null;

                let q1 = null;
                let q2 = null;
                let q3 = null;

                let scene = null;
                let oldParent = null;
                let newParent = null;
                let target = null;

                beforeAll(() => {
                    f1 = new THREE.Matrix4();
                    randomFrame(f1);

                    f2 = new THREE.Matrix4();
                    randomFrame(f2);

                    m1 = new THREE.Matrix4();
                    m2 = new THREE.Matrix4();
                    m3 = new THREE.Matrix4();
                    randomFrame(m1);

                    pt1 = new THREE.Vector3();
                    pt2 = new THREE.Vector3();
                    pt3 = new THREE.Vector3();
                    randomVector(pt1);

                    q1 = new THREE.Quaternion();
                    q2 = new THREE.Quaternion();
                    q3 = new THREE.Quaternion();
                    randomQuaternion(q1);

                    scene = new THREE.Scene();
                    oldParent = new THREE.Group();
                    newParent = new THREE.Group();
                    target = new THREE.Object3D();

                    // Create hierarchy
                    scene.add(oldParent);
                    scene.add(newParent);
                    oldParent.add(target);

                    // Set up the transforms of the objects
                    randomFrame(oldParent.matrix);
                    randomFrame(newParent.matrix);
                    oldParent.scale.set(1, 1, 1);
                    newParent.scale.set(1, 1, 1);

                    target.position.copy(pt1);
                    target.quaternion.copy(q1);
                    target.scale.set(1, 1, 1);
                    scene.updateMatrixWorld(true, true);
                });

                it('point transform', () => {
                    FrameTransformer.transformPoint(f1, f2, pt1, pt2);
                    FrameTransformer.transformPoint(f2, f1, pt2, pt3);

                    expect(isVectorCloseTo(pt1, pt3)).toEqual(true);
                });

                it('direction transform', () => {
                    FrameTransformer.transformDirection(f1, f2, pt1, pt2);
                    FrameTransformer.transformDirection(f2, f1, pt2, pt3);

                    expect(isVectorCloseTo(pt1, pt3)).toEqual(true);
                });

                it('quaternion transform', () => {
                    FrameTransformer.transformQuaternion(f1, f2, q1, q2);
                    FrameTransformer.transformQuaternion(f2, f1, q2, q3);

                    expect(isQuaternionCloseTo(q1, q3)).toEqual(true);
                });

                it('frame transform', () => {
                    FrameTransformer.transformFrame(f1, f2, m1, m2);
                    FrameTransformer.transformFrame(f2, f1, m2, m3);

                    expect(areMatricesEqual(m1, m3)).toEqual(true);
                });

                it('should match Object3D.attach()', () => {
                    const oldMat = newParent.matrixWorld;
                    const newMat = newParent.matrixWorld;

                    FrameTransformer.transformPoint(oldMat, newMat, target.position, pt2);
                    FrameTransformer.transformQuaternion(oldMat, newMat, target.quaternion, q2);
                    FrameTransformer.transformFrame(oldMat, newMat, target.matrix, m2);
                    newParent.attach(target);

                    expect(isVectorCloseTo(target.position, pt2)).toEqual(true);
                    expect(isQuaternionCloseTo(target.quaternion, q2)).toEqual(true);
                    expect(areMatricesEqual(target.matrix, m2)).toEqual(true);
                });
            });
        }
    });

    describe('should be able to modify the input type safely', () => {
        for (let i = 0; i < 50; i++) {
            describe(`suite ${i}`, () => {
                let f1 = null;
                let f2 = null;

                let m1 = null;
                let m2 = null;

                let pt1 = null;
                let pt2 = null;

                let q1 = null;
                let q2 = null;

                beforeAll(() => {
                    f1 = new THREE.Matrix4();
                    randomFrame(f1);

                    f2 = new THREE.Matrix4();
                    randomFrame(f2);

                    m1 = new THREE.Matrix4();
                    m2 = new THREE.Matrix4();
                    randomFrame(m1);

                    pt1 = new THREE.Vector3();
                    pt2 = new THREE.Vector3();
                    randomVector(pt1);

                    q1 = new THREE.Quaternion();
                    q2 = new THREE.Quaternion();
                    randomQuaternion(q1);
                });

                it('point transform', () => {
                    pt2.copy(pt1);
                    FrameTransformer.transformPoint(f1, f2, pt2, pt2);
                    FrameTransformer.transformPoint(f2, f1, pt2, pt2);

                    expect(isVectorCloseTo(pt1, pt2)).toEqual(true);
                });

                it('direction transform', () => {
                    pt2.copy(pt1);
                    FrameTransformer.transformDirection(f1, f2, pt2, pt2);
                    FrameTransformer.transformDirection(f2, f1, pt2, pt2);

                    expect(isVectorCloseTo(pt1, pt2)).toEqual(true);
                });

                it('quaternion transform', () => {
                    q2.copy(q1);
                    FrameTransformer.transformQuaternion(f1, f2, q2, q2);
                    FrameTransformer.transformQuaternion(f2, f1, q2, q2);

                    expect(isQuaternionCloseTo(q1, q2)).toEqual(true);
                });

                it('frame transform', () => {
                    m2.copy(m1);
                    FrameTransformer.transformFrame(f1, f2, m2, m2);
                    FrameTransformer.transformFrame(f2, f1, m2, m2);

                    expect(areMatricesEqual(m1, m2)).toEqual(true);
                });
            });
        }
    });
});
