import { Color, Group, Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { lerp } from 'three/src/math/MathUtils.js';

import { Driver, Scene, Viewer } from "@gov.nasa.jpl.honeycomb/core";
import { KinematicState } from "@gov.nasa.jpl.honeycomb/telemetry-animator";
import { LineAnnotation } from '@gov.nasa.jpl.honeycomb/telemetry-primitives';

import { FrameTrajectoriesOptions, FrameTrajectoryField } from "../types";
import { AnimatedRobot, GrafanaKinematicsAnimator } from "./KinematicsAnimator";

const tempVec3a = new Vector3();
const tempVec3b = new Vector3();
const tempVec3c = new Vector3();
const tempQuat = new Quaternion();
const tempMat4a = new Matrix4();
const tempMat4b = new Matrix4();

export class FrameTrajectoriesDriver extends Driver<{ kinematics: KinematicState }> {
    container: Group;
    drivePaths: Record<string, LineAnnotation>;
    frameTrajectories: FrameTrajectoryField[];
    timeStep: number;
    renderOrder: number;
    scene: Scene;

    constructor(readonly viewer: Viewer, readonly kinematicsAnimator: GrafanaKinematicsAnimator) {
        super();
        this.container = new Group();
        this.container.name = 'Drive Paths';
        this.drivePaths = {};
        this.frameTrajectories = [];
        this.scene = [];
        this.timeStep = 1000;
        this.renderOrder = 0;
        this.viewer.world.add(this.container);
    }

    update(): void { }

    set(frameTrajectoriesOptions: FrameTrajectoriesOptions) {
        this.frameTrajectories = frameTrajectoriesOptions.frameTrajectories;
        if (frameTrajectoriesOptions.timeStep < 33) {
            console.warn('Frame Trajectories timestamp cannot go below 33ms for performance reasons');
        } else if (isNaN(frameTrajectoriesOptions.timeStep)) {
            console.warn('Frame Trajectories timestamp cannot be NaN');
        } else {
            this.timeStep = frameTrajectoriesOptions.timeStep;
        }
        this.renderOrder = frameTrajectoriesOptions.renderOrder;
    }

    setScene(scene: Scene) {
        this.scene = scene;
    }

    reload() {
        if (!this.kinematicsAnimator.kinematics || !this.frameTrajectories) {
            return;
        }

        const timeStep = this.timeStep;

        Object.entries(this.kinematicsAnimator.kinematics).forEach(([objId, obj]) => {
            const key = objId;

            // check if this animated robot is one for which we need to visualize its trajectory
            const foundFrameTrajectoryField = this.frameTrajectories.find(f => f.frame === key);
            if (!foundFrameTrajectoryField) {
                if (key in this.drivePaths) {
                    this.drivePaths[key].visible = false;
                    // console.log(`removing ${obj.name} since not found in list of frames anymore to track their trajectory...`);
                } else {
                    // console.log(`skipping ${obj.name} since not found in list of frames to track their trajectory...`);
                }
                return;
            }

            // the start and end time is determined by this animated robot's start/end time
            // as well as any start/end times in the parents of this robot
            let startTime = obj.getStartTime();
            let endTime = obj.getEndTime();

            const sceneObject = this.scene.find(so => so.id === key);
            const parentAnimatedFrames: AnimatedRobot[] = [];
            let currentSceneObject = sceneObject;

            // gather the parent frames (animated robots) and also update the start and end times
            while (currentSceneObject?.parent) {
                currentSceneObject = this.scene.find(so => so.id === currentSceneObject?.parent);
                if (this.kinematicsAnimator.kinematics && currentSceneObject?.id) {
                    const animatedRobot = this.kinematicsAnimator.kinematics[currentSceneObject?.id];
                    if (animatedRobot) {
                        // update start and end times appropriately
                        const sTime = animatedRobot.getStartTime();
                        const eTime = animatedRobot.getEndTime();
                        if (!startTime || (sTime && sTime < startTime)) {
                            startTime = sTime;
                        }
                        if (!endTime || (eTime && eTime < endTime)) {
                            endTime = eTime;
                        }

                        parentAnimatedFrames.push(animatedRobot);
                    } else {
                        console.warn(`could not find animated Robot for ${currentSceneObject?.id} (name ${currentSceneObject?.name})`, this.kinematicsAnimator.kinematics);
                    }
                }
            }

            if (!startTime || !endTime) {
                return;
            }

            // console.log(`${(endTime - startTime) / 1000 / 60} minutes covered`);

            // loop through all times, and add positions and colors
            const positions: number[] = [];
            const colors: number[] = [];
            const length = Math.floor((endTime - startTime) / timeStep);
            let i = 0;
            const startIntensity = 0.25;
            const endIntensity = 1;
            const color = new Color(foundFrameTrajectoryField.color);

            tempVec3a.set(1, 1, 1);

            // save the current time so that we can reset everything afterwards
            const currentTime = this.kinematicsAnimator.time * 1000;
            for (let t = startTime; t < endTime; t += timeStep) {
                const robotState = obj.at(t);
                const actualPosition = tempVec3b.set(robotState.x, robotState.y, robotState.z);

                // if we're not in the world frame, we need to apply the parents'
                // transforms in sequence to get the world position for the trajectory
                if (parentAnimatedFrames.length) {
                    const matrix = tempMat4a.identity();
                    parentAnimatedFrames.forEach(frame => {
                        const state = frame.at(t);
                        matrix.multiply(
                            tempMat4b.compose(
                                tempVec3c.set(state.x, state.y, state.z),
                                tempQuat.set(state.qx, state.qy, state.qz, state.qw),
                                tempVec3a
                            )
                        );
                    });
                    actualPosition.applyMatrix4(matrix);
                }

                positions.push(actualPosition.x, actualPosition.y, actualPosition.z);
                const c = lerp(startIntensity, endIntensity, i / length);
                colors.push(c * color.r, c * color.g, c * color.b);
                i++;
            }
            // reset the robot to the current time
            obj.at(currentTime);

            // reset all parent states
            parentAnimatedFrames.forEach(frame => {
                frame.at(currentTime);
            });

            if (positions.length > 0) {
                // add it if it doesn't exist
                if (!(key in this.drivePaths)) {
                    const material = new LineMaterial({
                        linewidth: 1, // in pixels
                        resolution: new Vector2(1000, 1000), // to be set by renderer, eventually
                        dashed: false,
                        vertexColors: true,
                        // we must set transparent=true so that the renderOrder works
                        // correctly to draw the drive paths on top of other annotations,
                        // such as a DataTextureAnnotation
                        transparent: true
                    });
                    const line = new LineAnnotation(material);
                    line.material.uniforms.resolution.value = this.viewer.resolution;
                    line.material.linewidth = 1.5;
                    this.container.add(line);
                    this.drivePaths[key] = line;
                }

                this.drivePaths[key].renderOrder = this.renderOrder;
                this.drivePaths[key].visible = true;
                this.drivePaths[key].setPositions(positions);
                this.drivePaths[key].geometry.setColors(colors);
            }
        });
    }
}
