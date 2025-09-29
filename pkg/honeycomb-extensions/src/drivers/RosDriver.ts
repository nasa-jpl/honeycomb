import { Driver } from '@gov.nasa.jpl.honeycomb/core';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { RosAnimatorTransformTracker } from './RosAnimatorTransformTracker';
import { RosPointCloudTerrain, RenderMode } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import * as Annotations from '@gov.nasa.jpl.honeycomb/telemetry-primitives';
import { getInFrame } from '@gov.nasa.jpl.honeycomb/ros-transform-tracker';
import {
    Mesh,
    PlaneGeometry,
    DataTexture,
    UnsignedByteType,
    RGBAFormat,
    Vector3,
    MeshBasicMaterial,
    SRGBColorSpace,
    DoubleSide,
    ShaderLib,
    Color,
    PointsMaterial,
} from 'three';
import { LoadingManager } from '@gov.nasa.jpl.honeycomb/core';

const tempVec = new Vector3();
const RosTypeHandlers = {
    'nav_msgs/Path': function (topic, msg, options, data) {
        // TODO: Figure out how to support draw through here.
        if (!data.path) {
            const path = new Annotations.LineAnnotation();
            this.viewer.world.add(path);
            this.viewer.tags.addTag(path, 'drive-path');
            data.path = path;
        }

        const path = data.path;
        const positions: number[] = [];
        const poses = msg.poses;
        for (let i = 0, l = poses.length; i < l; i++) {
            const pose = poses[i].pose.position;
            positions.push(pose.x, pose.y, pose.z);
        }

        if (positions.length >= 6) {
            path.setPositions(positions);

            Object.assign(path.position, msg.header.translation);
            Object.assign(path.quaternion, msg.header.rotation);
            path.visible = msg.header.valid;

            if (options) {
                path.material.color.set(options.color || 0xffffff).convertSRGBToLinear();
                path.lineWidth = options.width || 1;
            }
        } else {
            path.visible = false;
        }
    },

    'move_base_msgs/MoveBaseActionGoal': function (topic, msg, options, data) {
        if (!data.goal) {
            const goal = new Annotations.SphereAnnotation(0.1);
            this.viewer.world.add(goal);
            data.goal = goal;
        }

        const goal = data.goal;
        const target_pose = msg.goal.target_pose;

        getInFrame(target_pose.pose, target_pose.header, goal.position, goal.quaternion);
        goal.visible = msg.header.valid;

        if (options) {
            // TODO: How can we avoid having to manually convert to linear?
            goal.material.color.set(options.color || 0xffffff).convertSRGBToLinear();
            goal.radius = options.radius || 0.1;
        }
    },

    'sensor_msgs/PointCloud2': function (topic, msg, options, data) {
        if (!data.pc) {
            options = {
                pointSize: 0.1,
                attenuate: true,
                colorChannelName: '',
                opacity: 1.0,
                ...options,
            };

            const terrain = new RosPointCloudTerrain(msg);
            terrain.name = topic;
            terrain.renderMode = RenderMode.POINTS;

            // TODO(tumbar) Fix color
            // const color = options.color || [0, 255, 0, 255];
            // terrain.setColor(new Color(color[0] / 255, color[1] / 255, color[2] / 255));

            const mat = terrain.points.material as PointsMaterial;
            mat.size = options.pointSize;
            mat.transparent = true;
            mat.alphaTest = 0;
            mat.opacity = options.opacity;

            // terrain.setColorChannelName(options.colorChannelName);
            // terrain.useRainbowColor = options.useRainbowColor;

            if (options.useWorldPointsShader) {
                // TODO: size attenuation doesn't seem to do anything for the world points shader
                mat.defines!.USE_SIZEATTENUATION = Number(options.attenuate);
            } else {
                mat.sizeAttenuation = options.attenuate;
            }

            if (options.renderOrder) {
                terrain.points.renderOrder = options.renderOrder;
            }
            terrain.traverse(c => {
                c.receiveShadow = true;
            });

            this.viewer.world.add(terrain);
            data.pc = terrain;

            const tags = options.tag ? ['pointcloud', options.tag] : ['pointcloud'];
            this.viewer.tags.addTag(terrain, tags);

            if (options.tag && options.visible === false) {
                this.viewer.toggle(options.tag, false);
            }
        }

        const terrain = data.pc;
        Object.assign(terrain.position, msg.header.translation);
        Object.assign(terrain.quaternion, msg.header.rotation);

        terrain.message = msg;
        terrain.update();
        terrain.visible = msg.header.valid;
    },

    'visualization_msgs/Marker': function (topic, msg, options, data) {
        for (const id in msg) {
            // http://docs.ros.org/api/visualization_msgs/html/msg/Marker.html
            const marker = msg[id];
            if (!(id in data)) {
                switch (marker.type) {
                    case 2: // sphere
                        data[id] = new Annotations.SphereAnnotation();
                        this.viewer.world.add(data[id]);
                        break;
                    case 0: // arrow
                    case 1: // box
                    case 3: // cylinder
                    default:
                        continue;
                }

                this.viewer.tags.addTag(data[id], 'marker');
            }

            const ann = data[id];
            getInFrame(marker.pose, marker.header, ann.position, ann.quaternion);
            ann.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
            ann.material.color
                .setRGB(marker.color.r, marker.color.g, marker.color.b)
                .convertSRGBToLinear();
            ann.visible = marker.header.valid;
        }
    },

    'nav_msgs/OccupancyGrid': function (topic, msg, options, data) {
        function toDataTexture(width, height, data, target) {
            target.image.width = width;
            target.image.height = height;
            target.image.data = target.image.data || new Uint8Array(4 * width * height);
            target.encoding = SRGBColorSpace;

            const image = target.image.data;
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const i = y * width + x;
                    const val = data[i];
                    if (val === -1) {
                        image[i * 4 + 0] = 0;
                        image[i * 4 + 1] = 0;
                        image[i * 4 + 2] = 0;
                        image[i * 4 + 3] = 0;
                    } else {
                        image[i * 4 + 0] = 233;
                        image[i * 4 + 1] = 30;
                        image[i * 4 + 2] = 99;
                        image[i * 4 + 3] = Math.max(15, Math.min(255, val * 2)); // TODO if val is between 0 and 100, scale alpha appropriately?
                    }
                }
            }
            target.format = RGBAFormat;
            target.type = UnsignedByteType;
            target.needsUpdate = true;
        }

        if (!data.plane) {
            // ROS expects the origin of the plane to be the bottom left so we offset
            // the plane by half a unit in each dimension.
            const geometry = new PlaneGeometry();
            geometry.translate(0.5, 0.5, 0);

            const mat = new MeshBasicMaterial();
            mat.transparent = true;
            mat.depthWrite = false;
            mat.map = new DataTexture();
            mat.side = DoubleSide;

            const plane = new Mesh(geometry, mat);
            this.viewer.world.add(plane);
            this.viewer.tags.addTag(plane, 'costmap');

            data.plane = plane;
        }

        const plane = data.plane;
        Object.assign(plane.position, msg.header.translation);
        Object.assign(plane.quaternion, msg.header.rotation);

        const { resolution, width, height, origin } = msg.info;
        plane.scale.set(resolution * width, resolution * height, 1);

        plane.updateMatrixWorld();

        // The ROS message specifies an "origin" for the plane, which represents the
        // position of the 0,0 point in local space. In order to accommodate this we
        // get the local direction vectors in the parent frame and offset the model
        // using those. Using `geometry.translate` would also be an option.
        tempVec.set(1, 0, 0);
        FrameTransformer.transformDirection(
            plane.matrixWorld,
            plane.parent.matrixWorld,
            tempVec,
            tempVec,
        );
        tempVec.normalize();
        plane.position.addScaledVector(tempVec, origin.position.x);

        tempVec.set(0, 1, 0);
        FrameTransformer.transformDirection(
            plane.matrixWorld,
            plane.parent.matrixWorld,
            tempVec,
            tempVec,
        );
        tempVec.normalize();
        plane.position.addScaledVector(tempVec, origin.position.y);

        tempVec.set(0, 0, 1);
        FrameTransformer.transformDirection(
            plane.matrixWorld,
            plane.parent.matrixWorld,
            tempVec,
            tempVec,
        );
        tempVec.normalize();
        plane.position.addScaledVector(tempVec, origin.position.z);

        toDataTexture(width, height, msg.data, plane.material.map);

        plane.visible = true;
    },

    'blob/Blob': function (topic, msg, options, data) {
        const { decompressedData, decompressedType } = msg;
        if (decompressedData && decompressedType) {
            const handler = this.telemetryHandlers[decompressedType];
            if (handler) {
                handler.call(this, topic, decompressedData, options, data);
            }
        }
    },
};

