import { Group, Matrix4, Vector3, Quaternion } from 'three';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { compareTimeStamps } from './utils';

const parentMat = new Matrix4();
const childMat = new Matrix4();

// For _getFrameAtTime
const tempMat = new Matrix4();
const tempPos = new Vector3();
const tempQuat = new Quaternion();
const tempSca = new Vector3(1, 1, 1);

// For getWorldPoseAtTime
const tempMat3 = new Matrix4();
const tempPos3 = new Vector3();
const tempQuat3 = new Quaternion();
const tempSca3 = new Vector3(1, 1, 1);

/**
 * An abstract base class for tracking and extracting ros transforms over time.
 */
export class RosTransformTrackerBase {
    _rootFrame: Group;
    _frames: any | null;
    _frameMatricesNeedUpdate: boolean;

    constructor() {
        this._rootFrame = new Group();
        this._frames = null;
        this._frameMatricesNeedUpdate = false;

        this.reset();
    }

    /* Public API */
    /**
     * Reset all the transform information to start from scratch. If `resetStatic` is true
     * then static frames are also reset.
     * @param {Boolean} [resetStatic=true]
     * @returns {void}
     */
    reset(resetStatic: boolean = true): void {
        if (resetStatic) {
            this._rootFrame = new Group();
            this._frames = {};
            this._frameMatricesNeedUpdate = false;
        } else {
            const frames = this._frames;
            for (const name in frames) {
                if (frames[name].static !== true) {
                    const frame = frames[name];
                    frame.parent.remove(frame);
                    delete frames[name];
                }
            }
        }
    }

    /**
     * Apply a tf message to the tracked transforms. If the message timestamp is earlier
     * than the last applied message to a certain transform then it is skipped.
     * @param {RosTfMessage} msg
     * @param {('/tf'|'/tf_static')} topic
     * @returns {void}
     */
    applyMessage(msg: any, topic: ('/tf' | '/tf_static')): void {
        const transforms = msg.transforms;
        const markStatic = topic === '/tf_static';

        for (const key in transforms) {
            const data = transforms[key];
            this._applyTransformData(data, markStatic);
        }

        this._frameMatricesNeedUpdate = true;
    }

    /**
     * Set "matrix" to the transform of the given frame relative to the root at the requested time. Returns
     * true if the frame can be derived, false otherwise.
     * @param {string} name
     * @param {Matrix4} matrix
     * @param {(RosTimeStamp|null)} [time=null]
     * @returns {Boolean}
     */
    getTransformInRootFrame(name: string, matrix: Matrix4, time: (any | null) = null): boolean {
        this._updateMatrices();

        const frames = this._frames;
        const frame = frames[name];
        if (!frame) {
            return false;
        } else if (time === null)  {
            matrix.copy(frame.matrixWorld);
            return true;
        } else {
            if (!this._getFrameAtTime(name, time, matrix)) {
                matrix.copy(frame.matrixWorld);
                return false;
            }
            return true;
        }
    }

    /**
     * Matrix is a transform matrix relative to the frame called `fromFrame`. `matrix`
     * is modified to be relative to the frame called `toFrame`. If `time` is provided
     * then it is relative to those frames at that given time which is derived by
     * looking back through the available frames.
     *
     * Returns `false` if the requested frames could not be located in the available
     * lookback transform messages.
     * @param {string} fromFrame
     * @param {string} toFrame
     * @param {Matrix4} matrix
     * @param {(RosTimeStamp|null)} [time=null]
     * @returns {Boolean}
     */
    getTransformInFrame(fromFrame, toFrame, matrix, time = null) {
        this._updateMatrices();

        const frames = this._frames;
        if (time === null) {
            const parentFrame = frames[toFrame];
            const childFrame = frames[fromFrame];

            // TODO: This can be optimized if the matrix gets
            // zeroed out and the given frame is the parent or
            // root frame because then we can just copy the matrix.
            const fromMat = childFrame.matrixWorld;
            const toMat = parentFrame.matrixWorld;
            FrameTransformer.transformFrame(fromMat, toMat, matrix, matrix);
            return true;
        } else {
            // TODO: we could run into a case here where a transform is being seeked for
            // but it hasn't been created, yet
            if (!(toFrame in frames) || !(fromFrame in frames)) {
                return false;
            }

            let success = true;
            if (!this._getFrameAtTime(fromFrame, time, childMat)) {
                childMat.copy(frames[fromFrame].matrixWorld);
                success = false;
            }
            if (!this._getFrameAtTime(toFrame, time, parentMat)) {
                parentMat.copy(frames[toFrame].matrixWorld);
                success = false;
            }
            FrameTransformer.transformFrame(childMat, parentMat, matrix, matrix);
            return success;
        }
    }

