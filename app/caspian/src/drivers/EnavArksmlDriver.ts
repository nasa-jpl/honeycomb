import { Driver } from '@gov.nasa.jpl.honeycomb/core';
import {
    Vector3,
    DataTexture,
    Group,
    FloatType,
    ClampToEdgeWrapping,
    LinearFilter,
    MeshBasicMaterial,
    Matrix4,
    RedFormat,
} from 'three';
import { LabeledVertex } from '@gov.nasa.jpl.honeycomb/telemetry-primitives';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { EnavHeightmap } from './EnavHeightmap';
import { EnavCostmap } from './EnavCostmap';
import { costIndexToColor } from './constants';

const tempVec3 = new Vector3();
const tempMat4 = new Matrix4();

export class EnavArksmlDriver extends Driver<any> {
    constructor(options, manager) {
        super(manager, options);
        this.options = Object.assign(
            { keydownInteraction: true },
            options,
        );

        this.type = 'EnavArksmlDriver';
        this.isEnavArksmlDriver = true;
    }

    initialize() {
        const viewer = this.viewer;

        // instantiate map frame
        const enavGroup = new Group();
        enavGroup.name = 'Enav Data Products Group';

        const heightmapTex = new DataTexture();
        heightmapTex.format = RedFormat;
        heightmapTex.type = FloatType;
        heightmapTex.wrapS = ClampToEdgeWrapping;
        heightmapTex.wrapT = ClampToEdgeWrapping;
        heightmapTex.magFilter = LinearFilter;

        // instantiate object for terrain
        const heightmap = new EnavHeightmap();
        heightmap.heightmapTex = heightmapTex;
        heightmap.driver = this;
        heightmap.heightmap.visible = false;
        viewer.tags.addTag(heightmap, 'heightmap');

        viewer.tags.addTag(enabled => {
            heightmap.locked = enabled;
        }, 'heightmap-lock');

        const sampledTerrainLabel = new LabeledVertex(
            0.05,
            new MeshBasicMaterial({ color: 0xffffff }),
        );
        sampledTerrainLabel.visible = false;
        sampledTerrainLabel.startFade = 10000;
        sampledTerrainLabel.endFade = 10000;

        const costmapTex = new EnavCostmap();
        costmapTex.driver = this;

        const heightmapDefines = heightmap.heightmap.mesh.material.defines;
        const extendedHeightmapDefines = heightmap.extendedHeightmap.mesh.material.defines;

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_TEXTURE_STAMP_costmap = toggle;
            extendedHeightmapDefines.ENABLE_TEXTURE_STAMP_costmap = toggle;
        }, 'costmap');

        viewer.tags.addTag(enabled => {
            costmapTex.locked = enabled;
        }, 'costmap-lock');

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_GRID_STAMP_costmap = toggle;
            extendedHeightmapDefines.ENABLE_GRID_STAMP_costmap = toggle;
        }, 'costmap-grid');

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_GRID_STAMP_heightmap = toggle;
            extendedHeightmapDefines.ENABLE_GRID_STAMP_heightmap = toggle;
        }, 'heightmap-grid');

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_TEXTURE_STAMP_cell_global_pos_err = toggle;
            extendedHeightmapDefines.ENABLE_TEXTURE_STAMP_cell_global_pos_err = toggle;
        }, 'cell-global-pos-error');

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_TEXTURE_STAMP_is_dilated = toggle;
            heightmapDefines.ENABLE_TEXTURE_STAMP_DITHER_is_dilated = toggle;
            extendedHeightmapDefines.ENABLE_TEXTURE_STAMP_is_dilated = toggle;
            extendedHeightmapDefines.ENABLE_TEXTURE_STAMP_DITHER_is_dilated = toggle;
        }, 'is-dilated');

        heightmap.costmapTex = costmapTex;
        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_TOPO_LINES = toggle;
        }, 'topo-lines');

        viewer.tags.addTag(enabled => {
            const toggle = enabled ? 1 : 0;
            heightmapDefines.ENABLE_STEEPNESS_VISUALIZATION = toggle;
        }, 'steepness-color');

        viewer.world.add(enavGroup);
        viewer.scene.add(sampledTerrainLabel);
        enavGroup.add(heightmap);
        enavGroup.add(costmapTex.mapFrame);

        this.enavGroup = enavGroup;
        this.heightmap = heightmap;
        this.costmapTex = costmapTex;
        this.heightmapTex = heightmapTex;
        this.sampledTerrainLabel = sampledTerrainLabel;

        this._applyGroundTruth = true;

        viewer.tags.addTag(enabled => {
            this._applyGroundTruth = enabled;
            this.reset();
            this.forceUpdate();
        }, 'ground-truth');

        const interactionManager = this.viewer.interactionManager;

        const options = this.options;
        if (options.keydownInteraction) {
            let prevTimeout = null;
            interactionManager.addEventListener('keydown', e => {
                // oddly pressing ALT key once makes browser lose focus of
                // honeycomb app, using CTRL instead
                // CTRL key down
                if (e.keyEvent.keyCode === 17) {
                    const intersection = interactionManager.getIntersection([
                        heightmap.extendedHeightmap.mesh,
                    ]);
                    if (intersection) {
                        sampledTerrainLabel.visible = true;
                        const hitPoint = intersection.point;
                        sampledTerrainLabel.position.copy(hitPoint);

                        const uv = heightmap.getCostmapUVFromScenePos(hitPoint);
                        const uIndex = Math.floor(uv.x * costmapTex.image.width);
                        const vIndex = Math.floor(uv.y * costmapTex.image.height);
                        const costmapIndex = (vIndex * costmapTex.image.height + uIndex) * 4;
                        let color = null;
                        let colorIndex = -1;
                        if (costmapTex.image.data) {
                            color = {
                                r: costmapTex.image.data[costmapIndex],
                                g: costmapTex.image.data[costmapIndex + 1],
                                b: costmapTex.image.data[costmapIndex + 2],
                            };
                            const hexColor = (color.r << 16) + (color.g << 8) + color.b;
                            colorIndex = costIndexToColor.indexOf(hexColor);
                        }
                        const costString =
                            colorIndex === -1
                                ? 'NO_ISSUES'
                                : Object.keys(costStringToIndex).find(
                                    key => costStringToIndex[key] === colorIndex,
                                );

                        const cellGlobalPosError = heightmap.getCellGlobalPosErrFromScenePos(hitPoint);
                        const isDilated = heightmap.getIsDilatedFromScenePos(hitPoint);

                        tempMat4.copy(enavGroup.matrixWorld).invert();
                        hitPoint.applyMatrix4(tempMat4);
                        const { mapFrameMat4, simRobotMat4, gtRobotMat4 } = heightmap;
                        this.reversePosGroundTruthOffset(
                            hitPoint,
                            simRobotMat4,
                            gtRobotMat4,
                            mapFrameMat4,
                        );
                        sampledTerrainLabel.text = `Pos: (${hitPoint.x.toFixed(
                            2,
                        )} m, ${hitPoint.y.toFixed(2)} m, ${hitPoint.z.toFixed(
                            2,
                        )} m)<br>Cost: ${costString}<br>Cell Global Pos Error: ${cellGlobalPosError.toFixed(
                            4
                        )} m<br>DP File: ${heightmap.dpFile}<br>Is Dilated: ${isDilated}`;
                    } else {
                        sampledTerrainLabel.visible = false;
                    }
                    viewer.dirty = true;

                    // ideally i'd like it to fade out over time but this will do for now
                    if (prevTimeout !== null) {
                        clearTimeout(prevTimeout);
                    }
                    prevTimeout = setTimeout(() => {
                        sampledTerrainLabel.visible = false;
                        viewer.dirty = true;
                    }, 10000);
                }
            });
        }
    }

    update(state, diff) {
        const viewer = this.viewer;
        const options = this.options;
        const robot = viewer.getRobot(options.robot);
        const enavAnnotations = state[options.telemetry]
            ? state[options.telemetry].annotations
            : null;

        robot.updateWorldMatrix(false, false);

        const didChange = diff.didChange(options.telemetry, 'annotations');
        if (didChange) {
            this.reset();
        }

        if (enavAnnotations && didChange) {
            let foundHeightmapAnnotation = false;
            let foundCostmapAnnotation = false;
            const arcFilesThisUpdate = [];
            for (let i = 0, l = enavAnnotations.length; i < l; i++) {
                const annotation = enavAnnotations[i];
                switch (annotation.type) {
                    case 'EnavCostmap':
                        foundCostmapAnnotation = true;
                        this.costmapTex.update(annotation);
                        break;
                    case 'EnavHeightmap':
                        foundHeightmapAnnotation = true;
                        this.heightmap.update(annotation);
                        break;
                }
            }

            if (!foundCostmapAnnotation) {
                this.costmapTex.clearCostmap();
            }

            viewer.dirty = true;
        }
    }

    reset() {
        this.heightmap.reset();
    }

    dispose() {
        super.dispose();

        const viewer = this.viewer;
        viewer.tags.removeObject(this.heightmap);

        const costmapTaggedObjects = viewer.tags.getObjects(
            '(costmap)||(topo-lines)||(steepness-color)',
        );
        if (costmapTaggedObjects) {
            costmapTaggedObjects.forEach(element => {
                viewer.tags.removeObject(element);
            });
        }

        // everything else is a child of enavGroup so no need to individually remove them
        viewer.world.remove(this.enavGroup);
    }

    /* Private Functions */

    // fixes height of input vec, only modifies Z, X&Y are not changed
    // vec is in map frame
    // input vec.z should be 0
    fixHeight(vec) {
        const viewer = this.viewer;
        const robot = viewer.getRobot(this.options.robot);
        const siteFrameVec = new Vector3();
        siteFrameVec.copy(vec);

        // convert arc position in map frame to viewer.world's frame
        FrameTransformer.transformPoint(
            this.arcContainer.mapFrame.matrixWorld,
            this.viewer.world.matrixWorld,
            siteFrameVec,
            siteFrameVec,
        );

        // get distance along robot's XY plane to get correct height
        // that the position should be and stuff height into input vector's z
        siteFrameVec.set(
            siteFrameVec.x - robot.position.x,
            siteFrameVec.y - robot.position.y,
            siteFrameVec.z,
        );

        // convert robot's local up into viewer.world's frame
        tempVec3.set(0, 0, -1);
        FrameTransformer.transformDirection(
            robot.matrixWorld,
            viewer.world.matrixWorld,
            tempVec3,
            tempVec3,
        );

        siteFrameVec.projectOnPlane(tempVec3);
        vec.z = robot.position.z + siteFrameVec.z - 1;
    }

    applyFrameGroundTruthOffset(mat4) {
        if (this._applyGroundTruth) {
            const options = this.options;
            const simRobot = this.viewer.getRobot(options.robot);
            const groundTruthRobot = this.viewer.getRobot(options.groundTruthRobot);

            if (groundTruthRobot) {
                simRobot.updateWorldMatrix(false, false);
                groundTruthRobot.updateWorldMatrix(false, false);
                this.enavGroup.updateWorldMatrix(false, false);

                FrameTransformer.transformFrame(
                    this.enavGroup.matrixWorld,
                    simRobot.matrixWorld,
                    mat4,
                    mat4,
                );
                FrameTransformer.transformFrame(
                    groundTruthRobot.matrixWorld,
                    simRobot.matrixWorld,
                    mat4,
                    mat4,
                );
                FrameTransformer.transformFrame(
                    simRobot.matrixWorld,
                    this.enavGroup.matrixWorld,
                    mat4,
                    mat4,
                );
            }
        }
    }

    applyPosGroundTruthOffset(pos) {
        if (this._applyGroundTruth) {
            const options = this.options;
            const simRobot = this.viewer.getRobot(options.robot);
            const groundTruthRobot = this.viewer.getRobot(options.groundTruthRobot);

            if (groundTruthRobot) {
                simRobot.updateWorldMatrix(false, false);
                groundTruthRobot.updateWorldMatrix(false, false);
                this.enavGroup.updateWorldMatrix(false, false);

                FrameTransformer.transformPoint(
                    this.enavGroup.matrixWorld,
                    simRobot.matrixWorld,
                    pos,
                    pos,
                );
                FrameTransformer.transformPoint(
                    groundTruthRobot.matrixWorld,
                    simRobot.matrixWorld,
                    pos,
                    pos,
                );
                FrameTransformer.transformPoint(
                    simRobot.matrixWorld,
                    this.enavGroup.matrixWorld,
                    pos,
                    pos,
                );
            }
        }
    }

    reversePosGroundTruthOffset(pos, simRobotMat4 = null, gtRobotMat4 = null, mapFrameMat4 = null) {
        if (this._applyGroundTruth) {
            const options = this.options;
            const simRobot = this.viewer.getRobot(options.robot);
            const groundTruthRobot = this.viewer.getRobot(options.groundTruthRobot);

            if (groundTruthRobot) {
                simRobot.updateWorldMatrix(false, false);
                groundTruthRobot.updateWorldMatrix(false, false);
                this.enavGroup.updateWorldMatrix(false, false);

                const mapFrameMatWorld = mapFrameMat4 || this.enavGroup.matrixWorld;
                const simRobotMatWorld = simRobotMat4 || simRobot.matrixWorld;
                const gtRobotMatWorld = gtRobotMat4 || groundTruthRobot.matrixWorld;

                FrameTransformer.transformPoint(mapFrameMatWorld, simRobotMatWorld, pos, pos);
                FrameTransformer.transformPoint(simRobotMatWorld, gtRobotMatWorld, pos, pos);
                FrameTransformer.transformPoint(simRobotMatWorld, mapFrameMatWorld, pos, pos);
            }
        }
    }
}
