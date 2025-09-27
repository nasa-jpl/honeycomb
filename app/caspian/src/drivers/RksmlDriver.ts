import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { Driver } from '@gov.nasa.jpl.honeycomb/core';
import { Group, Vector3, Vector2 } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineAnnotation } from '@gov.nasa.jpl.honeycomb/telemetry-primitives';
import { DisposableEventListeners } from '@gov.nasa.jpl.honeycomb/three-extensions';

function applyPosition(obj, state, map) {
    if (map.x in state) obj.position.x = state[map.x];
    if (map.y in state) obj.position.y = state[map.y];
    if (map.z in state) obj.position.z = state[map.z];

    let updatedQuat = false;
    if (map.qx in state && map.qy in state && map.qz in state && map.qw in state) {
        obj.quaternion.set(state[map.qx], state[map.qy], state[map.qz], state[map.qw]);
        updatedQuat = true;
    }

    return map.x in state || map.y in state || map.z in state || updatedQuat;
}

function applyJointAngles(robot, state, jointMap) {
    const newState = {};
    for (const key in state) {
        let name = key;
        if (name in jointMap) {
            name = jointMap[name];
        }

        newState[name] = state[key];
    }
    robot.setJointValues(newState);
}

function applyJointVisibility(robot, state, jointVisMap) {
    for (const link in jointVisMap) {
        const option = jointVisMap[link];
        const stateVal = option.replace(/^!/, '');
        const inverted = /^!/.test(option);

        if (stateVal in state) {
            robot.frames[link].visible = inverted !== Boolean(state[stateVal]);
        }
    }
}

export class RksmlDriver extends Driver<any> {
    constructor(options, manager) {
        super(manager, options);

        this.options = Object.assign(
            {
                robot: 'robot',
                telemetry: '',
                jointMap: {},
                jointVisibilityMap: {},
                jointPositionMap: {},
                positionMap: {},
                paths: [],
                pathsColor: '#26a69a',
            },
            options,
        );

        this.type = 'RksmlDriver';
        this.isRksmlDriver = true;
        this.updateOrder = -1;
        this.listeners = new DisposableEventListeners();
    }

    initialize() {
        const viewer = this.viewer;
        const listeners = this.listeners;
        this._robotPath = null;

        const updateDrivePath = () => {
            const animator = viewer.getAnimator(this.options.telemetry);
            const robot = viewer.getRobot(this.options.robot);

            if (robot && animator) {
                const options = this.options;
                const paths = options.paths;
                const jointMap = options.jointMap;
                const positionMap = options.positionMap;
                const pathsColor = options.pathsColor;

                // NOTE: "updateWorldMatrix" is an undocumented function that can update both parent and child
                // world matrices. The function signature looks like "updateWorldMatrix(updateParent, updateChildren)".
                // Updating only the parents up the robot tree is faster than updating all the joint matrices.
                // https://github.com/mrdoob/three.js/pull/6448#issuecomment-95624064
                const container = new Group();
                container.name = 'Drive Path';
                const vec = new Vector3();
                const material = new LineMaterial({
                    color: 0xffffff,
                    linewidth: 1, // in pixels
                    resolution: new Vector2(1000, 1000), // to be set by renderer, eventually
                    dashed: false,
                });

                for (const i in paths) {
                    let posInitialized = false;
                    const name = paths[i];
                    const positions = [];
                    animator
                        .forEachFrame(state => {
                            const frame = robot.frames[name];
                            applyJointAngles(robot, state, jointMap);
                            if (applyPosition(robot, state, positionMap)) {
                                posInitialized = true;
                            }
                            frame.updateWorldMatrix(true, false);
                            vec.set(0, 0, 0);
                            FrameTransformer.transformPoint(
                                frame.matrixWorld,
                                viewer.world.matrixWorld,
                                vec,
                                vec,
                            );

                            if (posInitialized) {
                                positions.push(vec.x, vec.y, vec.z);
                            }
                        })
                        .then(() => {
                            if (positions.length > 0) {
                                const line = new LineAnnotation(material);
                                line.setPositions(positions);
                                line.material.uniforms.resolution.value = viewer.resolution;
                                line.material.color.set(pathsColor);
                                line.material.linewidth = 1.5;
                                container.add(line);
                            }
                        })
                        .catch(e => {
                            // TODO: how do we hand this off to the viewer to dispatch? Viewer.reportError(e)?
                            console.error('RKSMLDriver: Error generating joint paths.');
                            console.error(e);
                        });
                }
                viewer.world.add(container);
                viewer.tags.addTag(container, 'drive-tracks');
                this._robotPath = container;
                viewer.dirty = true;
            } else if (this._robotPath) {
                viewer.world.remove(this._robotPath);
                viewer.tags.removeObject(this._robotPath);
                this._robotPath.traverse(c => {
                    if (c.material) {
                        c.material.dispose();
                        c.geometry.dispose();
                    }
                });
                this._robotPath = null;
                viewer.dirty = true;
            }
        };

        const animatorCallback = e => {
            if (e.id === this.options.telemetry) {
                updateDrivePath();
            }
        };

        const robotCallback = e => {
            if (e.id === this.options.robot) {
                updateDrivePath();
            }
        };

        updateDrivePath();

        listeners.addEventListener(viewer, 'add-animator', animatorCallback);
        listeners.addEventListener(viewer, 'remove-animator', animatorCallback);

        listeners.addEventListener(viewer, 'add-robot', robotCallback);
        listeners.addEventListener(viewer, 'remove-robot', robotCallback);
    }

    dispose() {
        this.listeners.dispose();
        if (this._robotPath) {
            this._robotPath.traverse(c => {
                if (c.material) {
                    c.material.dispose();
                    c.geometry.dispose();
                }
            });
        }
    }

    update(state, diff) {
        const viewer = this.viewer;
        const positionMap = this.options.positionMap;
        const jointMap = this.options.jointMap;
        const jointVisibilityMap = this.options.jointVisibilityMap;
        const robot = viewer.getRobot(this.options.robot);
        const telemetryField = this.options.telemetry;
        const telemetryState = state && state[telemetryField];

        if (diff.didChange(telemetryField) && robot && telemetryState) {
            applyPosition(robot, telemetryState, positionMap);
            applyJointAngles(robot, telemetryState, jointMap);
            applyJointVisibility(robot, telemetryState, jointVisibilityMap);

            for (const name in this.options.jointPositionMap) {
                const map = this.options.jointPositionMap[name];
                const obj = robot.frames[name];
                applyPosition(obj, telemetryState, map);
            }
            robot.updateMatrixWorld(true);

            viewer.dirty = true;
        }
    }
}
