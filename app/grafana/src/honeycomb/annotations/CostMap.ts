import {
    // ByteType,
    ClampToEdgeWrapping,
    DataTexture,
    DoubleSide,
    FloatType,
    Mesh,
    NearestFilter,
    NearestMipmapNearestFilter,
    LinearFilter,
    NearestMipmapLinearFilter,
    LinearMipmapNearestFilter,
    LinearMipmapLinearFilter,
    NoColorSpace,
    PlaneGeometry,
    RedFormat,
    UnsignedByteType,
    MinificationTextureFilter,
    MagnificationTextureFilter,
} from "three";

import {
    Annotation,
    AnnotationSchemaDataModel,
    ChannelSchemaType
} from "@gov.nasa.jpl.honeycomb/core";

import { ColorMapLUT } from "./colormaps";
import { ColorMapMaterial } from "./ColorMapMaterial";
import { ColorMap, ColorMapEditor, ColorMapType } from "./ColorMapEditor";
import { base64ToArrayBuffer } from "../../honeycomb/utils";
import { PanelOptionsEditorBuilder } from "@grafana/data";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";

interface CostMapOptions {
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
    dataType: TextureDataTypeS;

    /**
     * Color map to apply after normalization
     */
    colorMap: ColorMap;

    /**
     * Render order of grid to display above or below other objects
     */
    renderOrder: number;

    // Texture options
    minFilter: FilterType;
    magFilter: FilterType;

    /**
     * Swap byte order
     */
    swapOrder: boolean;

    /**
     * floating point normalization
     */
    normalizeMethod: NormalizationMethod;
    normalizeMin?: number;
    normalizeMax?: number;
}

// Stringified version of TextureDataType for storing in panel
enum TextureDataTypeS {
    U8 = 'U8',
    U16 = 'U16',
    U32 = 'U32',
    F32 = 'F32'
}

enum NormalizationMethod {
    NONE = 'none',
    ZERO_MAX = 'zero-max',
    MIN_MAX = 'min-max',
    CONST = 'const',
}

enum FilterType {
    Nearest = 'Nearest',
    NearestMipmapNearest = 'NearestMipmapNearest',
    NearestMipmapLinear = 'NearestMipmapLinear',
    Linear = 'Linear',
    LinearMipmapNearest = 'LinearMipmapNearest',
    LinearMipmapLinear = 'LinearMipmapLinear',
}

function convertMinFilterType(input: FilterType): MinificationTextureFilter {
    switch (input) {
        default:
        case FilterType.Nearest:
            return NearestFilter;
        case FilterType.NearestMipmapNearest:
            return NearestMipmapNearestFilter;
        case FilterType.NearestMipmapLinear:
            return NearestMipmapLinearFilter;
        case FilterType.Linear:
            return LinearFilter;
        case FilterType.LinearMipmapNearest:
            return LinearMipmapNearestFilter;
        case FilterType.LinearMipmapLinear:
            return LinearMipmapLinearFilter;
    }
}

function convertMagFilter(input: FilterType): MagnificationTextureFilter {
    switch (input) {
        default:
        case FilterType.Nearest:
            return NearestFilter;
        case FilterType.Linear:
            return LinearFilter;
    }
}

interface CostMapData {
    data: string;
}

function byteSwapArrayBuffer(data: ArrayBuffer, elSize: number) {
    const u8 = new Uint8Array(data);
    switch (elSize) {
        default:
            break;
        case 2:
            for (let i = 0; i < u8.byteLength / 2; i++) {
                const tmp = u8[i * 2];
                u8[i * 2] = u8[i * 2 + 1];
                u8[i * 2 + 1] = tmp;
            }
            break;
        case 4:
            for (let i = 0; i < u8.byteLength / 4; i++) {
                const b1 = u8[i * 4];
                const b2 = u8[i * 4 + 1];
                const b3 = u8[i * 4 + 2];
                const b4 = u8[i * 4 + 3];

                u8[i * 4] = b4;
                u8[i * 4 + 1] = b3;
                u8[i * 4 + 2] = b2;
                u8[i * 4 + 3] = b1;
            }
            break;
    }
}

function normalizeData(
    data: Float32Array | Uint8Array,
    method: NormalizationMethod,
    min?: number,
    max?: number
) {
    switch (method) {
        case NormalizationMethod.NONE:
            return;
        case NormalizationMethod.ZERO_MAX:
            min = 0.0;

            // Compute max
            max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                if (data[i] > max) {
                    max = data[i];
                }
            }
            break;
        case NormalizationMethod.MIN_MAX:
            // Compute min and max
            min = Infinity;
            max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                if (data[i] < min) {
                    min = data[i];
                }

                if (data[i] > max) {
                    max = data[i];
                }
            }
            break;
        case NormalizationMethod.CONST:
        case NormalizationMethod.CONST:
            // Use values set in the editor
            max = max ?? 255.0;
            min = min ?? 0.0;
            break;
    }

    // Normalize values
    const div = 1.0 / (max - min);
    for (let i = 0; i < data.length; i++) {
        // TODO(tumbar) Should we clamp?
        // I say I will but the colormap shader should be clamping on the GPU
        data[i] = (data[i] - min) * div;
    }
}

