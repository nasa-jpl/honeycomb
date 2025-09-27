import {
    BufferAttribute,
    Color,
    DoubleSide,
    DynamicDrawUsage,
    Group,
    Vector2
} from "three";

import { base64ToArrayBuffer } from "../../honeycomb/utils";

import { SampledTerrain } from "@gov.nasa.jpl.honeycomb/terrain-rendering";
import { SpatialSampler2D } from "@gov.nasa.jpl.honeycomb/sampler-2d";
import {
    Annotation,
    AnnotationSchemaDataModel,
    ChannelSchemaType
} from "@gov.nasa.jpl.honeycomb/core";
import { PanelOptionsEditorBuilder } from "@grafana/data";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";


// Stringified version of dataArrayType for storing in panel
enum DataTypeS {
    U8 = 'U8',
    U16 = 'U16',
    U32 = 'U32',
    F32 = 'F32'
}

enum SpecialValueHandling {
    CLIFF = 'CLIFF',
    COLOR = 'COLOR'
}

enum RenderingStyle {
    COLOR = 'COLOR',
    TOPOLINES = 'TOPOLINES',
    SLOPE = 'SLOPE'
}

interface HeightMapOptions {
    /**
     * Width of grid plane (X scale)
     */
    width: number;

    /**
     * Height of the grid plane (Y scale)
     */
    height: number;

    /**
     * Width of grid in cells
     */
    cellX: number;

    /**
     * Height of grid in cells
     */
    cellY: number;

    /**
     * Data to interpret bytes as
     */
    dataType: DataTypeS;

    /**
     * How should we render the height map?
     * E.g., solid color, with topo lines, with slope viz?
     */
    renderingStyle: RenderingStyle;

    /**
     * If rendering with color, what color to use?
     */
    meshColor: string;

    /**
     * If rendering slope, the max slope angle to show in the color map
     */
    maxSlopeAngle: number;

    /**
     * Opacity of the mesh
     */
    opacity: number;

    /**
     * Render order of grid to display above or below other objects
     */
    renderOrder: number;

    /**
     * The following are used for handling special values of the
     * height map data? For example, if a value of 0 is considered 
     * invalid or unknown, we can color the mesh with a specific
     * color for those values, or maybe show it as a cliff, etc.
     */
    handleSpecialValue: boolean;
    specialValue?: number;
    specialValueApproach?: SpecialValueHandling;
    specialValueColor?: string;
}

interface HeightMapData {
    data: string;
}

