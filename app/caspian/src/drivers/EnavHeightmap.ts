import { Group, DoubleSide, Vector2, Matrix4, DataTexture, RGBAFormat, UnsignedByteType, ShaderLib } from 'three';
import { SampledTerrain } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import { Sampler2D } from '@gov.nasa.jpl.honeycomb/sampler-2d';
import { Mixins } from '@gov.nasa.jpl.honeycomb/mixin-shaders';
import { mipFlood, tempVec3, tempScale, tempQuat, tempMat4 } from './utils';

const { TextureStampMixin, GridStampMixin } = Mixins;

const ENAV_HEIGHTMAP_BASE_SHADER =
    TextureStampMixin(
        TextureStampMixin(
            TextureStampMixin(
                GridStampMixin(
                    GridStampMixin(
                        ShaderLib.phong,
                        '_costmap'),
                    '_heightmap'),
                '_costmap'),
            '_cell_global_pos_err'),
        '_is_dilated');

// special value in FSW referred to "unknown"
const ENAV_UNKNOWN = 1000000000;
const CLIP_PLANE_Z_VALUE = 20000;

export class EnavHeightmap extends Group {
    set costmapTex(val) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material;
        heightmapMat.textureStampMap_costmap = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material;
        extendedMat.textureStampMap_costmap = val;
    }

    set cellGlobalPosErrorTex(val) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material;
        heightmapMat.textureStampMap_cell_global_pos_err = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material;
        extendedMat.textureStampMap_cell_global_pos_err = val;

        this._cellGlobalPosErrorTex = val;
    }

    get cellGlobalPosErrorTex() {
        return this._cellGlobalPosErrorTex;
    }

    set isDilatedTex(val) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material;
        heightmapMat.textureStampMap_is_dilated = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material;
        extendedMat.textureStampMap_is_dilated = val;

        this._isDilatedTex = val;
    }

    get isDilatedTex() {
        return this._isDilatedTex;
    }

    constructor() {
        super();

        this.mapFrame = new Group();
        this.add(this.mapFrame);

        this.setupHeightmap();
        this.setupExtendedHeightmap();

        const cellGlobalPosErrorTex = new DataTexture();
        cellGlobalPosErrorTex.format = RGBAFormat;
        cellGlobalPosErrorTex.type = UnsignedByteType;
        this.cellGlobalPosErrorTex = cellGlobalPosErrorTex;

        const isDilatedTex = new DataTexture();
        isDilatedTex.format = RGBAFormat;
        isDilatedTex.type = UnsignedByteType;
        this.isDilatedTex = isDilatedTex;

        this.driver = null;
        this.heightmapTex = null;

        this.sourceFile = '';
        this.dpFile = '';

        this.locked = false;

        this.mapFrameMat4 = new Matrix4();
        this.simRobotMat4 = new Matrix4();
        this.gtRobotMat4 = new Matrix4();
    }

    setupHeightmap() {
        const heightmap = new SampledTerrain(undefined, undefined, ENAV_HEIGHTMAP_BASE_SHADER);
        heightmap.sampleInWorldFrame = false;
        heightmap.traverse(c => {
            c.receiveShadow = true;
            if (c.isMesh) c.renderOrder = -10;
        });

        const material = heightmap.mesh.material;
        material.side = DoubleSide;
        material.topoLineColor = 0x333333;
        material.maxSteepness = 0.75;
        material.steepnessColor = 0xff2233;
        material.rampMin = 1;
        material.rampMax = 0;
        material.rampColor = 0x0099ff;
        
        // difference of 5 should be good enough to avoid any z-fighting?
        material.clipPlane.set(0, -1, 0, CLIP_PLANE_Z_VALUE - 5);

        material.flatShading = true;
        material.defines.ENABLE_CLIP_PLANE = 1;
        material.defines.ENABLE_STEEPNESS_CLIP = 1;
        material.defines.ENABLE_STEEPNESS_VISUALIZATION = 1;
        material.defines.ENABLE_TOPO_LINES = 1;
        material.textureStampOpacity_costmap = 1;
        material.textureStampOpacity_cell_global_pos_err = 1;
        material.textureStampOpacity_is_dilated = 1;
        material.textureStampDitherOpacity_is_dilated = 0.3;
        material.gridLineThickness_costmap = 1.0;

        this.heightmap = heightmap;
        this.mapFrame.add(heightmap);
    }

    setupExtendedHeightmap() {
        const extendedHeightmap = new SampledTerrain(undefined, undefined, ENAV_HEIGHTMAP_BASE_SHADER);
        extendedHeightmap.sampleInWorldFrame = false;
        extendedHeightmap.traverse(c => {
            c.receiveShadow = true;
            if (c.isMesh) c.renderOrder = -10;
        });

        const material = extendedHeightmap.mesh.material;
        material.side = DoubleSide;
        material.flatShading = true;
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
        material.textureStampOpacity_costmap = 0.25;
        material.textureStampOpacity_cell_global_pos_err = 0.25;
        material.textureStampOpacity_is_dilated = 1;
        material.textureStampDitherOpacity_is_dilated = 0.3;
        material.gridLineThickness_costmap = 1.0;
        material.shininess = 1;

        this.extendedHeightmap = extendedHeightmap;
        this.mapFrame.add(extendedHeightmap);
    }

    update(annotation) {
        const heightmap = this.heightmap;
        const extendedHeightmap = this.extendedHeightmap;
        const heightmapTex = this.heightmapTex;
        const driver = this.driver;
        this.heightmap.visible = true;
        if (this.locked) return;

        this.sourceFile = annotation.file;
        this.dpFile = annotation.source;

        this.cacheMatrices();

        if (annotation.mapFrame) {
            const { x, y, yaw } = annotation.mapFrame;
            this.mapFrame.position.set(x, y, 0);
            this.mapFrame.rotation.set(0, 0, yaw);
        }

        // file might not have fully preloaded at this point
        if (annotation.cellZ) {
            if (this._lastInfo === annotation) return;
            this._lastInfo = annotation;

            const { enavDpGrid } = annotation;
            const { position, radius, numCells, resolution } = enavDpGrid;

            tempVec3.set(position.x + radius, position.y + radius, position.z);
            tempQuat.set(0, 0, 0, 1);
            tempScale.set(1, 1, 1);
            tempMat4.compose(tempVec3, tempQuat, tempScale);
            driver.applyFrameGroundTruthOffset(tempMat4);
            tempMat4.decompose(heightmap.position, heightmap.quaternion, tempScale);

            const cellSize = (radius * 2) / (numCells - 1);
            heightmap.setBounds(-radius, -radius, radius, radius, 0);

            // data in annotation.cellZ:
            // y-values are in the rows.
            // x points "up"
            // y points "right"
            // left to right, bottom to top
            if (!heightmap.sampler) {
                const sampler = new Sampler2D(annotation.cellZ, numCells, 1);
                sampler.rowMajor = false;
                sampler.interpolate = false;
                heightmap.sampler = sampler;
            } else {
                heightmap.sampler.data = annotation.cellZ;
            }
            heightmap.samples.set(numCells, numCells);
            heightmap.visible = true;
            heightmap.update();

            console.time('ENavArksmlDriver: Heightmap Flooding');
            const padding = 1;
            const mipChain = mipFlood(
                numCells,
                annotation.cellZ,
                ENAV_UNKNOWN,
                padding,
                extendedHeightmap.mipChain,
            );
            console.timeEnd('ENavArksmlDriver: Heightmap Flooding');

            const extendedData = mipChain[0];
            extendedHeightmap.mipChain = mipChain;
            heightmapTex.image.data = extendedData.cellZ;
            heightmapTex.image.width = extendedData.numCells;
            heightmapTex.image.height = extendedData.numCells;
            heightmapTex.needsUpdate = true;
            const extendedRadius = radius + cellSize * padding;
            const extendedNumCells = extendedData.numCells;
            extendedHeightmap.visible = true;
            extendedHeightmap.position.copy(heightmap.position);
            extendedHeightmap.quaternion.copy(heightmap.quaternion);
            extendedHeightmap.setBounds(
                -extendedRadius, -extendedRadius,
                extendedRadius, extendedRadius,
                0
            );

            let cellMin = Number.POSITIVE_INFINITY;
            let cellMax = Number.NEGATIVE_INFINITY;
            const convertedCellGlobalPosError =
                new Uint8Array(annotation.cellGlobalPosError.length * 4);

            for(let i = 0, l = annotation.cellGlobalPosError.length; i < l; i++) {
                if (annotation.cellGlobalPosError[i] !== ENAV_UNKNOWN) {
                    cellMin = Math.min(annotation.cellGlobalPosError[i], cellMin);
                    cellMax = Math.max(annotation.cellGlobalPosError[i], cellMax);
                }
            }
            for(let i = 0, l = annotation.cellGlobalPosError.length; i < l; i++) {
                const x = Math.floor(i / numCells);
                const y = i % numCells;
                const index = y * numCells + x;

                if (annotation.cellGlobalPosError[i] === ENAV_UNKNOWN) {
                    convertedCellGlobalPosError[4 * index + 0] = 0;
                    convertedCellGlobalPosError[4 * index + 1] = 0;
                    convertedCellGlobalPosError[4 * index + 2] = 0;
                    convertedCellGlobalPosError[4 * index + 3] = 0;
                } else {
                    const val =
                        ((annotation.cellGlobalPosError[i] - cellMin) / (cellMax - cellMin));
                    convertedCellGlobalPosError[4 * index + 0] = 19;
                    convertedCellGlobalPosError[4 * index + 1] = 22;
                    convertedCellGlobalPosError[4 * index + 2] = 25;
                    convertedCellGlobalPosError[4 * index + 3] = Math.floor(255 * (1 - val));
                }
            }

            this.cellGlobalPosErrorTex.image.data = convertedCellGlobalPosError;
            this.cellGlobalPosErrorTex.image.width = numCells;
            this.cellGlobalPosErrorTex.image.height = numCells;
            this.cellGlobalPosErrorTex.needsUpdate = true;

            const convertedIsDilated = new Uint8Array(annotation.cellIsDilated.length * 4);
            for (let i = 0, l = annotation.cellIsDilated.length; i < l; i++) {
                const x = Math.floor(i / numCells);
                const y = i % numCells;
                const index = y * numCells + x;
                if (annotation.cellIsDilated[i] === 0) {
                    convertedIsDilated[4 * index + 0] = 0;
                    convertedIsDilated[4 * index + 1] = 0;
                    convertedIsDilated[4 * index + 2] = 0;
                    convertedIsDilated[4 * index + 3] = 0;
                } else {
                    convertedIsDilated[4 * index + 0] = 255;
                    convertedIsDilated[4 * index + 1] = 255;
                    convertedIsDilated[4 * index + 2] = 255;
                    convertedIsDilated[4 * index + 3] = 255;
                }
            }
            
            this.isDilatedTex.image.data = convertedIsDilated;
            this.isDilatedTex.image.width = numCells;
            this.isDilatedTex.image.height = numCells;
            this.isDilatedTex.needsUpdate = true;

            tempVec3.set(
                enavDpGrid.position.x + enavDpGrid.radius,
                enavDpGrid.position.y + enavDpGrid.radius,
                0
            );
            tempScale.set(numCells * resolution, numCells * resolution, 1);
            tempQuat.set(0, 0, 0, 1);
            tempMat4.compose(tempVec3, tempQuat, tempScale);
            driver.applyFrameGroundTruthOffset(tempMat4);
            this.mapFrame.updateWorldMatrix(true);
            tempMat4.premultiply(this.mapFrame.matrixWorld);

            const heightmapMat = heightmap.mesh.material;
            const extendedMat = extendedHeightmap.mesh.material;
            tempMat4.invert();
            heightmapMat.textureStampFrameInverse_cell_global_pos_err.copy(tempMat4);
            extendedMat.textureStampFrameInverse_cell_global_pos_err.copy(tempMat4);
            heightmapMat.textureStampFrameInverse_is_dilated.copy(tempMat4);
            extendedMat.textureStampFrameInverse_is_dilated.copy(tempMat4);
            heightmapMat.gridStampFrameInverse_heightmap.copy(tempMat4);
            extendedMat.gridStampFrameInverse_heightmap.copy(tempMat4);

            heightmapMat.gridResolution_heightmap.set(numCells, numCells);
            extendedMat.gridResolution_heightmap.set(numCells, numCells);

            if (!extendedHeightmap.sampler) {
                const sampler = new Sampler2D(extendedData.cellZ, extendedNumCells, 1);
                sampler.rowMajor = false;
                sampler.interpolate = false;
                extendedHeightmap.sampler = sampler;
            } else {
                extendedHeightmap.sampler.data = extendedData.cellZ;
            }
            extendedHeightmap.samples.set(extendedNumCells, extendedNumCells);
            extendedHeightmap.update();

            // take padding around perimeter of mesh and extrude it out
            const extendedWidth = 4 * extendedRadius;
            const minEdge = -0.5 - extendedWidth;
            const maxEdge = 0.5 + extendedWidth;
            const edgeWidth = maxEdge - minEdge;
            const geomArray = extendedHeightmap.mesh.geometry.attributes.position.array;
            for (let i = 0; i < extendedNumCells; i++) {
                const rat = i / (extendedNumCells - 1);
                const pos = minEdge + edgeWidth * rat;
                const x1 = i;
                const x2 = extendedNumCells * (extendedNumCells - 1) + i;
                geomArray[x1 * 3 + 1] = maxEdge;
                geomArray[x2 * 3 + 1] = minEdge;

                geomArray[x1 * 3 + 0] = pos;
                geomArray[x2 * 3 + 0] = pos;

                const y1 = i * extendedNumCells;
                const y2 = i * extendedNumCells + extendedNumCells - 1;
                geomArray[y1 * 3 + 0] = minEdge;
                geomArray[y2 * 3 + 0] = maxEdge;

                geomArray[y1 * 3 + 1] = -pos;
                geomArray[y2 * 3 + 1] = -pos;
            }

            // TODO:
            // Clamp the height to address a rendering issue on OSX laptops
            // The clip plane shader has been added to remove the excess mesh at the bottom
            // https://stackoverflow.com/questions/53623345/flat-shaded-three-phong-material-renders-with-lots-of-noise
            // Issue #166
            const posArr = heightmap.mesh.geometry.attributes.position.array;
            for (let i = 0; i < posArr.length; i += 3) {
                posArr[i + 2] = Math.min(posArr[i + 2], CLIP_PLANE_Z_VALUE);
            }
            heightmap.mesh.material.uniforms.steepnessClip.value = 0.01;
            tempVec3.set(0, 0, 1);
            tempVec3.applyQuaternion(heightmap.quaternion);
            tempVec3.applyQuaternion(this.mapFrame.quaternion);
            tempVec3.applyMatrix4(driver.viewer.world.matrixWorld);
            heightmap.mesh.material.uniforms.steepnessClipVector.value.copy(tempVec3);
            // multiply by -1 because previous vector was pointing "down" rel to rover
            heightmap.mesh.material.uniforms.steepnessColorVector.value.copy(
                tempVec3.multiplyScalar(-1),
            );
        } else {
            this.heightmap.visible = false;
        }
    }

    reset() {
        if (!this.locked) {
            this.heightmap.visible = false;
        }
    }

    getCostmapUVFromScenePos(pos) {
        tempVec3.copy(pos);

        const heightmapMat = this.heightmap.mesh.material;
        const textureStampFrameInverse = heightmapMat.textureStampFrameInverse_costmap;
        tempVec3.applyMatrix4(textureStampFrameInverse);
        const x = Math.min(Math.max(tempVec3.x + 0.5, 0), 1);
        const y = Math.min(Math.max(tempVec3.y + 0.5, 0), 1);
        return new Vector2(x, y);
    }

    getCellGlobalPosErrFromScenePos(pos) {
        tempVec3.copy(pos);

        const heightmapMat = this.heightmap.mesh.material;
        const textureStampFrameInverse = heightmapMat.textureStampFrameInverse_cell_global_pos_err;
        tempVec3.applyMatrix4(textureStampFrameInverse);
        const x = Math.min(Math.max(tempVec3.x + 0.5, 0), 1);
        const y = Math.min(Math.max(tempVec3.y + 0.5, 0), 1);

        const uIndex = Math.floor(y * this.cellGlobalPosErrorTex.image.width);
        const vIndex = Math.floor(x * this.cellGlobalPosErrorTex.image.height);
        const index = (vIndex * this.cellGlobalPosErrorTex.image.height + uIndex);

        if (this._lastInfo && index < this._lastInfo.cellGlobalPosError.length) {
            return this._lastInfo.cellGlobalPosError[index];
        } else {
            return Number.NaN;
        }
    }

    getIsDilatedFromScenePos(pos) {
        tempVec3.copy(pos);

        const heightmapMat = this.heightmap.mesh.material;
        const textureStampFrameInverse = heightmapMat.textureStampFrameInverse_is_dilated;
        tempVec3.applyMatrix4(textureStampFrameInverse);
        const x = Math.min(Math.max(tempVec3.x + 0.5, 0), 1);
        const y = Math.min(Math.max(tempVec3.y + 0.5, 0), 1);

        const uIndex = Math.floor(y * this.isDilatedTex.image.width);
        const vIndex = Math.floor(x * this.isDilatedTex.image.height);
        const index = (vIndex * this.isDilatedTex.image.height + uIndex);

        if (this._lastInfo && index < this._lastInfo.cellIsDilated?.length) {
            return this._lastInfo.cellIsDilated[index] !== 0;
        } else {
            return false;
        }
    }

    cacheMatrices() {
        const driver = this.driver;
        const viewer = driver.viewer;
        const options = driver.options;
        const simRobot = viewer.getRobot(options.robot);
        const gtRobot = viewer.getRobot(options.groundTruthRobot);

        if (gtRobot) {
            gtRobot.updateWorldMatrix(false, false);
            this.gtRobotMat4.copy(gtRobot.matrixWorld);
        } else {
            this.gtRobotMat4.identity();
        }

        simRobot.updateWorldMatrix(false, false);
        this.mapFrame.updateWorldMatrix(false, false);

        this.mapFrameMat4.copy(this.mapFrame.matrixWorld);
        this.simRobotMat4.copy(simRobot.matrixWorld);
    }
}