class RosDriver extends Driver<any> {
    isRosTransformDriver: boolean;
    rosFrames: any;
    tfTracker: RosAnimatorTransformTracker | undefined;
    inverseTransformMap: any;
    robots: any;
    annotations: never[];
    telemetryHandlers: { 'nav_msgs/Path': (topic: any, msg: any, options: any, data: any) => void; 'move_base_msgs/MoveBaseActionGoal': (topic: any, msg: any, options: any, data: any) => void; 'sensor_msgs/PointCloud2': (topic: any, msg: any, options: any, data: any) => void; 'visualization_msgs/Marker': (topic: any, msg: any, options: any, data: any) => void; 'nav_msgs/OccupancyGrid': (topic: any, msg: any, options: any, data: any) => void; 'blob/Blob': (topic: any, msg: any, options: any, data: any) => void; };
    handlerData: {};
    constructor(options: any = {}) {
        options = Object.assign(
            {
                telemetry: null,
                robots: [],
                topics: [],
                transformMap: {},
            },
            options,
        );

        const inverseTransformMap = {};
        for (const key in options.transformMap) {
            const transformed = options.transformMap[key];
            if (key in inverseTransformMap) {
                console.warn(`RosDriver: Name ${transformed} is mapped to multiple times.`);
            } else {
                inverseTransformMap[transformed] = key;
            }
        }

        super(new LoadingManager(), options);
        this.isRosTransformDriver = true;
        this.rosFrames = {};
        this.annotations = [];
        this.telemetryHandlers = { ...RosTypeHandlers };
        this.handlerData = {};
        this.inverseTransformMap = inverseTransformMap;
        this.robots = options.robots;
    }

