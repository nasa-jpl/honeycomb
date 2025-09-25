import type { DataFrame } from "@grafana/data";
import { Euler, Quaternion, QuaternionLike } from 'three';

import {
    Orientation, OrientationConvention, SceneObject
} from "@gov.nasa.jpl.honeycomb/core";

import {
    KinematicsAnimator,
    KinematicState,
    RobotState
} from "@gov.nasa.jpl.honeycomb/telemetry-animator";

import { AnimatedKinematicChannel } from "./AnimatedKinematicChannel";

import { HoneycombPanelOptions } from "../types";
import { aggregateTimes, AnimatedValue, TimeAggregation } from "./AnimatedChannel";
import { GrafanaAnimator } from "./GrafanaAnimator";

const eulerXYZ = new Euler();
const q = new Quaternion();

// TODO(tumbar) Fix interpolation here. We are doing lerp on fields in the quat instead of slerping the whole quat
export class AnimatedQuaternion implements AnimatedValue<QuaternionLike> {
    private x: AnimatedKinematicChannel;
    private y: AnimatedKinematicChannel;
    private z: AnimatedKinematicChannel;
    private w: AnimatedKinematicChannel;

    constructor(orientation: Orientation) {
        this.x = new AnimatedKinematicChannel(orientation.x);
        this.y = new AnimatedKinematicChannel(orientation.y);
        this.z = new AnimatedKinematicChannel(orientation.z);
        this.w = new AnimatedKinematicChannel(orientation.w);
    }

    data(data: DataFrame[]) {
        this.x.data(data);
        this.y.data(data);
        this.z.data(data);
        this.w.data(data);
    }

    at(time: number): QuaternionLike {
        return {
            x: this.x.at(time),
            y: this.y.at(time),
            z: this.z.at(time),
            w: this.w.at(time),
        };
    }

    timeOfData(aggregateMethod: TimeAggregation): number {
        return aggregateTimes(
            aggregateMethod,
            this.x.timeOfData(),
            this.y.timeOfData(),
            this.z.timeOfData(),
            this.w.timeOfData()
        );
    }
}

export class AnimatedEuler implements AnimatedValue<QuaternionLike> {
    private x: AnimatedKinematicChannel;
    private y: AnimatedKinematicChannel;
    private z: AnimatedKinematicChannel;

    constructor(orientation: Orientation) {
        this.x = new AnimatedKinematicChannel(orientation.x);
        this.y = new AnimatedKinematicChannel(orientation.y);
        this.z = new AnimatedKinematicChannel(orientation.z);
    }

    data(data: DataFrame[]) {
        this.x.data(data);
        this.y.data(data);
        this.z.data(data);
    }

    timeOfData(aggregateMethod: TimeAggregation): number {
        return aggregateTimes(
            aggregateMethod,
            this.x.timeOfData(),
            this.y.timeOfData(),
            this.z.timeOfData(),
        );
    }

    at(time: number): QuaternionLike {
        eulerXYZ.set(
            this.x.at(time),
            this.y.at(time),
            this.z.at(time)
        );

        q.setFromEuler(eulerXYZ);

        return {
            x: q.x,
            y: q.y,
            z: q.z,
            w: q.w,
        };
    }
}

export class AnimatedRobot implements AnimatedValue<RobotState> {
    private x: AnimatedKinematicChannel;
    private y: AnimatedKinematicChannel;
    private z: AnimatedKinematicChannel;
    private orientation: AnimatedValue<QuaternionLike>;

    name: string;
    id: string;

    joints: Record<string, AnimatedKinematicChannel>;

    state: RobotState;

    constructor(obj: SceneObject) {
        this.x = new AnimatedKinematicChannel(obj.position.x);
        this.y = new AnimatedKinematicChannel(obj.position.y);
        this.z = new AnimatedKinematicChannel(obj.position.z);
        this.id = obj.id;
        this.name = obj.name;

        if (obj.joints) {
            this.joints = Object.fromEntries(Object.entries(obj.joints).map(([jointName, channel]) => ([
                jointName,
                new AnimatedKinematicChannel(channel)
            ])));
        } else {
            this.joints = {};
        }

        switch (obj.orientation.type) {
            case OrientationConvention.rpy:
                this.orientation = new AnimatedEuler(obj.orientation);
                break;
            case OrientationConvention.hamilton:
            case OrientationConvention.jpl: // TODO(tumbar) Do I actually need anything here?
                this.orientation = new AnimatedQuaternion(obj.orientation);
                break;
        }

        this.state = {} as RobotState;
    }

    data(data: DataFrame[]): void {
        this.x.data(data);
        this.y.data(data);
        this.z.data(data);

        this.orientation.data(data);

        Object.values(this.joints).map(joint => joint.data(data));
    }

    timeOfData(aggregateMethod: TimeAggregation): number {
        return aggregateTimes(
            aggregateMethod,
            this.x.timeOfData(),
            this.y.timeOfData(),
            this.z.timeOfData(),
            this.orientation.timeOfData(aggregateMethod),
            ...Object.values(this.joints).map(v => v.timeOfData())
        );
    }

    at(time: number): RobotState {
        this.state.x = this.x.at(time);
        this.state.y = this.y.at(time);
        this.state.z = this.z.at(time);

        const orientation = this.orientation.at(time);
        this.state.qx = orientation.x;
        this.state.qy = orientation.y;
        this.state.qz = orientation.z;
        this.state.qw = orientation.w;

        if (orientation.x === 0 && orientation.y === 0 && orientation.z === 0 && orientation.w === 0) {
            //console.log('obj has bad quaternion', this.name);
            this.state.qw = 1;
        }

        for (const [jointName, joint] of Object.entries(this.joints)) {
            this.state[jointName] = joint.at(time);
        }

        return this.state;
    }

    getStartTime(): number | undefined {
        const xStartTime = this.x.getStartTime();
        const yStartTime = this.y.getStartTime();
        const zStartTime = this.z.getStartTime();
        if (xStartTime && yStartTime && zStartTime) {
            return Math.min(xStartTime, yStartTime, zStartTime);
        }
        return undefined;
    }

    getEndTime(): number | undefined {
        const xEndTime = this.x.getEndTime();
        const yEndTime = this.y.getEndTime();
        const zEndTime = this.z.getEndTime();
        if (xEndTime && yEndTime && zEndTime) {
            return Math.max(xEndTime, yEndTime, zEndTime);
        }
        return undefined;
    }
}

export class GrafanaKinematicsAnimator extends GrafanaAnimator<KinematicState> implements KinematicsAnimator {
    kinematics?: Record<string, AnimatedRobot>;
    private lastData?: DataFrame[];

    options(options: HoneycombPanelOptions): void {
        // Rebuild the kinematic tree
        this.kinematics = {};
        for (const obj of options.scene) {
            this.kinematics[obj.id] = new AnimatedRobot(obj);
        }

        if (this.lastData) {
            Object.values(this.kinematics).map(v => v.data(this.lastData!));
        }

        this._step(0);
    }

    data(data: DataFrame[]) {
        this.lastData = data;

        if (this.kinematics) {
            // Pass the data to all the robots
            Object.values(this.kinematics).map((r) => r.data(data));
            this._step(0);
        }
    }

    at(time: number): KinematicState {
        if (!this.kinematics) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(
                this.kinematics
            ).map(([objId, obj]) => [objId, obj.at(time)])
        );
    }
}
