import { Matrix4, Vector3, Quaternion } from 'three';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';

/**
 * @typedef {Object} RosTimeStamp
 * Timestamp as reported from a ROS node. In some libraries it's reported as "sec"
 * in others it's repoted as "secs". Only only version is expected on the object.
 *
 * @param {Number} [secs]
 * @param {Number} [nsecs]
 *
 * @param {Number} [sec]
 * @param {Number} [nsec]
 */

/**
 * @typedef {Object} RosFrame
 * Data representing a ROS Frame. Some libraries report the frame with a position /
 * orientation pair while others report translation / rotation. Only one version is
 * expected.
 *
 * @param {Array<Number>} [position]
 * @param {Array<Number>} [orientation]
 *
 * @param {Array<Number>} [translation]
 * @param {Array<Number>} [rotation]
 */


/**
 * Returns a number > 0 if a is larger than b, 0 if they're equal,
 * a negative number if a is less than b.
 * @param {RosTimeStamp} a
 * @param {RosTimeStamp} b
 */
function compareTimeStamps(a, b) {
    // the time stamp is reported as `secs` ros and `sec` with rosbagjs
    // See issue #430
    const asec = 'secs' in a ? a.secs : a.sec;
    const ansec = 'secs' in a ? a.nsecs : a.nsec;

    const bsec = 'secs' in b ? b.secs : b.sec;
    const bnsec = 'secs' in b ? b.nsecs : b.nsec;

    return asec === bsec ? ansec - bnsec : asec - bsec;
}

const worldFrame = new Matrix4().identity();
const currentFrame = new Matrix4();
const matrix = new Matrix4();
const sca = new Vector3(1, 1, 1);
const pos = new Vector3();
const rot = new Quaternion();

/**
 * Gets the position and orientation of frame `rosFrame` in `toTransform`.
 * @param {RosFrame} toTransform
 * @param {RosFrame} rosFrame
 * @param {Vector3} posOut
 * @param {Vector4} rotOut
 * @returns {void}
 */
function getInFrame(toTransform, rosFrame, posOut, rotOut) {
    const tr = 'position' in rosFrame ? rosFrame.position : rosFrame.translation;
    const rt = 'orientation' in rosFrame ? rosFrame.orientation : rosFrame.rotation;
    Object.assign(pos, tr);
    Object.assign(rot, rt);
    sca.set(1, 1, 1);
    currentFrame.compose(
        pos,
        rot,
        sca,
    );

    const tgTransform = 'position' in toTransform ? toTransform.position : toTransform.translation;
    const tgRotation =
        'orientation' in toTransform ? toTransform.orientation : toTransform.rotation;

    Object.assign(pos, tgTransform);
    Object.assign(rot, tgRotation);
    sca.set(1, 1, 1);
    matrix.compose(
        pos,
        rot,
        sca,
    );

    FrameTransformer.transformFrame(currentFrame, worldFrame, matrix, matrix);
    matrix.decompose(pos, rot, sca);

    posOut.x = pos.x;
    posOut.y = pos.y;
    posOut.z = pos.z;

    rotOut.x = rot.x;
    rotOut.y = rot.y;
    rotOut.z = rot.z;
    rotOut.w = rot.w;
}

export { compareTimeStamps, getInFrame };