    /**
     * Outputs the position and rotation of the frame with the given name at the given
     * ROS time. The position data is put on the `outPos` object and rotation on
     * `outRot`. The `x`, `y`, `z`, and `w` (for rotation) fields will be added if
     * they're not available.
     *
     * Returns false if the time frame could not be found. True if it was found
     * successfully.
     * @param {String} name
     * @param {RosTimeStamp} time
     * @param {Vector3} outPos
     * @param {Vector4} outRot
     * @returns {Boolean}
     */
    getWorldPoseAtTime(name, time, outPos, outRot) {
        const frames = this._frames;
        if (name === '') {
            outPos.x = 0;
            outPos.y = 0;
            outPos.z = 0;

            outRot.x = 0;
            outRot.y = 0;
            outRot.z = 0;
            outRot.w = 1;
            return true;
        }

        if (!(name in frames)) {
            return false;
        }

        const res = this._getFrameAtTime(name, time, tempMat3);
        tempMat3.decompose(tempPos3, tempQuat3, tempSca3);

        outPos.x = tempPos3.x;
        outPos.y = tempPos3.y;
        outPos.z = tempPos3.z;

        outRot.x = tempQuat3.x;
        outRot.y = tempQuat3.y;
        outRot.z = tempQuat3.z;
        outRot.w = tempQuat3.w;
        return res;
    }

    /**
     * Returns the name of te parent of the provided frame. Returns null
     * if the frame does not exist or it has no parent.
     * @param {String} name
     * @returns {(String|null)}
     */
    getParentName(name) {
        const frames = this._frames;

        if (name in frames) {
            const childFrame = frames[name];
            if (childFrame.parent === null) {
                return null;
            } else {
                return childFrame.parent.name;
            }
        } else {
            return null;
        }
    }

    /* Interface */
    /**
     * Overrideable function that should iterate over the frames back in time starting
     * at the last applied message passing an object that looks like so into the
     * callback function `cb`:
     *
     * ```
     * {
     *     '/tf' : RosTfMessage,
     *     '/tf_static : RosTfMessage
     * }
     * ```
     *
     * If `cb` returns `true` the iteration should stop.
     * @param {Function} cb
     * @returns {void}
     */
    seekBack(cb) {
        throw new Error('Not Implemented');
    }

    /* Private */
    _updateMatrices() {
        if (this._frameMatricesNeedUpdate) {
            this._rootFrame.updateMatrixWorld(true);
            this._frameMatricesNeedUpdate = false;
        }
    }

