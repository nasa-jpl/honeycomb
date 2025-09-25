import {
    ClampToEdgeWrapping,
    Color,
    DataTexture,
    DoubleSide,
    FloatType,
    Group,
    LinearFilter,
    MeshPhongMaterial,
    RedFormat,
    RGBAFormat,
    ShaderLib,
    ShaderMaterial,
    UnsignedByteType,
    Vector4
} from "three";

import { PanelOptionsEditorBuilder } from "@grafana/data";

import { SampledTerrain } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import { Sampler2D, SpatialSampler2D } from '@gov.nasa.jpl.honeycomb/sampler-2d';
import { Mixins } from '@gov.nasa.jpl.honeycomb/mixin-shaders';
import { Annotation, AnnotationSchemaDataModel } from "@gov.nasa.jpl.honeycomb/core";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";

import {
    mipFlood,
    tempVec3,
    tempScale,
    tempQuat,
    tempMat4
} from './enav_utils';
import { parseColor } from "./ColorMapMaterial";
import { widgetFromBuilder } from "./util";

interface EnavOptions {
    /**
     * Render order of grid to display above or below other objects
     */
    renderOrder: number;

    costGrid: boolean;
    heightGrid: boolean;
    topolines: boolean;
    steepness: boolean;
    color: string;
}

interface EnavDpGrid {
    x_min: number; // Minimum MAP x coordinate of the grid cells
    y_min: number; // Minimum MAP y coordinate of the grid cells
    res: number; // Resolution of the grid cells
    radius: number; // Radius of the square grid
    n_cells: number; // Number of cells along x/y axis
}

interface EnavDpHeightmap {
    sclk_time: number; // Spacecraft clock time
    grid: EnavDpGrid; // Grid parameters of the heightmap
    cell_z: Float32Array; // cell_z[i * n_cells + j] = cell[i][j].z
    cell_global_pos_error: Float32Array; // cell_global_pos_error[i * n_cells + j] = cell[i][j].global_pos_error
    cell_is_dilated: Uint8Array; // cell_is_dilated[i * n_cells + j] = cell[i][j].is_dilated
    global_pos_error: number; // Radius of the disc representing the global position uncertainty of the rover when the heightmap was last updated
}

interface EnavDpCostmap {
    sclk_time: number; // Spacecraft clock time
    grid: EnavDpGrid; // Grid parameters of the costmap
    cell_type: Int32Array; // cell_type[i * n_cells + j] = cell[i][j].type
    cell_tilt: Float32Array; // cell_tilt[i * n_cells + j] = cell[i][j].tilt
    cell_roughness: Float32Array; // cell_roughness[i * n_cells + j] = cell[i][j].roughness
    cell_cost_type: Int32Array; // cell_cost_type[i * n_cells + j] = cell[i][j].cost_info.type
}

interface EnavData {
    heightmap?: EnavDpHeightmap;
    costmap?: EnavDpCostmap;
}

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

// for things we haven't decided a color on, just color green
const costIndexToColor = [
    0x111111,
    0xffa500,
    0xff00ff,
    0x0000ff,
    0xff0000,
    0x8b0000,
    0xffff00,
    0x008b8b,
    0x90ee90,
    0x00ffff,
    0x808080,
    0x808080,
    0x808080,
    0x808080,
    0x808080,
    0x808080,
    0x00ff00,
];


export class EnavCostmap extends DataTexture {
    constructor(readonly heightmap: Enav) {
        super();

        this.format = RGBAFormat;
        this.type = UnsignedByteType;
    }