export class HeightMapAnnotation extends Group
    implements Annotation<HeightMapData, HeightMapOptions> {
    dataBase64?: string;
    dataArray?: ArrayBuffer;

    // we store the terrain as a child object since
    // SampleTerrain has its own "update" function which
    // conflicts with the Annotation.update() function
    terrain: SampledTerrain;
    dataType: DataTypeS = DataTypeS.F32;

    meshColor: string;
    maxSlopeAngle = 30;

    handleSpecialValue = false;
    specialValue?: number;
    specialValueApproach?: SpecialValueHandling;
    specialValueColor?: string;

    constructor() {
        super();

        const width = 128;
        const height = 128;
        const resolution = 1;
        const width1 = width - 1;
        const height1 = height - 1;
        const sampler = new SpatialSampler2D(new Uint8Array(), width, 1);

        this.meshColor = '#c8c8c8';

        this.terrain = new SampledTerrain(sampler);
        this.add(this.terrain);

        const material = (this.terrain.mesh.material as any);
        material.side = DoubleSide;
        // expose to the UI the ability to turn on slope or topographic line shading; see:
        // - pkg/mixin-shaders/README.md
        // - pkg/mixin-shaders/src/shaderMixins.ts 
        material.flatShading = true; // needed for slope map to look ok
        material.topoLineColor.set(0xff0000);
        material.defines.ENABLE_TOPO_LINES = 1;
        material.maxDotProduct = Math.cos(this.maxSlopeAngle * Math.PI / 180);
        material.needsUpdate = true;

        this.terrain.setBounds(
            (-width1 * resolution) / 2.0,
            (-height1 * resolution) / 2.0,
            (width1 * resolution) / 2.0,
            (height1 * resolution) / 2.0,
            0,
        );
        this.terrain.samples.set(width, height);
        this.terrain.sampleInWorldFrame = false;
    }

    options(_options: Partial<HeightMapOptions>): void {
        const options: HeightMapOptions = {
            width: 1,
            height: 1,
            cellX: 100,
            cellY: 100,
            renderingStyle: RenderingStyle.COLOR,
            meshColor: '#c8c8c8',
            maxSlopeAngle: 30,
            renderOrder: 0,
            opacity: 1,
            dataType: DataTypeS.U8,
            handleSpecialValue: false,
            ..._options
        };

        this.renderOrder = options.renderOrder;

        this.scale.set(
            options.width / options.cellX,
            options.height / options.cellY,
            1
        );

        this.meshColor = options.meshColor;
        const material = (this.terrain.mesh.material as any);
        material.opacity = options.opacity;
        material.diffuse = new Color(this.meshColor);
        material.defines.ENABLE_TOPO_LINES = options.renderingStyle === RenderingStyle.TOPOLINES ? 1 : 0;
        material.defines.ENABLE_SLOPE_ANGLE_VISUALIZATION = options.renderingStyle === RenderingStyle.SLOPE ? 1 : 0;

        material.uniforms.maxSteepness.value = 0.75;
        material.uniforms.steepnessColor.value = new Color(0xff2233);
        material.uniforms.rampMin.value = 1;
        material.uniforms.rampMax.value = 0;
        material.uniforms.rampColor.value = new Color(0x0099ff);
        material.uniforms.clipPlane.value.set(0, -1, 0, 49.5);

        material.defines.ENABLE_CLIP_PLANE = 1;
        material.defines.ENABLE_STEEPNESS_CLIP = 1;
        material.defines.ENABLE_STEEPNESS_VISUALIZATION = 1;

        this.maxSlopeAngle = options.maxSlopeAngle;
        material.maxDotProduct = Math.cos(this.maxSlopeAngle * Math.PI / 180);
        material.needsUpdate = true;

        if (this.terrain.sampler) {
            const height = options.cellY;
            const width = options.cellX;
            (this.terrain.sampler as SpatialSampler2D).height = height;
            (this.terrain.sampler as SpatialSampler2D).width = width;

            const width1 = width - 1;
            const height1 = height - 1;
            const resolution = 1;
            this.terrain.setBounds(
                (-width1 * resolution) / 2.0,
                (-height1 * resolution) / 2.0,
                (width1 * resolution) / 2.0,
                (height1 * resolution) / 2.0,
                0,
            );
            this.terrain.samples.set(width, height);
        }

        let shouldUpdateData = false;
        if (this.dataType !== options.dataType) {
            this.dataType = options.dataType;
            shouldUpdateData = true;
        }

        if (this.handleSpecialValue !== options.handleSpecialValue) {
            this.handleSpecialValue = options.handleSpecialValue;
            shouldUpdateData = true;
        }

        if (this.specialValue !== options.specialValue) {
            this.specialValue = options.specialValue;
            shouldUpdateData = true;
        }

        if (this.specialValueApproach !== options.specialValueApproach) {
            this.specialValueApproach = options.specialValueApproach;
            shouldUpdateData = true;
        }

        if (this.specialValueApproach !== options.specialValueApproach) {
            this.specialValueApproach = options.specialValueApproach;
            shouldUpdateData = true;
        }

        if (this.specialValueColor !== options.specialValueColor) {
            this.specialValueColor = options.specialValueColor;
            shouldUpdateData = true;
        }

        if (shouldUpdateData) {
            this.updateData();
        }

        this.updateMatrix();
    }

    updateData() {
        if (!this.dataBase64) {
            return;
        }

        this.dataArray = base64ToArrayBuffer(this.dataBase64);

        // Upload the new data to the GPU
        let data;
        switch (this.dataType) {
            case DataTypeS.U8:
                data = new Uint8Array(this.dataArray);
                break;
            case DataTypeS.U16:
                data = new Uint16Array(this.dataArray);
                break;
            case DataTypeS.U32:
                data = new Uint32Array(this.dataArray);
                break;
            case DataTypeS.F32:
                data = new Float32Array(this.dataArray);
                break;
            default:
                console.warn('Unsupported texture type, using U32[]', this.dataType);
                data = new Uint32Array(this.dataArray);
                break;
        }

        if (this.handleSpecialValue && this.specialValueApproach === SpecialValueHandling.CLIFF) {
            for (let i = 0; i < data.length; i++) {
                if (data[i] === this.specialValue) {
                    // TODO: handle non-NED coordinate systems... (i.e., +Z is up, for example)
                    data[i] = 10000; // 10,000 meters below should be good enough... 
                }
            }
        }

        if (this.terrain.sampler) {
            (this.terrain.sampler as SpatialSampler2D).data = data;
            this.terrain.update();

            const material = (this.terrain.mesh.material as any);

            if (this.handleSpecialValue && this.specialValueApproach === SpecialValueHandling.COLOR) {
                const countX = this.terrain.width();
                const countY = this.terrain.height();
                const itemSize = 4;
                if (!this.terrain.mesh.geometry.attributes.color) {
                    // TODO: update if countX or Y changed...
                    this.terrain.mesh.geometry.attributes.color = new BufferAttribute(new Uint8Array(countX * countY * itemSize), itemSize, true);
                    this.terrain.mesh.geometry.attributes.color.usage = DynamicDrawUsage;
                }
                material.vertexColors = true;

                const colAttr = this.terrain.mesh.geometry.attributes.color as any;
                const arr = colAttr.array;
                const tempVec1 = new Vector2();

                let color = new Color(this.specialValueColor || '#000');
                const specialr = 255 * color.r;
                const specialg = 255 * color.g;
                const specialb = 255 * color.b;

                color = new Color(this.meshColor || '#000');
                const r = 255 * color.r;
                const g = 255 * color.g;
                const b = 255 * color.b;

                // The loop structure here was copied from:
                // pkg/terrain-rendering/src/base/SampledTerrain.ts
                for (let x = 0; x < countX; x++) {
                    for (let y = 0; y < countY; y++) {
                        const ratioX = x / (countX - 1);
                        const ratioY = y / (countY - 1);

                        tempVec1.set(ratioX - 0.5, ratioY - 0.5).applyMatrix3(this.terrain.sampleMatrix);
                        const worldX = tempVec1.x;
                        const worldY = tempVec1.y;

                        const gIndex = countX * (countY - y - 1) + x;

                        let z = undefined;
                        if (this.terrain.sampleInWorldFrame) {
                            // TODO: should the world x and y values be transformed using this.matrixWorld?
                            z = this.terrain.getSample(worldX, worldY);
                        } else {
                            const u = (x + 0.5) / countX;
                            const v = (y + 0.5) / countY;
                            z = this.terrain.getSample(u, v);
                        }

                        if (z === this.specialValue) {
                            arr[itemSize * gIndex + 0] = specialr;
                            arr[itemSize * gIndex + 1] = specialg;
                            arr[itemSize * gIndex + 2] = specialb;
                            arr[itemSize * gIndex + 3] = 255;
                        } else {
                            arr[itemSize * gIndex + 0] = r;
                            arr[itemSize * gIndex + 1] = g;
                            arr[itemSize * gIndex + 2] = b;
                            arr[itemSize * gIndex + 3] = 255;
                        }
                    }
                }
                this.terrain.mesh.geometry.attributes.color.needsUpdate = true;
            } else {
                material.vertexColors = false;
            }
            material.needsUpdate = true;
        }
    }

    update(data: HeightMapData) {
        // We can check sameness and update if they are not the same reference
        // This is much faster than doing a strcmp
        if (!Object.is(data.data, this.dataBase64)) {
            this.dataBase64 = data.data;
            this.updateData();
        }
    }
}