    // Gets the position of the given frame in the global frame at a point in time.
    _getFrameAtTime(name, time, targetMat) {
        this._updateMatrices();

        const frames = this._frames;

        // track the stack of found parent transforms
        const stack: any[] = [];
        let lookingFor = name;

        // walk backwards from the current time
        this.seekBack(state => {
            const tf = state['/tf'];
            if (tf) {
                // if we found the transform in this frame
                const transforms = tf.transforms;

                for (const key in transforms) {
                    const msg = transforms[key];
                    if (msg.child_frame_id !== lookingFor) continue;

                    // and its before the requested time then we found
                    // the transform.
                    const newTime = msg.header.stamp;
                    if (compareTimeStamps(newTime, time) < 0) {
                        stack.unshift({
                            translation: msg.transform.translation,
                            rotation: msg.transform.rotation,
                            name: lookingFor,
                        });
                        lookingFor = msg.header.frame_id;
                        time = newTime;
                    }

                    break;
                }
            }

            // if a frame is static then we can just add it at the current time because it won't
            // have moved. Similarly if we're awaiting a creation message for a tf still (meaning
            // it could be an implicit frame that's only been referenced as a parent) we add it
            // and stop looking because won't know it's parent frame and assume it to be fixed.
            while (frames[lookingFor].static || frames[lookingFor].awaitingCreationMessage) {
                const frame = frames[lookingFor];
                stack.unshift({
                    translation: frame.position,
                    rotation: frame.quaternion,
                    name: lookingFor,
                });

                // look for the parent frame next
                if (frame.parent && !frame.awaitingCreationMessage) {
                    lookingFor = frame.parent.name;
                } else {
                    return true;
                }
            }
        });

        // If we weren't able to walk all the way up to the world frame
        // then assume we weren't able to find the transform and return false.
        if (stack.length === 0) {
            return false;
        } else {
            // Apply all transformations to get up to the world matrix.
            tempSca.set(1, 1, 1);
            targetMat.identity();
            for (let i = 0, l = stack.length; i < l; i++) {
                const data = stack[i];
                const translation = data.translation;
                const rotation = data.rotation;
                tempPos.x = translation.x;
                tempPos.y = translation.y;
                tempPos.z = translation.z;

                tempQuat.x = rotation.x;
                tempQuat.y = rotation.y;
                tempQuat.z = rotation.z;
                tempQuat.w = rotation.w;

                tempMat.compose(
                    tempPos,
                    tempQuat,
                    tempSca,
                );
                targetMat.multiply(tempMat);
            }
            return true;
        }
    }

    _applyTransformData(msg, markStatic = false) {
        const frames = this._frames;
        const rootFrame = this._rootFrame;
        const childName = msg.child_frame_id;
        const parentName = msg.header.frame_id;

        // Create the objects if they haven't been created yet
        if (!(parentName in frames)) {
            const group = new Group() as any;
            group.name = parentName;
            group.static = false;
            group.awaitingCreationMessage = true;
            group.stamp = { sec: -1, nsec: -1 };
            rootFrame.add(group);
            frames[parentName] = group;
        }

        if (!(childName in frames)) {
            const group = new Group() as any;
            group.name = childName;
            group.static = false;
            group.stamp = { sec: -1, nsec: -1 };
            frames[parentName].add(group);
            frames[childName] = group;
        }

        // Update the parent assuming that the parent should never change
        // it's possible that a child transform was called and created first
        const childFrame = frames[childName];
        const parentFrame = frames[parentName];

        if (childFrame.awaitingCreationMessage) {
            delete childFrame.awaitingCreationMessage;
            childFrame.static = markStatic;
        }

        if (parentFrame !== childFrame.parent) {
            parentFrame.add(childFrame);
        }

        // update the local transform
        const stamp = msg.header.stamp;
        if (compareTimeStamps(childFrame.stamp, stamp) < 0) {
            const transform = msg.transform;
            const pos = transform.translation;
            const rot = transform.rotation;
            childFrame.position.set(pos.x, pos.y, pos.z);
            childFrame.quaternion.set(rot.x, rot.y, rot.z, rot.w).normalize();
            childFrame.static = markStatic;

            // rosbagjs reports the data as "sec" while ros reports it as "secs" in the timestamp
            // See issue #430
            childFrame.stamp.sec = 'secs' in stamp ? stamp.secs : stamp.sec;
            childFrame.stamp.nsec = 'secs' in stamp ? stamp.nsecs : stamp.nsec;
        }
    }
}