    update(annotation: EnavDpCostmap) {
        // Set the position of the costmap
        // TODO: This needs to be positioned relative to the rover at
        // a certain time. Here the map is position where the rover happens
        // to be.
        const { grid } = annotation;
        const { x_min, y_min, n_cells, res, radius } = grid;
        tempScale.set(n_cells * res, n_cells * res, 1);
        tempVec3.set(
            x_min + radius,
            y_min + radius,
            0
        );
        tempQuat.set(0, 0, 0, 1);
        tempMat4.compose(tempVec3, tempQuat, tempScale);

        this.heightmap.updateMatrixWorld();
        tempMat4.premultiply(this.heightmap.matrixWorld);
        tempMat4.invert();

        const totalNumCells = n_cells * n_cells;

        const image = this.image;
        if (!image.data || image.data.length !== 4 * totalNumCells) {
            image.data = new Uint8Array(4 * totalNumCells);
            image.width = n_cells;
            image.height = n_cells;
        }

        const costmapData = image.data;
        for (let x = 0; x < n_cells; x++) {
            for (let y = 0; y < n_cells; y++) {
                // need to transpose the data in order for
                // costmap to be properly rendered in viewer
                const i = y * n_cells + x;
                const transposed = x * n_cells + y;
                // don't draw if there were "NO_ISSUES"
                if (annotation.cell_cost_type[i] === 0) {
                    costmapData[transposed * 4 + 0] = 255;
                    costmapData[transposed * 4 + 1] = 0;
                    costmapData[transposed * 4 + 2] = 0;
                    costmapData[transposed * 4 + 3] = 0;
                } else {
                    // convert hex to rgb
                    const color = costIndexToColor[annotation.cell_cost_type[i]];
                    costmapData[transposed * 4 + 0] = (color >> 16) & 255;
                    costmapData[transposed * 4 + 1] = (color >> 8) & 255;
                    costmapData[transposed * 4 + 2] = color & 255;
                    costmapData[transposed * 4 + 3] = 255;
                }
            }
        }

        // Update the stamped cost map
        const heightmap = this.heightmap;

        tempMat4.decompose(tempVec3, tempQuat, tempScale);

        const mat = heightmap.heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        const extendedMat = heightmap.extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;

        mat.uniforms.textureStampFrameInverse_costmap.value.copy(tempMat4);
        extendedMat.uniforms.textureStampFrameInverse_costmap.value.copy(tempMat4);
        mat.uniforms.gridStampFrameInverse_costmap.value.copy(tempMat4);
        extendedMat.uniforms.gridStampFrameInverse_costmap.value.copy(tempMat4);

        mat.uniforms.gridResolution_costmap.value.set(n_cells, n_cells);
        extendedMat.uniforms.gridResolution_costmap.value.set(n_cells, n_cells);

        mat.needsUpdate = true;
        extendedMat.needsUpdate = true;

        this.needsUpdate = true;
        mat.uniformsNeedUpdate = true;
        extendedMat.uniformsNeedUpdate = true;
    }
}

const widgetBuilder = (new PanelOptionsEditorBuilder<EnavOptions>())
    .addBooleanSwitch({
        path: 'costGrid',
        name: 'Cost Grid',
        description: 'Overlay costmap cell grid onto the heightmap',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'heightGrid',
        name: 'Height Grid',
        description: 'Overlay heightmap cell grid onto the heightmap geometry',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'topolines',
        name: 'Topolines',
        description: 'Overlay topology lines every 10cm with 1m emphasis lines',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'steepness',
        name: 'Steepness Visualization',
        description: 'Color steep planes red',
        defaultValue: true
    }).addColorPicker({
        path: 'color',
        name: 'Color',
        description: 'Heightmap mesh color',
        defaultValue: "#1111111",
        settings: {
            enableNamedColors: false
        }
    });

export class Enav extends Group implements Annotation<EnavData, EnavOptions> {
    heightmap: SampledTerrain;
    extendedHeightmap: SampledTerrain;

    /**
     * The heightmap texture that is shared across other ENav visualizations
     */
    texture: DataTexture;

    private _cellGlobalPosErrorTex!: DataTexture;
    private _isDilatedTex!: DataTexture;

    private _lastInfo?: {
        cell_z?: Float32Array;
        cell_cost_type?: Int32Array;
    };

    costmap: EnavCostmap;

