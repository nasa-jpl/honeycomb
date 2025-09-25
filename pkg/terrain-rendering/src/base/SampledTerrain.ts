import { BandSampler2D, Sampler2D, SpatialSampler2D } from '@gov.nasa.jpl.honeycomb/sampler-2d';
import { HeightMapTerrain } from './HeightMapTerrain';
import { Vector2, Matrix3, BufferGeometry, ShaderLibShader } from 'three';

const tempVec1 = new Vector2();
const tempVec2 = new Vector2();
const tempVec3 = new Vector2();

/**
 * Heightmap class that derives and updates the heightmap based on
 * a Sampler2D object.
 * @extends HeightMapTerrain
 */
export class SampledTerrain extends HeightMapTerrain {
    /**
     * The Sampler2D object to use when retriving values to position the
     * Z component of the vertices.
     * @member {Sampler2D}
     */
    sampler?: SpatialSampler2D | BandSampler2D | Sampler2D;

    mipChain?: any;

    /**
     * The sampling resolution to use when genering the number of vertices on each
     * dimension of the heightmap. If set to - 1 then {@link #SampledTerrain#samples samples}
     * will be used to determine the number of verts.
     *
     * For example 0.1 will sample the map ever 10 cm.
     * @default -1
     */
    resolution: number = -1;

    /**
     * The maximum number of samples per dimension of the heightmap. Useful for ensuring
     * the heightmap does not consume too much memory or take too much time to update.
     *
     * @member {maxSamplesPerDimension}
     * @default Infinity
     */
    maxSamplesPerDimension: number = Infinity;

    /**
     * The number of vertices to generate on X and Y of the heightmap. Only used if
     * {@link #SampledTerrain#resolution} is set to `-1`.
     *
     * @member {samples}
     * @default (0, 0)
     */
    samples = new Vector2();

    /**
     * The channel from the Sampler2D to use for the height value.
     *
     * @member {channel}
     * @default 0
     */
    channel: number = 0;

    /**
     * Whether or not to use the `Sampler2D.spatialSampleChannel` function when sampling
     * the heightmap. Useful for sampling a heightmap that has a spatial offset or sampling
     * a sub portion of the map.
     *
     * @member {sampleInWorldFrame}
     * @default true
     */
    sampleInWorldFrame: boolean = true;

    /**
     * 3x3 2D transform matrix for transforming the positon of the xy sample positions. Useful
     * for generating a heightmap that is offset from the origin.
     * @member {sampleMatrix}
     */
    sampleMatrix = new Matrix3().identity();

    constructor(sampler?: SpatialSampler2D | BandSampler2D, geometry?: BufferGeometry, baseShader?: ShaderLibShader) {
        super(geometry, baseShader);
        this.sampler = sampler;
    }

    /**
     * Returns the rotation of the heightmap based on the {@link #SampledTerrain#sampleMatrix}.
     * @returns {Number}
     */
    getBoundsRotation(): number {
        const sampleMatrix = this.sampleMatrix;
        const e00 = sampleMatrix.elements[0];
        const e01 = sampleMatrix.elements[3];

        // sx * cos(t), sx * sin(t)
        // sx = e00 / cos(t) = e01 / sin(t)
        // e01 / e00 = sin(t) / cos(t) = tan(t)
        return Math.atan2(e01, e00);
    }

    /**
     * Returns the center of the heightmap in `target` based on the {@link #SampledTerrain#sampleMatrix}.
     * @param {Vector2} target
     * @return {void}
     */
    getBoundsCenter(target: Vector2): void {
        const sampleMatrix = this.sampleMatrix;
        target.set(0, 0).applyMatrix3(sampleMatrix);
    }

    /**
     * Returns the size of the heightmap in `target` based on the {@link #SampledTerrain#sampleMatrix}.
     * @param {Vector2} target
     * @returns {void}
     */
    getBoundsSize(target: Vector2): void {
        const sampleMatrix = this.sampleMatrix;
        tempVec1.set(0, 0).applyMatrix3(sampleMatrix);
        tempVec2.set(1, 0).applyMatrix3(sampleMatrix);

        target.x = tempVec2.distanceTo(tempVec1);

        tempVec2.set(0, 1).applyMatrix3(sampleMatrix);
        target.y = tempVec2.distanceTo(tempVec1);
    }

