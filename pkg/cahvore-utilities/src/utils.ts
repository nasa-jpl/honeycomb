import { CameraDefinition } from '@gov.nasa.jpl.honeycomb/camera-loader';

import { cmod_cahv_2d_to_3d, cmod_cahvore_2d_to_3d_general, cmod_cahvor_2d_to_3d } from './cahvore';
import { Vector3, Ray, Plane, Matrix4, Vector2 } from 'three';

// CAHVORE Camera Frame
// X-----.
//      /|
//    Z  |
//       Y
//
// THREE.js Camera Frame
//       Y
//       |   Z
//       | /
// X-----.

/**
 * Returns the outgoing ray from the camera model given an image sample coordinate. Internally calls
 * the appropriate camera model to ray function.
 * @param {CameraDefinition} model
 * @param {Vector2} sample
 * @param {Ray} outRay
 */
export function getRay(model: CameraDefinition, sample: Vector2, outRay: Ray) {
    switch (model.type) {
        case 'CAHVORE':
            cmod_cahvore_2d_to_3d_general(
                sample,
                model.linearity,
                model.C,
                model.A,
                model.H,
                model.V,
                model.O,
                model.R,
                model.E,
                outRay.origin,
                outRay.direction,
            );
            break;
        case 'CAHVOR':
            cmod_cahvor_2d_to_3d(
                sample,
                model.C,
                model.A,
                model.H,
                model.V,
                model.O,
                model.R,
                outRay.origin,
                outRay.direction,
            );
            break;
        case 'CAHV':
            cmod_cahv_2d_to_3d(
                sample,
                model.C,
                model.A,
                model.H,
                model.V,
                outRay.origin,
                outRay.direction,
            );
            break;
        default:
            throw new Error(`CAHVOR Utilities: Model type ${JSON.stringify(model)} not supported.`);
    }
}

// Get the square bounds in the provided frame at the provided distance from the
// origin of the camera model.
const _plane = new Plane();
const _ray = new Ray();
const _vec = new Vector3();
function getBoundsAtZDistance(model: CameraDefinition, invFrame: Matrix4, distance: number) {

    // In the CAHVORE frame "up" is negative
    const minBounds = {
        left: - Infinity, bottom: Infinity,
        right: Infinity, top: - Infinity,
    };
    const maxBounds = {
        left: Infinity, bottom: - Infinity,
        right: - Infinity, top: Infinity,
    };

    const { width, height } = model;
    for (let x = 0; x <= 1.0; x += 0.5) {

        for (let y = 0; y <= 1.0; y += 0.5) {

            _vec.set(width * x, height * y, 0.0);
            getRay(model, new Vector2(_vec.x, _vec.y), _ray);
            _ray.applyMatrix4(invFrame);

            _plane.normal.set(0, 0, - 1);
            _plane.constant = distance;
            _ray.intersectPlane(_plane, _vec);

            if (x < 0.5) {

                minBounds.left = Math.max( minBounds.left, _vec.x );
                maxBounds.left = Math.min( maxBounds.left, _vec.x );

            } else if (x > 0.5) {

                minBounds.right = Math.min( minBounds.right, _vec.x );
                maxBounds.right = Math.max( maxBounds.right, _vec.x );

            }

            if (y < 0.5) {

                minBounds.top = Math.max( minBounds.top, _vec.y );
                maxBounds.top = Math.min( maxBounds.top, _vec.y );

            } else if (y > 0.5) {

                minBounds.bottom = Math.min( minBounds.bottom, _vec.y );
                maxBounds.bottom = Math.max( maxBounds.bottom, _vec.y );

            }

        }

    }

    return { minBounds, maxBounds };

}

const _xAxis = new Vector3();
const _yAxis = new Vector3();
const _zAxis = new Vector3();

export interface FrameBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface LinearFrustumInfo {
    /**
     * The transformation frame of the linear camera model frustums. Equivalent to "Camera.matrix".
     */
    frame: Matrix4;

    /**
     * The bounds that are completely encompassed the cahvore model at the minimal extents 1m out in
     * the given frame.
     */
    minFrameBounds: FrameBounds;

    /**
     * The bounds that completely encompass the cahvore model at the maximum extents 1m out in
     * the given frame.
     */
    maxFrameBounds: FrameBounds;
}

/**
 * Function takes a camera model and returns an object describing the resulting local camera frame
 * and minimum and maximum frustums.
 * @param {CameraDefinition} model
 * @returns {LinearFrustumInfo}
 */
export function getLinearFrustumInfo(model: CameraDefinition): LinearFrustumInfo {
    const { C, A, H, V } = model;

    _zAxis.copy(A).normalize();
    _xAxis.copy(H).addScaledVector(A, -A.dot(H)).normalize();
    _yAxis.copy(V).addScaledVector(A, -A.dot(V)).normalize();

    const frame = new Matrix4();
    frame.makeBasis(_xAxis, _yAxis, _zAxis).setPosition(C);

    const invFrame = new Matrix4();
    invFrame.copy(frame).invert();

    // project the frustum shape to get the bounds. Use a large distance to ensure the bounds are encpsulated
    // further out as rays diverge.
    const projectionDistance = 100;
    const nearBounds = getBoundsAtZDistance(model, invFrame, projectionDistance);

    // Produce a min and max frustum projection matrix
    // Three.js projection matrices are negative Z forward
    const { minBounds, maxBounds } = nearBounds;

    // we invert the top and bottom values because the Y value is flipped once
    // the camera is flipped
    minBounds.left /= projectionDistance;
    minBounds.right /= projectionDistance;
    minBounds.bottom /= - projectionDistance;
    minBounds.top /= - projectionDistance;

    maxBounds.left /= projectionDistance;
    maxBounds.right /= projectionDistance;
    maxBounds.bottom /= - projectionDistance;
    maxBounds.top /= - projectionDistance;

    // The three.js camera forward is along -Z while the cahvore forward is along +Z
    _yAxis.multiplyScalar(-1);
    _zAxis.multiplyScalar(-1);

    // rotation frame
    frame.makeBasis(_xAxis, _yAxis, _zAxis).setPosition(C);

    return {
        minFrameBounds: minBounds,
        maxFrameBounds: maxBounds,
        frame,
    };
}

/**
 * Function that takes a frame bounds description of a bounding box 1m out in the camera frame
 * and sets the "target" matrix to an off axis projection matrix with the apex at the current origin.
 * @param {FrameBounds} frameBounds
 * @param {Number} near
 * @param {Number} far
 * @param {Matrix4} target
 * @returns {Matrix4}
 */
export function frameBoundsToProjectionMatrix(frameBounds: FrameBounds, near: number, far: number, target: Matrix4): Matrix4 {
    let { left, right, top, bottom } = frameBounds;
    left *= near;
    right *= near;
    top *= near;
    bottom *= near;

    return target.makePerspective(
        left, right,
        top, bottom,
        near, far,
    );
}