    constructor() {
        super();

        this.receiveShadow = true;

        this.texture = new DataTexture();
        this.texture.format = RedFormat;
        this.texture.type = FloatType;
        this.texture.wrapS = ClampToEdgeWrapping;
        this.texture.wrapT = ClampToEdgeWrapping;
        this.texture.magFilter = LinearFilter;

        // Heightmap setup
        {
            const heightmap = new SampledTerrain(undefined, undefined, ENAV_HEIGHTMAP_BASE_SHADER);
            heightmap.sampleInWorldFrame = false;
            heightmap.traverse(c => {
                c.receiveShadow = true;
                if ((c as any).isMesh) { c.renderOrder = -10; }
            });

            const material = heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;

            material.side = DoubleSide;
            material.uniforms.topoLineColor.value = new Color(0x333333);
            material.uniforms.maxSteepness.value = 0.75;
            material.uniforms.steepnessColor.value = new Color(0xff2233);
            material.uniforms.rampMin.value = 1;
            material.uniforms.rampMax.value = 0;
            material.uniforms.rampColor.value = new Color(0x0099ff);
            material.uniforms.clipPlane.value.set(0, -1, 0, 49.5);
            material.uniforms.diffuse = { value: new Vector4(0xEE, 0xEE, 0xEE, 1) };
            material.flatShading = true;

            material.defines.ENABLE_CLIP_PLANE = 1;
            material.defines.ENABLE_STEEPNESS_CLIP = 1;
            material.defines.ENABLE_STEEPNESS_VISUALIZATION = 1;
            material.defines.ENABLE_TOPO_LINES = 1;
            material.defines.ENABLE_TEXTURE_STAMP = 1;
            material.defines.ENABLE_TEXTURE_STAMP_costmap = 1;
            material.defines.ENABLE_TEXTURE_STAMP_cell_global_pos_err = 1;
            material.defines.ENABLE_TEXTURE_STAMP_is_dilated = 1;
            material.defines.ENABLE_GRID_STAMP_costmap = 1;
            material.defines.ENABLE_GRID_STAMP_heightmap = 1;

            material.uniforms.textureStampOpacity_costmap.value = 1;
            material.uniforms.textureStampOpacity_cell_global_pos_err.value = 1;
            material.uniforms.textureStampOpacity_is_dilated.value = 1;
            material.uniforms.textureStampDitherOpacity_is_dilated.value = 0.3;
            material.uniforms.gridLineThickness_costmap.value = 1.0;

            this.heightmap = heightmap;
            this.add(heightmap);
        }

        // Extended heightmap
        {
            const extendedHeightmap = new SampledTerrain(undefined, undefined, ENAV_HEIGHTMAP_BASE_SHADER);
            extendedHeightmap.sampleInWorldFrame = false;
            extendedHeightmap.traverse(c => {
                c.receiveShadow = true;
                if ((c as any).isMesh) { c.renderOrder = -10; }
            });

            const material = extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
            material.side = DoubleSide;
            material.flatShading = true;
            material.transparent = true;
            material.opacity = 1;
            material.depthWrite = false;
            material.polygonOffset = true;
            material.polygonOffsetFactor = 1;
            material.polygonOffsetUnits = 1;

            material.defines.ENABLE_CLIP_PLANE = 1;
            material.defines.ENABLE_STEEPNESS_CLIP = 1;
            material.defines.ENABLE_STEEPNESS_VISUALIZATION = 1;
            material.defines.ENABLE_TOPO_LINES = 1;
            material.defines.ENABLE_TEXTURE_STAMP = 1;

            material.defines.ENABLE_TEXTURE_STAMP = 1;
            material.defines.ENABLE_TEXTURE_STAMP_costmap = 1;
            material.defines.ENABLE_TEXTURE_STAMP_cell_global_pos_err = 1;
            material.defines.ENABLE_TEXTURE_STAMP_is_dilated = 1;
            material.defines.ENABLE_GRID_STAMP_costmap = 1;
            material.defines.ENABLE_GRID_STAMP_heightmap = 1;

            material.uniforms.textureStampOpacity_costmap.value = 0.25;
            material.uniforms.textureStampOpacity_cell_global_pos_err.value = 0.25;
            material.uniforms.textureStampOpacity_is_dilated.value = 1;
            material.uniforms.textureStampDitherOpacity_is_dilated.value = 0.3;
            material.uniforms.gridLineThickness_costmap.value = 1.0;
            material.uniforms.shininess.value = 1;

            this.extendedHeightmap = extendedHeightmap;
            this.add(extendedHeightmap);
        }

        const cellGlobalPosErrorTex = new DataTexture();
        cellGlobalPosErrorTex.format = RGBAFormat;
        cellGlobalPosErrorTex.type = UnsignedByteType;
        this.cellGlobalPosErrorTex = cellGlobalPosErrorTex;

        const isDilatedTex = new DataTexture();
        isDilatedTex.format = RGBAFormat;
        isDilatedTex.type = UnsignedByteType;
        this.isDilatedTex = isDilatedTex;

        this.costmap = new EnavCostmap(this);
        this.costmapTex = this.costmap;
    }

