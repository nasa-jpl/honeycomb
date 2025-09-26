import { Driver } from '@gov.nasa.jpl.honeycomb/core';
import { Group, EdgesGeometry, Vector2, MeshBasicMaterial, Color, Object3D } from 'three';
import {
    FrustumAnnotation,
    BoxAnnotation,
    TriangleAnnotation,
    CylinderAnnotation,
    SquareLineAnnotation,
    CircleLineAnnotation,
    TriangleLineAnnotation,
    StampShape,
} from '@gov.nasa.jpl.honeycomb/telemetry-primitives';
import { ObjectPool } from '@gov.nasa.jpl.honeycomb/three-extensions';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { CameraLoader } from '@gov.nasa.jpl.honeycomb/camera-loader';
import merge from 'lodash.merge';

const redLine = new LineMaterial({ color: 0xff6b50, linewidth: 1 });
const blueLine = new LineMaterial({ color: 0x56a7ff, linewidth: 1 });

export class ArksmlDriver extends Driver<any> {
    options: any;
    cameraFrustums: any;
    kioz: any;
    kiozContainer: Group;
    disposed: boolean;

    constructor(options, manager) {
        super(manager);

        this.options = Object.assign(
            {
                telemetry: null,
                cameraModels: null,
                renderOrderKiz: -2,
                renderOrderKoz: -1,
            },
            options,
        );

        this.type = 'ArksmlDriver';
        this.cameraFrustums = {};

        this.options.keepzone = merge({
            line: true,
            lineWidth: 2,
            lineOpacity: 1,
            opacity: 0.15,
            inFillColor: '#4caf50',
            inLineColor: '#4caf50',
            outFillColor: '#e91e63',
            outLineColor: '#e91e63',
        }, options.keepzone);
        this.kioz = {};
        this.kiozContainer = new Group();
        this.disposed = false;
    }

    initialize() {
        this._initializeCameras();
        this._initializeKIOZ();
    }

    dispose() {
        const { cameraFrustums, kioz, viewer } = this.cameraFrustums;
        for (const name in cameraFrustums) {
            const group = cameraFrustums[name];
            group.traverse(c => {
                if (c.material) {
                    c.material.dispose();
                }
            });
            const [kz, line] = group.children;
            line.geometry.dispose();
            line.material.dispose();
            viewer.tags.removeObject(kz);
            if (group.parent) {
                group.parent.remove(group);
            }
        }
        kioz.rectangle.dispose();
        kioz.circle.dispose();
        kioz.triangle.dispose();
        this.disposed = true;
    }