export class CostMapAnnotation extends Mesh<
    PlaneGeometry, ColorMapMaterial
> implements Annotation<CostMapData, CostMapOptions> {
    texture: DataTexture;
    textureBase64?: string;
    textureData?: ArrayBuffer;

    dataType: TextureDataTypeS = TextureDataTypeS.U8;

    swapOrder = false;
    normalizeMethod?: NormalizationMethod;
    normalizeMin?: number;
    normalizeMax?: number;

    constructor() {
        const texture = new DataTexture(
            null,
            undefined,
            undefined,
            RedFormat,
            UnsignedByteType
        );

        super(
            new PlaneGeometry(),
            new ColorMapMaterial(
                texture
            )
        );

        this.texture = texture;

        // The colormap shader takes a single channel
        this.texture.colorSpace = NoColorSpace;
        this.texture.minFilter = NearestFilter;
        this.texture.magFilter = NearestFilter;
        this.texture.wrapS = ClampToEdgeWrapping;
        this.texture.wrapT = ClampToEdgeWrapping;

        this.material.transparent = true;
        this.material.depthWrite = false;
        this.material.side = DoubleSide;
    }

    options(_options: Partial<CostMapOptions>): void {
        const options: CostMapOptions = {
            width: 1,
            height: 1,
            cellX: 100,
            cellY: 100,
            renderOrder: 0,
            dataType: TextureDataTypeS.U8,
            minFilter: FilterType.Nearest,
            magFilter: FilterType.Nearest,
            colorMap: {
                type: ColorMapType.lut,
                lut: ColorMapLUT.MATLAB_jet
            },
            swapOrder: false,
            normalizeMethod: NormalizationMethod.NONE,
            ..._options
        };

        this.material.updateColormap(options.colorMap);

        this.texture.image = {
            data: this.texture.image.data,
            width: options.cellX,
            height: options.cellY,
        };

        let textureNeedsUpdate = false;

        if (this.dataType !== options.dataType) {
            this.dataType = options.dataType;
            textureNeedsUpdate = true;
        }

        if (this.swapOrder !== options.swapOrder) {
            this.swapOrder = options.swapOrder;
            textureNeedsUpdate = true;
        }

        if (this.normalizeMethod !== options.normalizeMethod) {
            this.normalizeMethod = options.normalizeMethod;
            textureNeedsUpdate = true;
        }

        if (this.normalizeMin !== options.normalizeMin) {
            this.normalizeMin = options.normalizeMin;
            textureNeedsUpdate = true;
        }

        if (this.normalizeMax !== options.normalizeMax) {
            this.normalizeMax = options.normalizeMax;
            textureNeedsUpdate = true;
        }

        if (textureNeedsUpdate) {
            this.updateTexture();
        }

        this.texture.minFilter = convertMinFilterType(options.minFilter);
        this.texture.magFilter = convertMagFilter(options.magFilter);

        this.texture.needsUpdate = true;

        this.renderOrder = options.renderOrder;

        this.scale.set(
            options.width,
            options.height,
            1
        );

        this.updateMatrix();
    }

    updateTexture() {
        if (!this.textureBase64) {
            return;
        }

        this.textureData = base64ToArrayBuffer(this.textureBase64);

        if (this.swapOrder) {
            let elSize;
            switch (this.dataType) {
                case TextureDataTypeS.U8:
                    elSize = 1;
                    break;
                case TextureDataTypeS.U16:
                    elSize = 2;
                    break;
                case TextureDataTypeS.U32:
                case TextureDataTypeS.F32:
                    elSize = 4;
                    break;
            }

            byteSwapArrayBuffer(this.textureData, elSize);
        }

        // Upload the new texture to the GPU
        let data;
        switch (this.dataType) {
            case TextureDataTypeS.U8:
                this.texture.type = UnsignedByteType;
                data = new Uint8Array(this.textureData);
                break;
            case TextureDataTypeS.U16: {
                // Convert U16 data to floats
                this.texture.type = FloatType;
                const raw = new Uint16Array(this.textureData);
                data = new Float32Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                    data[i] = raw[i];
                }
            }
                break;
            case TextureDataTypeS.U32: {
                // Convert U32 data to floats
                this.texture.type = FloatType;
                const raw = new Uint32Array(this.textureData);
                data = new Float32Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                    data[i] = raw[i];
                }
            }
                break;

            case TextureDataTypeS.F32: {
                this.texture.type = FloatType;

                data = new Float32Array(this.textureData);
            }
                break;

            default:
                console.warn('Unsupported texture type, using U8[]', this.texture.type);
                data = new Uint8Array(this.textureData);
                break;
        }

        normalizeData(
            data,
            this.normalizeMethod ?? NormalizationMethod.NONE,
            this.normalizeMin,
            this.normalizeMax
        );

        this.texture.image = {
            // ThreeJS expects raw data as U8[] but we can just give it any typed array
            data: data as Uint8Array,
            height: this.texture.image.height,
            width: this.texture.image.width
        };

        this.texture.needsUpdate = true;
        this.material.uniformsNeedUpdate = true;
    }

    update(data: CostMapData) {
        // We can check sameness and update if they are not the same reference
        // This is much faster than doing a strcmp
        if (!Object.is(data.data, this.textureBase64)) {
            this.textureBase64 = data.data;
            this.updateTexture();
        }
    }
}