    /**
     * Sets the bounds of the heightmap patch to generate.
     * @param {Number} minX
     * @param {Number} minY
     * @param {Number} maxX
     * @param {Number} maxY
     * @param {Number} rotation
     * @returns {void}
     */
    setBounds(minX: number, minY: number, maxX: number, maxY: number, rotation: number = 0): void {
        const sampleMatrix = this.sampleMatrix;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const midX = minX + sizeX / 2;
        const midY = minY + sizeY / 2;

        // scale by the size on x and y
        // rotate about the center of the bounds
        sampleMatrix.setUvTransform(midX, midY, sizeX, sizeY, rotation, 0, 0);
    }

    /**
     * Sets the {@link #SampledTerrain#sampleInWorldFrame} field to true and adjusts {@link #SampledTerrain#sampler}
     * inverseMatrix so the terrain is sampled in world frame but is visually unchanged.
     * @returns {void}
     */
    convertToSampleWorldFrame(): void {
        if (this.sampleInWorldFrame) {
            return;
        }

        this.updateWorldMatrix(true, false);

        const { sampler, sampleMatrix } = this;

        // NOTE: sampling is from -0.5 to 0.5
        const minVec = tempVec1.setScalar(-0.5).applyMatrix3(sampleMatrix);
        const maxVec = tempVec2.setScalar(0.5).applyMatrix3(sampleMatrix);

        sampler?.setMinMax(minVec.x, minVec.y, maxVec.x, maxVec.y);
        this.sampleInWorldFrame = true;
    }

    updateGeometry(geometry: BufferGeometry) {
        const sampleInWorldFrame = this.sampleInWorldFrame;
        const resolution = this.resolution;
        const samples = this.samples;
        const sampleMatrix = this.sampleMatrix;
        const maxSamplesPerDimension = this.maxSamplesPerDimension;

        this.getBoundsSize(tempVec3);

        const sizeX = tempVec3.x;
        const sizeY = tempVec3.y;
        const clampedResolution = Math.max(
            resolution, sizeX / maxSamplesPerDimension, sizeY / maxSamplesPerDimension
        );
        const maxCountX = Math.ceil(sizeX / clampedResolution) + 1;
        const maxCountY = Math.ceil(sizeY / clampedResolution) + 1;

        let countX, countY;
        if (resolution > 0) {
            countX = Math.ceil(sizeX / resolution) + 1;
            countY = Math.ceil(sizeY / resolution) + 1;
        } else if (samples.x > 0 && samples.y > 0) {
            countX = samples.x;
            countY = samples.y;
        } else {
            throw new Error(
                'SampledTerrain: Either resolution or samples must be set to a positive non zero value.',
            );
        }

        countX = Math.min(maxCountX, countX);
        countY = Math.min(maxCountY, countY);

        this._setGridDimensions(geometry, countX, countY);

        if ('uv' in geometry.attributes) {
            geometry.deleteAttribute('uv').dispose();
        }

        const posAttr = geometry.attributes.position as any;
        const arr = posAttr.array;
        for (let x = 0; x < countX; x++) {
            for (let y = 0; y < countY; y++) {
                const ratioX = x / (countX - 1);
                const ratioY = y / (countY - 1);

                tempVec1.set(ratioX - 0.5, ratioY - 0.5).applyMatrix3(sampleMatrix);
                const worldX = tempVec1.x;
                const worldY = tempVec1.y;

                // three.js planes are generated from the bottom up so account for that by
                // starting at the last vertices in the geometry.
                const gIndex = countX * (countY - y - 1) + x;
                arr[3 * gIndex + 0] = worldX;
                arr[3 * gIndex + 1] = worldY;

                if (sampleInWorldFrame) {
                    // TODO: should the world x and y values be transformed using this.matrixWorld?
                    arr[3 * gIndex + 2] = this.getSample(worldX, worldY);
                } else {
                    const u = (x + 0.5) / countX;
                    const v = (y + 0.5) / countY;
                    arr[3 * gIndex + 2] = this.getSample(u, v);
                }
            }
        }
        posAttr.needsUpdate = true;

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        // normals are all zeros, so we need to recompute them here
        geometry.computeVertexNormals();
        geometry.normalizeNormals();
    }

    getSample(u: number, v: number) {
        const sampler = this.sampler;
        const channel = this.channel;

        let value;
        if (this.sampleInWorldFrame) {
            value = (sampler as BandSampler2D)?.spatialSampleChannel(u, v, channel);
        } else {
            value = sampler?.sampleChannel(u, v, channel);
        }
        return value === null ? 0 : value;
    }
}