    _initializeKIOZ() {
        const { kioz, viewer, kiozContainer, options } = this;
        const keepOutFillColor = new Color(options.keepzone.outFillColor).convertSRGBToLinear();
        const keepInFillColor = new Color(options.keepzone.inFillColor).convertSRGBToLinear();
        const keepOutLineColor = new Color(options.keepzone.outLineColor).convertSRGBToLinear();
        const keepInLineColor = new Color(options.keepzone.inLineColor).convertSRGBToLinear();
        const world = viewer.world;

        world.add(kiozContainer);
        viewer.toggle('keepzone&&line', options.keepzone.line);

        // rectangle kiz
        kioz.rectangle = new class extends ObjectPool {
            createObject() {
                const group = new Group();
                const kz = new StampShape(
                    new BoxAnnotation(new MeshBasicMaterial({ opacity: options.keepzone.opacity })));
                const line = new SquareLineAnnotation();
                line.lineWidth = options.keepzone.lineWidth;
                line.material.opacity = options.keepzone.lineOpacity;
                line.material.transparent = options.keepzone.lineOpacity < 1.0;
                group.add(kz, line);

                viewer.tags.addTag(line, ['line', 'keepzone', 'rectangle']);
                viewer.tags.addTag(kz, ['stamp', 'keepzone', 'rectangle']);
                return group;
            }

            updateObject(group, info) {
                const { shape } = info;
                const keepInZone = info.keepZoneType === 'in';
                const fillColor = keepInZone ? keepInFillColor : keepOutFillColor;
                const lineColor = keepInZone ? keepInLineColor : keepOutLineColor;
                const renderOrder = keepInZone ? options.renderOrderKiz : options.renderOrderKoz;

                const [kz, line] = group.children;
                kz.shape.size.set(shape.halfWidth * 2, shape.halfHeight * 2, 10000);
                kz.stamp.material.color.copy(fillColor);
                kz.setRenderOrder(renderOrder);

                line.setSize(shape.halfWidth * 2, shape.halfHeight * 2);
                line.material.color.copy(lineColor);

                const robot = options.robot ? viewer.getRobot(options.robot) : undefined;
                const robotZOffset = robot ? robot.position.z : 0;
                const z = (shape.position.z ?? 0) - robotZOffset;
                group.position.set(shape.position.x, shape.position.y, z - 0.5);
                group.rotation.set(0, 0, shape.angle);

                if (info.userData) {
                    group.userData = info.userData;
                }

                viewer.tags.removeTag(line, ['in', 'out']);
                viewer.tags.removeTag(kz, ['in', 'out']);
                viewer.tags.addTag(line, info.keepZoneType);
                viewer.tags.addTag(kz, info.keepZoneType);
            }

            disposeObject(group) {
                const [kz, line] = group.children;
                kz.stamp.material.dispose();
                line.geometry.dispose();
                line.material.dispose();
                viewer.tags.removeObject(kz);
                viewer.tags.removeObject(line);
            }
        }(kiozContainer);

        // circle
        kioz.circle = {};

        // circle kiz
        kioz.circle = new class extends ObjectPool {
            createObject() {
                const group = new Group();
                const kz = new StampShape(new CylinderAnnotation(
                    new MeshBasicMaterial({ opacity: options.keepzone.opacity })),
                );
                const line = new CircleLineAnnotation();
                line.lineWidth = options.keepzone.lineWidth;
                line.material.opacity = options.keepzone.lineOpacity;
                line.material.transparent = options.keepzone.lineOpacity < 1.0;
                group.add(kz, line);

                viewer.tags.addTag(line, ['line', 'keepzone', 'circle']);
                viewer.tags.addTag(kz, ['stamp', 'keepzone', 'circle']);
                return group;
            }

            updateObject(group, info) {
                const { shape } = info;
                const keepInZone = info.keepZoneType === 'in';
                const fillColor = keepInZone ? keepInFillColor : keepOutFillColor;
                const lineColor = keepInZone ? keepInLineColor : keepOutLineColor;
                const renderOrder = keepInZone ? options.renderOrderKiz : options.renderOrderKoz;

                const [kz, line] = group.children;
                kz.shape.radius = shape.radius;
                kz.shape.length = 10000;
                kz.stamp.material.color.copy(fillColor);
                kz.setRenderOrder(renderOrder);

                line.radius = shape.radius;
                line.material.color.copy(lineColor);

                const robot = options.robot ? viewer.getRobot(options.robot) : undefined;
                const robotZOffset = robot ? robot.position.z : 0;
                const z = (shape.position.z ?? 0) - robotZOffset;
                group.position.set(shape.position.x, shape.position.y, z - 0.5);

                if (info.userData) {
                    group.userData = info.userData;
                }

                viewer.tags.removeTag(line, ['in', 'out']);
                viewer.tags.removeTag(kz, ['in', 'out']);
                viewer.tags.addTag(line, info.keepZoneType);
                viewer.tags.addTag(kz, info.keepZoneType);
            }

            disposeObject(group) {
                const [kz, line] = group.children;
                kz.stamp.material.dispose();
                line.geometry.dispose();
                line.material.dispose();
                viewer.tags.removeObject(kz);
                viewer.tags.removeObject(line);
            }
        }(kiozContainer);

        // triangle
        kioz.triangle = {};
        const p1 = new Vector2();
        const p2 = new Vector2();
        const p3 = new Vector2();

        // triangle kiz
        kioz.triangle = new class extends ObjectPool {
            createObject(): Object3D {
                const group = new Group();
                const kz = new StampShape(new TriangleAnnotation(
                    new MeshBasicMaterial({ opacity: options.keepzone.opacity })),
                );
                const line = new TriangleLineAnnotation();
                line.lineWidth = options.keepzone.lineWidth;
                line.material.opacity = options.keepzone.lineOpacity;
                line.material.transparent = options.keepzone.lineOpacity < 1.0;
                group.add(kz, line);

                viewer.tags.addTag(line, ['line', 'keepzone', 'triangle']);
                viewer.tags.addTag(kz, ['stamp', 'keepzone', 'triangle']);
                return group;
            }
            updateObject(group, info): void {
                const { shape } = info;
                const keepInZone = info.keepZoneType === 'in';
                const fillColor = keepInZone ? keepInFillColor : keepOutFillColor;
                const lineColor = keepInZone ? keepInLineColor : keepOutLineColor;
                const renderOrder = keepInZone ? options.renderOrderKiz : options.renderOrderKoz;

                const [kz, line] = group.children;
                p1.copy(shape.points[0]);
                p2.copy(shape.points[1]);
                p3.copy(shape.points[2]);
                kz.shape.setVertices(p1, p2, p3);
                kz.shape.length = 10000;
                kz.stamp.material.color.copy(fillColor);
                kz.setRenderOrder(renderOrder);

                line.setVertices(p1, p2, p3);
                line.material.color.copy(lineColor);

                if (info.userData) {
                    group.userData = info.userData;
                }

                viewer.tags.removeTag(line, ['in', 'out']);
                viewer.tags.removeTag(kz, ['in', 'out']);
                viewer.tags.addTag(line, info.keepZoneType);
                viewer.tags.addTag(kz, info.keepZoneType);
            }
            disposeObject(group): void {
                const [kz, line] = group.children;
                kz.stamp.material.dispose();
                line.geometry.dispose();
                line.material.dispose();
                viewer.tags.removeObject(kz);
                viewer.tags.removeObject(line);
            }
        }(kiozContainer);
    }