export const costMapRegistration = new AnnotationRegistryItem({
    classType: CostMapAnnotation,
    type: "costMap",
    name: "Cost Map",
    description: "Single channel cell grid for cost maps or other flat visualizations",

    schema: {
        dataModel: AnnotationSchemaDataModel.channelized,
        fields: [
            {
                name: 'data',
                description: 'Binary data to pass to texture grid. Interpreted as base64 string.',
                type: ChannelSchemaType.string
            }
        ]
    }
});

export const costMapRegistrationOptions = (builder: PanelOptionsEditorBuilder<CostMapOptions>) => {
    builder.addCustomEditor<undefined, ColorMap>({
        path: 'colorMap',
        editor: ColorMapEditor,
        category: ['Color map'],
        id: "colorMapEditor",
        name: "Color map"
    }).addSelect({
        path: "dataType",
        name: "Data Type",
        description: "Defined how WebGL should interpret the data",
        settings: {
            options: [
                {
                    label: 'U8',
                    description: 'UnsignedByteType',
                    value: TextureDataTypeS.U8
                },
                {
                    label: 'U16',
                    description: 'UnsignedShortType',
                    value: TextureDataTypeS.U16
                },
                {
                    label: 'U32',
                    description: 'UnsignedIntType',
                    value: TextureDataTypeS.U32
                },
                {
                    label: 'F32',
                    description: 'FloatType',
                    value: TextureDataTypeS.F32
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
    }).addNumberInput({
        path: 'renderOrder',
        name: 'Render Order',
        description: 'Objects with higher numbers will be rendered over lower numbers',
        defaultValue: 0
    }).addSelect({
        path: 'magFilter',
        name: 'Magnification filter',
        category: ['Texture options'],
        description: 'OpenGL texture filter to use for magnification. Interpolates between grid cells. You should only do this when you have a gradient-based colormap otherwise the colors won\'t make sense',
        defaultValue: FilterType.Nearest,
        settings: {
            options: [
                {
                    value: FilterType.Nearest,
                    label: 'Nearest',
                    description: 'No interpolation, use nearest pixel in data'
                },
                {
                    value: FilterType.Linear,
                    label: 'Linear',
                    description: 'Bilinear interpolation between pixels in the data'
                }
            ]
        }
    }).addSelect({
        path: 'minFilter',
        name: 'Minification Filter',
        category: ['Texture options'],
        description: 'OpenGL texture filter to use for minification. This is not too relevant if your data is much smaller than the actual rendering (which for cost maps it is 99% of the time)',
        settings: {
            options: Object.values(FilterType).map(v => ({
                value: v,
                label: v
            }))
        },
        defaultValue: FilterType.Nearest
    }).addBooleanSwitch({
        path: 'swapOrder',
        name: 'Swap byte order',
        description: 'Swaps the byte order for U16, U32 and F32 arrays',
        showIf: (options) => {
            switch (options.dataType) {
                case TextureDataTypeS.U8:
                    return false; // can't swap 1 byte
                case TextureDataTypeS.U16:
                case TextureDataTypeS.U32:
                case TextureDataTypeS.F32:
                    return true;
            }
        }
    }).addSelect({
        name: "Method",
        path: 'normalizeMethod',
        category: ["Normalize"],
        settings: {
            options: [
                {
                    value: NormalizationMethod.NONE,
                    label: 'NONE',
                    description: "No normalization applied. This will have unexpected results for non-U8[] data"
                },
                {
                    value: NormalizationMethod.ZERO_MAX,
                    label: '0-MAX',
                    description: "Computes the max of cell value and normalizes this to 1.0"
                },
                {
                    value: NormalizationMethod.MIN_MAX,
                    label: 'MIN-MAX',
                    description: "Computes the min and max of cell values and normalizes these to 0.0 and 1.0"
                },
                {
                    value: NormalizationMethod.CONST,
                    label: 'CONST',
                    description: "Normalizes between two constants. If cells are out of this range they will be clamped to the range"
                }
            ]
        }
    }).addNumberInput({
        path: 'normalizeMin',
        name: 'Minimum',
        description: 'Constant minimum value to normalize to. Any values that are lower will be clamped to 0.0',
        category: ["Normalize"],
        showIf: (opts) => {
            return opts.normalizeMethod === NormalizationMethod.CONST;
        }
    }).addNumberInput({
        path: 'normalizeMax',
        name: 'Maximum',
        description: 'Constant maximum value to normalize to. Any values that are higher will be clamped to 1.0',
        category: ["Normalize"],
        showIf: (opts) => {
            return opts.normalizeMethod === NormalizationMethod.CONST;
        }
    });
};