    update(state, diff) {
        const viewer = this.viewer!;
        const telemetry = this.options.telemetry;
        const animator = viewer.animators[telemetry];
        if (!animator) return;

        const tfTracker = RosAnimatorTransformTracker.getInstance(animator);
        this.tfTracker = tfTracker;
        const transformMap = this.options.transformMap;
        const inverseTransformMap = this.inverseTransformMap;
        const world = viewer.world;

        const robots = this.robots;
        for (let i = 0, l = robots.length; i < l; i++) {
            const { id, prefix = '' } = robots[i];
            const robot = viewer.getRobot(id);
            if (!robot) {
                continue;
            }

            const frames = (robot as any).frames;
            const prependPrefix = prefix ? `${prefix}/` : '';
            for (const key in frames) {
                // get remapped, prefixed name to look for in the tf channels
                const childFrame = frames[key];
                const childName = prependPrefix + key;
                let remappedChildName = childName;
                if (remappedChildName in transformMap) {
                    remappedChildName = transformMap[remappedChildName];
                }

                // get the original frame name in the robot model
                const trackerParentName = tfTracker?.getParentName(remappedChildName);
                let mappedParentName = trackerParentName;
                if (mappedParentName in inverseTransformMap) {
                    mappedParentName = inverseTransformMap[mappedParentName];
                }

                // if the child has no parent then we can assume it hasn't been tracked via /tf
                if (!mappedParentName) {
                    continue;
                }

                // get the parent frame
                const parentName = mappedParentName.substring(prependPrefix.length);
                let parentFrame = frames[parentName];

                // get the transform relative to the closest parent frame to avoid out-of-sync transforms
                // between the three.js hierarchy and the ros hierarchy.
                childFrame.matrix.identity();
                if (!parentFrame) {
                    parentFrame = world;
                    tfTracker?.getTransformInRootFrame(remappedChildName, childFrame.matrix);
                } else {
                    tfTracker?.getTransformInFrame(remappedChildName, trackerParentName, childFrame.matrix);
                }

                if (parentFrame !== frames[childName].parent) {
                    // transform the retrieved tf into the immediate child parent frame assuming there isn't a
                    // moving transform between them.
                    FrameTransformer.transformFrame(
                        parentFrame.matrixWorld,
                        childFrame.parent.matrixWorld,
                        childFrame.matrix,
                        childFrame.matrix,
                    );
                }

                childFrame.matrix.decompose(
                    childFrame.position,
                    childFrame.quaternion,
                    childFrame.scale,
                );
            }
        }

        const messageTypes = (animator as any).messageTypes;
        const messages = state[telemetry];
        const topics = this.options.topics;
        const telemetryHandlers = this.telemetryHandlers;
        const handlerData = this.handlerData;

        // reset all visibility in case a message has disappeared or the player is rewound.
        for (const topic in handlerData) {
            if (!diff.didChange(telemetry, topic)) {
                continue;
            }

            const data = handlerData[topic];
            for (const o in data) {
                const obj = data[o];
                if (Array.isArray(obj)) {
                    obj.forEach(o => (o.visible = false));
                } else {
                    obj.visible = false;
                }
            }
        }

        for (const topicInfo of topics) {
            const topic = typeof topicInfo === 'string' ? topicInfo : topicInfo.name;
            const options = topicInfo.options;
            const type = messageTypes[topic];
            const msg = messages[topic];

            if (!(topic in messages)) {
                continue;
            }
            if (!(type in telemetryHandlers)) {
                continue;
            }

            if (!(topic in handlerData)) {
                handlerData[topic] = {};
            }

            if (diff.didChange(telemetry, topic)) {
                const data = handlerData[topic];
                const handler = telemetryHandlers[type];
                handler.call(this, topic, msg, options, data);
            }
        }

        // TODO: Figure out how to bring the line rendering back?
        // const robotState = state[this.options.telemetry];
        // const robotAnimator = viewer.animators[this.options.telemetry];
        // const robot = viewer.getRobot(this.options.robot);

        // // Create the robot path
        // if (robot && !this.tracks && robotAnimator) {
        //     const container = new Object3D();

        //     // TODO: We have to apply the robot state initially here because
        //     // if there are two robots then it's possible that one will not be
        //     // moved on the first frame and initialize at zero.
        //     const material = new LineMaterial({
        //         color: 0xffffff,
        //         linewidth: 1, // in pixels
        //         resolution: new Vector2(1000, 1000), // to be set by renderer, eventually
        //         dashed: false,
        //     });

        //     const lineContexts = {};
        //     this.options.paths.forEach(linkName => {
        //         const positions = [];
        //         const tempRobot = robot.clone();
        //         robot.parent.add(tempRobot);
        //         tempRobot.visible = false;

        //         const vec = new Vector3();
        //         const prevVec = new Vector3();
        //         const line = new LineAnnotation([0, 0, 0, 0, 0, 0], material);
        //         line.material.uniforms.resolution.value = viewer.resolution;
        //         line.material.color.set(0x009688);
        //         line.material.linewidth = 1.5;
        //         container.add(line);

        //         lineContexts[linkName] = {
        //             vec,
        //             prevVec,
        //             line,
        //             positions,
        //             tempRobot,
        //             waitingToUpdate: false,
        //         };
        //     });

        //     robotAnimator
        //         .forEachFrame(state => {
        //             this.options.paths.forEach(linkName => {
        //                 const context = lineContexts[linkName];
        //                 const { vec, prevVec, line, positions, tempRobot } = context;
        //                 this.applyTransform(tempRobot, state.state);

        //                 vec.set(0, 0, 0);
        //                 const link = tempRobot.links[linkName];
        //                 link.updateWorldMatrix(true, false);
        //                 FrameTransformer.transformPoint(
        //                     link.matrixWorld,
        //                     viewer.world.matrixWorld,
        //                     vec,
        //                     vec,
        //                 );

        //                 if (vec.distanceTo(prevVec) > 0.05) {
        //                     positions.push(vec.x, vec.y, vec.z);
        //                 }
        //                 prevVec.copy(vec);

        //                 if (!context.waitingToUpdate && positions.length >= 6) {
        //                     context.waitingToUpdate = true;
        //                     Promise.resolve().then(() => {
        //                         line.setPositions(positions);
        //                         context.waitingToUpdate = false;
        //                         viewer.dirty = true;
        //                     });
        //                 }
        //             });
        //         })
        //         .then(() => {
        //             this.options.paths.forEach(linkName => {
        //                 const { tempRobot } = lineContexts[linkName];
        //                 tempRobot.parent.remove(tempRobot);
        //                 tempRobot.traverse(c => c.dispose && c.dispose());
        //             });
        //         });

        //     if (!viewer.tracksContainer) {
        //         viewer.tracksContainer = new Object3D();
        //         viewer.tracksContainer.add(container);
        //         viewer.world.add(viewer.tracksContainer);
        //     }
        //     viewer.tracksContainer.add(container);
        //     this.tracks = container;

        //     viewer.dirty = true;
        // }
    }

    // dispose() {
    //     const viewer = this.viewer;
    //     viewer?.removeEventListener('add-robot', this._addRobotCallback);
    //     viewer?.removeEventListener('remove-robot', this._removeRobotCallback);
    // }
}

export { RosDriver };