    set costmapTex(val: EnavCostmap) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        heightmapMat.uniforms.textureStampMap_costmap.value = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        extendedMat.uniforms.textureStampMap_costmap.value = val;
    }

    set cellGlobalPosErrorTex(val: DataTexture) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        heightmapMat.uniforms.textureStampMap_cell_global_pos_err.value = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        extendedMat.uniforms.textureStampMap_cell_global_pos_err.value = val;

        this._cellGlobalPosErrorTex = val;
    }

    get cellGlobalPosErrorTex() {
        return this._cellGlobalPosErrorTex;
    }

    set isDilatedTex(val: DataTexture) {
        const heightmap = this.heightmap;
        const heightmapMat = heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        heightmapMat.uniforms.textureStampMap_is_dilated.value = val;

        const extendedHeightmap = this.extendedHeightmap;
        const extendedMat = extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        extendedMat.uniforms.textureStampMap_is_dilated.value = val;

        this._isDilatedTex = val;
    }

    get isDilatedTex() {
        return this._isDilatedTex;
    }

    private updateHeightmap(data: EnavDpHeightmap) {
        if (Object.is(this._lastInfo?.cell_z, data.cell_z)) {
            return;
        }

        const heightmap = this.heightmap;
        const extendedHeightmap = this.extendedHeightmap;
        this.heightmap.visible = true;

        this._lastInfo = {
            ...data
        };

        const cellZ = data.cell_z;
        const cell_global_pos_error = data.cell_global_pos_error;
        const cell_is_dilated = data.cell_is_dilated;

        const { radius, n_cells, x_min, y_min, res } = data.grid;

        tempVec3.set(
            x_min + radius,
            y_min + radius,
            0
        );

        tempQuat.set(0, 0, 0, 1);
        tempScale.set(n_cells * res, n_cells * res, 1);
        tempMat4.compose(tempVec3, tempQuat, tempScale);
        tempMat4.decompose(heightmap.position, heightmap.quaternion, tempScale);

        const cellSize = (radius * 2) / (n_cells - 1);
        heightmap.setBounds(-radius, -radius, radius, radius, 0);

        // data in annotation.cellZ:
        // y-values are in the rows.
        // x points "up"
        // y points "right"
        // left to right, bottom to top
        if (!heightmap.sampler) {
            const sampler = new Sampler2D(
                cellZ,
                n_cells,
                1
            );

            sampler.rowMajor = false;
            sampler.interpolate = false;
            heightmap.sampler = sampler;
        } else {
            (heightmap.sampler as SpatialSampler2D).data = cellZ;
        }
        heightmap.samples.set(n_cells, n_cells);
        heightmap.visible = true;
        heightmap.update();

        const padding = 1;
        const mipChain = mipFlood(
            n_cells,
            cellZ,
            ENAV_UNKNOWN,
            padding,
            extendedHeightmap.mipChain,
        );

        const extendedData = mipChain[0];
        extendedHeightmap.mipChain = mipChain;

        this.texture.image = {
            data: extendedData.cellZ as unknown as Uint8Array,
            width: extendedData.numCells,
            height: extendedData.numCells
        };
        this.texture.needsUpdate = true;

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
            new Uint8ClampedArray(cell_global_pos_error.length * 4);

        for (let i = 0, l = cell_global_pos_error.length; i < l; i++) {
            if (cell_global_pos_error[i] !== ENAV_UNKNOWN) {
                cellMin = Math.min(cell_global_pos_error[i], cellMin);
                cellMax = Math.max(cell_global_pos_error[i], cellMax);
            }
        }

        for (let i = 0, l = cell_global_pos_error.length; i < l; i++) {
            const x = Math.floor(i / n_cells);
            const y = i % n_cells;
            const index = y * n_cells + x;

            if (cell_global_pos_error[i] === ENAV_UNKNOWN) {
                convertedCellGlobalPosError[4 * index + 0] = 0;
                convertedCellGlobalPosError[4 * index + 1] = 0;
                convertedCellGlobalPosError[4 * index + 2] = 0;
                convertedCellGlobalPosError[4 * index + 3] = 0;
            } else {
                const val =
                    ((cell_global_pos_error[i] - cellMin) / (cellMax - cellMin));
                convertedCellGlobalPosError[4 * index + 0] = 19;
                convertedCellGlobalPosError[4 * index + 1] = 22;
                convertedCellGlobalPosError[4 * index + 2] = 25;
                convertedCellGlobalPosError[4 * index + 3] = Math.floor(255 * (1 - val));
            }
        }

        this.cellGlobalPosErrorTex.image = {
            data: convertedCellGlobalPosError,
            width: n_cells,
            height: n_cells
        };

        this.cellGlobalPosErrorTex.needsUpdate = true;

        const convertedIsDilated = new Uint8ClampedArray(cell_is_dilated.length * 4);
        for (let i = 0, l = cell_is_dilated.length; i < l; i++) {
            const x = Math.floor(i / n_cells);
            const y = i % n_cells;
            const index = y * n_cells + x;
            if (cell_is_dilated[i] === 0) {
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

        this.isDilatedTex.image = {
            data: convertedIsDilated,
            width: n_cells,
            height: n_cells
        };

        this.isDilatedTex.needsUpdate = true;

        tempVec3.set(
            x_min + radius,
            y_min + radius,
            0
        );
        tempScale.set(
            n_cells * res,
            n_cells * res,
            1
        );
        tempQuat.set(0, 0, 0, 1);
        tempMat4.compose(tempVec3, tempQuat, tempScale);
        // driver.applyFrameGroundTruthOffset(tempMat4);
        this.updateWorldMatrix(true, false);
        tempMat4.premultiply(this.matrixWorld);

        const heightmapMat = heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        const extendedMat = extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        tempMat4.invert();
        tempMat4.decompose(tempVec3, tempQuat, tempScale);
        heightmapMat.uniforms.textureStampFrameInverse_cell_global_pos_err.value.copy(tempMat4);
        extendedMat.uniforms.textureStampFrameInverse_cell_global_pos_err.value.copy(tempMat4);
        heightmapMat.uniforms.textureStampFrameInverse_is_dilated.value.copy(tempMat4);
        extendedMat.uniforms.textureStampFrameInverse_is_dilated.value.copy(tempMat4);
        heightmapMat.uniforms.gridStampFrameInverse_heightmap.value.copy(tempMat4);
        extendedMat.uniforms.gridStampFrameInverse_heightmap.value.copy(tempMat4);

        heightmapMat.uniforms.gridResolution_heightmap.value.set(
            n_cells,
            n_cells
        );

        extendedMat.uniforms.gridResolution_heightmap.value.set(
            n_cells,
            n_cells
        );

        if (!extendedHeightmap.sampler) {
            const sampler = new Sampler2D(extendedData.cellZ, extendedNumCells, 1);
            sampler.rowMajor = false;
            sampler.interpolate = false;
            extendedHeightmap.sampler = sampler;
        } else {
            (extendedHeightmap.sampler as SpatialSampler2D).data = extendedData.cellZ;
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
            posArr[i + 2] = Math.min(posArr[i + 2], 50);
        }
        const mat = heightmap.mesh.material as ShaderMaterial;
        mat.uniforms.steepnessClip.value = 0.01;
        tempVec3.set(0, 0, 1);
        tempVec3.applyQuaternion(heightmap.quaternion);
        tempVec3.applyQuaternion(this.quaternion);
        tempVec3.applyMatrix4(this.parent!.matrixWorld);
        mat.uniforms.steepnessClipVector.value.copy(tempVec3);
        // multiply by -1 because previous vector was pointing "down" rel to rover
        mat.uniforms.steepnessColorVector.value.copy(
            tempVec3.multiplyScalar(-1),
        );
    }

    update(data: EnavData) {
        if (data.heightmap) {
            this.updateHeightmap(data.heightmap);
        }

        if (data.costmap) {
            this.costmap.update(data.costmap);
        }
    }

    options(_options: Partial<EnavOptions>): void {
        const options = {
            renderOrder: 0,
            costGrid: true,
            heightGrid: true,
            topolines: true,
            steepness: true,
            color: "#111111",
            ..._options,
        } satisfies EnavOptions;

        this.renderOrder = options.renderOrder ?? this.renderOrder;

        let material = this.heightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        material.defines.ENABLE_GRID_STAMP_costmap = options.costGrid ? 1 : 0;
        material.defines.ENABLE_GRID_STAMP_heightmap = options.heightGrid ? 1 : 0;
        material.defines.ENABLE_TOPO_LINES = options.topolines ? 1 : 0;
        material.defines.ENABLE_STEEPNESS_VISUALIZATION = options.steepness ? 1 : 0;

        const [r, g, b, a] = parseColor(options.color);
        material.uniforms.diffuse.value.set(r, g, b, a);

        material.needsUpdate = true;
        material.uniformsNeedUpdate = true;

        material = this.extendedHeightmap.mesh.material as ShaderMaterial & MeshPhongMaterial;
        material.defines.ENABLE_GRID_STAMP_costmap = options.costGrid ? 1 : 0;
        material.defines.ENABLE_GRID_STAMP_heightmap = options.heightGrid ? 1 : 0;
        material.defines.ENABLE_TOPO_LINES = options.topolines ? 1 : 0;
        material.defines.ENABLE_STEEPNESS_VISUALIZATION = options.steepness ? 1 : 0;

        material.needsUpdate = true;
        material.uniformsNeedUpdate = true;
    }
}

export const enavRegistration = new AnnotationRegistryItem({
    classType: Enav,
    type: "enav",
    name: "M20 ENav",
    description: "Mars 2020 Costmap & Heightmap visualization",
    widget: widgetFromBuilder(widgetBuilder),

    schema: {
        dataModel: AnnotationSchemaDataModel.structured,
        fields: [
            {
                name: 'heightmap',
                description: 'navlib.EnavHeightmap DPO table'
            },
            {
                name: 'costmap',
                description: 'navlib.EnavCostmap DPO table'
            }
        ]
    }
});

export const enavRegistrationOptions = (builder: PanelOptionsEditorBuilder<EnavOptions>) => {
    builder.addBooleanSwitch({
        path: 'costGrid',
        name: 'Cost Grid',
        description: 'Overlay costmap cell grid onto the heightmap',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'heightGrid',
        name: 'Height Grid',
        description: 'Overlay heightmap cell grid onto the heightmap geometry',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'topolines',
        name: 'Topolines',
        description: 'Overlay topology lines every 10cm with 1m emphasis lines',
        defaultValue: true
    }).addBooleanSwitch({
        path: 'steepness',
        name: 'Steepness Visualization',
        description: 'Color steep planes red',
        defaultValue: true
    }).addColorPicker({
        path: 'color',
        name: 'Color',
        description: 'Heightmap mesh color',
        defaultValue: "#1111111",
        settings: {
            enableNamedColors: false
        }
    }).addNumberInput({
        path: 'renderOrder',
        name: 'Render Order',
        description: 'Objects with higher numbers will be rendered over lower numbers',
        defaultValue: 0
    });
};