export const heightMapRegistration = new AnnotationRegistryItem({
    classType: HeightMapAnnotation,
    type: "heightMap",
    name: "Height Map",
    description: "Single channel cell grid for height maps",

    schema: {
        dataModel: AnnotationSchemaDataModel.channelized,
        fields: [
            {
                name: 'data',
                description: 'Binary data to pass to height map. Interpreted as base64 string.',
                type: ChannelSchemaType.string
            }
        ]
    }
});

export const heightMapRegistrationOptions = (builder: PanelOptionsEditorBuilder<HeightMapOptions>) => {
    builder.addSelect({
        path: "dataType",
        name: "Data Type",
        description: "Defined how WebGL should interpret the data",
        settings: {
            options: [
                {
                    label: 'U8',
                    description: 'UnsignedByteType',
                    value: DataTypeS.U8
                },
                {
                    label: 'U16',
                    description: 'UnsignedShortType',
                    value: DataTypeS.U16
                },
                {
                    label: 'U32',
                    description: 'UnsignedIntType',
                    value: DataTypeS.U32
                },
                {
                    label: 'F32',
                    description: 'FloatType',
                    value: DataTypeS.F32
                }
            ]
        }
    }).addNumberInput({
        path: 'width',
        name: 'Width (m)',
        category: ['Dimensions'],
        description: 'Plane width in meters on X',
        settings: {
            min: 0,
            step: 0.1
        },
        defaultValue: 1
    }).addNumberInput({
        path: 'height',
        name: 'Height (m)',
        category: ['Dimensions'],
        description: 'Plane height in meters on Y',
        settings: {
            min: 0,
            step: 0.1
        },
        defaultValue: 1
    }).addNumberInput({
        path: 'cellX',
        name: 'Cell count X',
        category: ['Dimensions'],
        description: 'Number of cells in the X direction',
        settings: {
            min: 1,
            step: 1
        },
    }).addNumberInput({
        path: 'cellY',
        name: 'Cell count Y',
        category: ['Dimensions'],
        description: 'Number of cells in the Y direction',
        settings: {
            min: 1,
            step: 1
        },
    }).addSelect({
        path: "renderingStyle",
        name: "Rendering Style",
        category: ['Rendering Style'],
        defaultValue: RenderingStyle.COLOR,
        settings: {
            options: [
                {
                    label: 'COLOR',
                    description: 'Color the mesh by a specific color',
                    value: RenderingStyle.COLOR
                },
                {
                    label: 'TOPOLINES',
                    description: 'Same as COLOR but also add red topographic lines (0.1m spaced) to the mesh',
                    value: RenderingStyle.TOPOLINES
                },
                {
                    label: 'SLOPE',
                    description: 'Color the mesh based on the slope',
                    value: RenderingStyle.SLOPE
                },
            ]
        }
    }).addColorPicker({
        path: "meshColor",
        name: "Mesh Color",
        category: ['Rendering Style'],
        settings: {
            enableNamedColors: false
        },
        showIf: (options) => options.renderingStyle !== RenderingStyle.SLOPE,
        defaultValue: '#c8c8c8'
    }).addNumberInput({
        path: 'maxSlopeAngle',
        name: 'Max Slope Angle (degrees)',
        category: ['Rendering Style'],
        description: 'Parula Color Map gives values of 0 as blue and yellow as the max slope angle specified here',
        showIf: (options) => options.renderingStyle === RenderingStyle.SLOPE,
        settings: {
            min: 0,
            step: 1,
            max: 90
        },
        defaultValue: 30
    }).addNumberInput({
        path: 'renderOrder',
        name: 'Render Order',
        category: ['Rendering Style'],
        description: 'Objects with higher numbers will be rendered over lower numbers',
        defaultValue: 0
    }).addNumberInput({
        path: 'opacity',
        name: 'Opacity',
        category: ['Rendering Style'],
        settings: {
            min: 0,
            max: 1
        },
        defaultValue: 1
    }).addBooleanSwitch({
        path: 'handleSpecialValue',
        name: 'Handle Special Value?',
        category: ['Special Value'],
        description: 'Should we handle a special value differently?',
    }).addNumberInput({
        path: 'specialValue',
        name: 'Special Value',
        category: ['Special Value'],
        description: 'The Special Value to handle differently',
        defaultValue: 0,
        showIf: (options) => !!options.handleSpecialValue
    }).addSelect({
        path: "specialValueApproach",
        name: "Special Value Approach",
        category: ['Special Value'],
        showIf: (options) => !!options.handleSpecialValue,
        description: "The approach we'll take to handle the special value",
        defaultValue: SpecialValueHandling.CLIFF,
        settings: {
            options: [
                {
                    label: 'CLIFF',
                    description: 'CLIFF',
                    value: SpecialValueHandling.CLIFF
                },
                {
                    label: 'COLOR',
                    description: 'COLOR',
                    value: SpecialValueHandling.COLOR
                }
            ]
        }
    }).addColorPicker({
        path: "specialValueColor",
        name: "Special Value Color",
        settings: {
            enableNamedColors: false
        },
        showIf: (options) => !!options.handleSpecialValue && options.specialValueApproach === SpecialValueHandling.COLOR,
        defaultValue: '#000'
    });
};