    /**
     * Load the cameras
     * Initialize the frustums for each camera
     */
    async _initializeCameras() {
        const { options, manager } = this;
        const { cameraModels } = options;
        if (!cameraModels) {
            return;
        }

        // initialize cameras
        const cameraFrustums = this.cameraFrustums;
        const cameraLoader = new CameraLoader();
        const cameraDefinitions = await cameraLoader.load(manager.resolveURL(cameraModels));
        const viewer = this.viewer;

        if (this.disposed) {
            return;
        }

        let cameraRenderOrder = 1;
        for (const name in cameraDefinitions) {
            const cameraModel = {
                ...cameraDefinitions[name],
                nearDist: 0.085,
                farDist: 10.0, // TODO how far should this be?
            };
            cameraModel.C = cameraModel.C_LOCAL || cameraModel.C;

            // camera is a left camera if it includes "LEFT" or has a sibling camera
            // that has the same name with "L" replaced by "R".
            let isLeftCamera = false;
            if (name.toLowerCase().includes('left')) {
                isLeftCamera = true;
            } else {
                const leftRegex = /L/g;
                let result;
                while ((result = leftRegex.exec(name))) {
                    const index = result.index;
                    const rightName = name.substr(0, index) + 'R' + name.substr(index + 1);
                    if (rightName in cameraDefinitions) {
                        isLeftCamera = true;
                        break;
                    }
                }
            }

            const material = isLeftCamera ? blueLine : redLine;

            // get frustum geometry
            const frustum = new FrustumAnnotation();
            frustum.setParameters(cameraModel);

            // create lines
            const linesGeometry = new LineSegmentsGeometry().fromEdgesGeometry(
                new EdgesGeometry(frustum.geometry, 60),
            );
            const lines = new LineSegments2(linesGeometry, material);

            // create stamp
            // Set the each frustum stamp to use a different render order so each frustum gets
            // its own unique stamp rather than drawing all stencil items then all stencil color.
            const frustumStamp = new StampShape(
                new FrustumAnnotation(
                    new MeshBasicMaterial({
                        color: material.color.getHex(),
                        opacity: 0.15,
                    }),
                ),
            );
            frustumStamp.shape.setParameters(cameraModel);
            frustumStamp.setRenderOrder(cameraRenderOrder + 1);
            cameraRenderOrder++;

            // create group
            const group = new Group();
            group.visible = false;
            group.add(lines, frustumStamp);
            viewer.tags.addTag(frustumStamp, ['frustum', 'stamp', name]);
            viewer.tags.addTag(lines, ['frustum', 'line', name]);
            viewer.world.add(group);

            cameraFrustums[name] = group;
        }

        // if this happens asynchronously we need to force an update of this driver
        this.forceUpdate();
    }

    /**
     * Hide all the camera frustums that are visible
     */
    _hideCameraFrustums() {
        const viewer = this.viewer;
        const cameraFrustums = this.cameraFrustums;
        for (const name in cameraFrustums) {
            if (cameraFrustums[name].visible) {
                viewer.dirty = true;
                cameraFrustums[name].visible = false;
            }
        }
    }

    update(state, diff) {
        const { viewer, options } = this;
        const { telemetry } = options;
        const annotations = state[telemetry] ? state[telemetry].annotations || [] : [];

        // TODO: diffing currently not working properly with this driver, it makes rewinding turn the annotations on and off
        if (annotations && diff.didChange(telemetry, 'annotations')) {
            this.reset();

            // apply ImageAcquire
            const cameraFrustums = this.cameraFrustums;
            this._hideCameraFrustums();
            annotations
                .filter(ann => ann.type === 'ImageAcquire')
                .forEach(ann => {
                    const group = cameraFrustums[ann.camera];
                    if (!group) {
                        return;
                    }

                    group.position.copy(ann.position);
                    group.quaternion.copy(ann.quaternion);
                    group.visible = true;
                });

            // apply KeepZones
            const kioz = this.kioz;
            const kiozAnn = annotations.filter(ann => ann.type === 'KeepZone');
            kioz.rectangle.updateData(kiozAnn.filter(ann => ann.shapeType === 'Rectangle'));
            kioz.circle.updateData(kiozAnn.filter(ann => ann.shapeType === 'Circle'));
            kioz.triangle.updateData(kiozAnn.filter(ann => ann.shapeType === 'Triangle'));
            viewer.dirty = true;
        }
    }

    reset() {
        this._hideCameraFrustums();

        const kioz = this.kioz;
        kioz.rectangle.updateData([]);
        kioz.circle.updateData([]);
        kioz.triangle.updateData([]);
    }
}
