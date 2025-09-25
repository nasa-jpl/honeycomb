import { LoadingManager, Viewer } from '@gov.nasa.jpl.honeycomb/core';
import { SampledTerrain } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import { SpatialSampler2D } from '@gov.nasa.jpl.honeycomb/sampler-2d';
import {
    DataTexture, DoubleSide, Matrix4, Object3D, Quaternion, RGBAFormat,
    SRGBColorSpace, type TypedArray, UnsignedByteType, Vector3, LinearFilter
} from 'three';
import { fromArrayBuffer } from 'geotiff';
import { FetchArrayBufferLoader } from '@gov.nasa.jpl.honeycomb/common';
import UTMLatLng from 'utm-latlng';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer/src/FrameTransformer';
import * as pathM from 'path';

const tempVec = new Vector3();
const tempMat = new Matrix4();

// This file is based on the following file:
// honeycomb/modules/honeycomb-extensions/src/models/pgmModelLoader.ts

interface GeoTiffOptions {
    zScale?: number;
    zOffset?: number;
    maxSamplesPerDimension?: number;
    orthophotoPath?: string;
}

class ZOffsetSpatialSampler2D extends SpatialSampler2D {
    zOffset: number = 0;
    zScale: number = 1;
    maxValue: number = 1;

    protected modifier(cell: number): number {
        return this.zScale * (cell / this.maxValue) + this.zOffset;
    }
}

function affineTransform(a: number, b: number, M: number[], roundToInt = false) {
    const round = (v: number) => (roundToInt ? v | 0 : v);
    return [
        round(M[0] + M[1] * a + M[2] * b),
        round(M[3] + M[4] * a + M[5] * b),
    ];
}

/**
 * Calculates the latitude, longitude, and elevation of a given three.js scene world point
 * based on information given by the GeoTIFF DEM file that is stored within the terrain
 * Object3D's userData field. See https://www.npmjs.com/package/geotiff#example-usage.
 * @param worldPoint three.js scene world point
 * @param terrain terrain Object3D that should have userData.geoCoords information
 * @returns the lat/lon/elevation coordinates, or null if there's no geo coordinate info
 */
export function getGeoCoords(worldPoint: Vector3, terrain?: Object3D) {
    const geoCoordsData = terrain?.userData.geoCoords || terrain?.parent?.userData.geoCoords;

    if (!geoCoordsData) {
        return null;
    }

    // get the point in terrain coords
    FrameTransformer.transformPoint(
        tempMat.identity(),
        terrain.matrixWorld,
        worldPoint,
        tempVec
    );

    // get pixel coords
    const demX = tempVec.x + geoCoordsData.dem.width / 2;
    const demY = tempVec.y + geoCoordsData.dem.height / 2;

    // get WGS-84 coords
    const [wgs84Lon, wgs84Lat] = affineTransform(demX, demY, geoCoordsData.dem.pixelToGPS);

    const utm = new UTMLatLng();
    const latLng = utm.convertUtmToLatLng(wgs84Lon, wgs84Lat, geoCoordsData.dem.utmZoneNumber, geoCoordsData.dem.utmZoneLetter);
    return {
        lat: (latLng as any).lat,
        lon: (latLng as any).lng,
        elevation: -tempVec.z // in meters
    };
}

/**
 * This is a wrapper around the getGeoCoords function that helps if you don't
 * explicitly know the three.js scene world point as well as which Object3D in
 * the scene has geo coord data associated with it.
 * @param localWorldPoint the rsf world point (not the three.js scene world point)
 * @param viewer the RsvpViewer that we will use to search for the terrain
 */
export function getGeoCoordsHelper(localWorldPoint: Vector3, viewer: Viewer) {
    // TODO: do this in a more performant way...
    // TODO: assumes there's only one terrain that has geo coords, which is
    // probably a decent assumption for most cases, but not all cases...
    let terrainWithGeoCoords: Object3D | null = null;
    viewer.scene.traverse((obj: Object3D) => {
        if (obj.userData.geoCoords) {
            terrainWithGeoCoords = obj;
        }
    });

    if (terrainWithGeoCoords) {
        tempVec.copy(localWorldPoint);

        // get the three.js scene world point
        FrameTransformer.transformPoint(
            viewer.world.matrixWorld,
            tempMat.identity(),
            tempVec,
            tempVec
        );

        return getGeoCoords(tempVec, terrainWithGeoCoords);
    }
    return null;
}

function loadGeoTiff(path: string, options: Partial<GeoTiffOptions>, manager: LoadingManager): Promise<Object3D> {
    return new Promise(async (resolve) => {
        manager.itemStart(path);
        const resolvedPath = manager.resolveURL(path);
        const gtReader = new GeoTiffDEMFileReader(options);
        gtReader.load(resolvedPath)
            .then(async (obj: SampledTerrain) => {
                if (options.orthophotoPath) {
                    manager.itemStart(options.orthophotoPath);
                    // const resolvedPath = manager.resolveURL(options.orthophotoPath);
                    const reader = new GeoTiffOrthoPhotoFileReader(options);
                    const texture = await reader.load(
                        pathM.join(pathM.dirname(resolvedPath), options.orthophotoPath)
                    ).finally(() => manager.itemEnd(path));

                    const material = (obj.mesh.material as any);
                    material.textureStampMap = texture;
                    material.defines.ENABLE_TEXTURE_STAMP = 1;
                    material.defines.ENABLE_TEXTURE_STAMP_USE_MODEL_COORDINATES = 1;

                    // follow examples from Honeycomb:
                    // https://github.jpl.nasa.gov/Honeycomb/honeycomb/blob/master/packages/modules/honeycomb-extensions/src/enav/drivers/EnavHeightmap.js
                    // https://github.jpl.nasa.gov/Honeycomb/honeycomb/blob/master/packages/modules/honeycomb-extensions/src/enav/drivers/EnavCostmap.js

                    const tempVec3 = new Vector3();
                    const tempScale = new Vector3();
                    const tempQuat = new Quaternion();
                    const tempMat4 = new Matrix4();

                    // the orthophoto should be stretched to the size of the DEM
                    const width = obj.width();
                    const height = obj.height();

                    // build up the matrix such that it converts uv coordinates to the model coordinates:
                    // - scale up to the correct dimensions
                    // - no rotation needed
                    // - translate so that the center of the model is at (0, 0)
                    // we'll then pass the inverse of the matrix to the shader (i.e., so that it
                    // converts model coordinates to uv coordinates).
                    tempScale.set(width, height, 1);
                    tempQuat.set(0, 0, 0, 1);
                    tempVec3.set(
                        -width / 2,
                        -height / 2,
                        0
                    );
                    tempMat4.compose(tempVec3, tempQuat, tempScale);
                    tempMat4.invert();

                    material.textureStampFrameInverse.copy(tempMat4);
                }
                resolve(obj);
            })
            .finally(() => manager.itemEnd(path));
    });
}

class GeoTiffDEMFileReader extends FetchArrayBufferLoader<SampledTerrain> {
    options: GeoTiffOptions;
    constructor(options: GeoTiffOptions) {
        super();
        this.options = options;
    }

    async parse(arrayBufer: ArrayBuffer): Promise<SampledTerrain> {
        return await fromArrayBuffer(arrayBufer).then(async (tiff) => {
            const image = await tiff.getImage(); // by default, the first image is read.
            const rasters = await image.readRasters();

            // TODO: there's a bunch of information in these objects that we should
            // probably take advantage of somehow...
            // console.log('tiff', tiff);
            // console.log('tiff image', image); // TODO: utilize these parameters to get the orientation correct (i.e., north up)....
            // console.log('tiff rasters', rasters);
            const options = this.options;

            const resolution = 1;
            const width = rasters.width;
            const height = rasters.height;
            const width1 = width - 1;
            const height1 = height - 1;
            const zScale = options.zScale ?? 1;
            const zOffset = options.zOffset ?? 0;

            // maxValue is something leftover from related to the PGM loader; see
            // honeycomb/modules/pgm-loader/src/base/PGMLoaderBase.ts
            // https://netpbm.sourceforge.net/doc/pgm.html
            // Leaving this code commented out for future reference/debugging...

            // const maxValue = res.maxValue ?? Math.pow(2, res.data.BYTES_PER_ELEMENT * 8);
            // let maxValue = Number.MIN_VALUE;
            // (rasters[0] as TypedArray).forEach(val => {
            //     if (val > maxValue) maxValue = val;
            // });
            // console.log('max value found was', maxValue);
            // maxValue = 1; // TODO

            // let minValue = Number.MAX_VALUE;
            // (rasters[0] as TypedArray).forEach(val => {
            //     if (val < minValue) minValue = val;
            // });
            // console.log('min value found was', minValue);
            const maxValue = 1;

            // TODO: should we pull in by half a pixel here to center all
            // vertices at the center of every sample?
            const sampler = new ZOffsetSpatialSampler2D((rasters[0] as TypedArray), width, 1);
            sampler.zOffset = zOffset;
            sampler.zScale = zScale;
            sampler.maxValue = maxValue;

            const terrain = new SampledTerrain(sampler);

            const material = (terrain.mesh.material as any);
            material.side = DoubleSide;
            material.flatShading = true; // needed for slope map to look ok
            material.topoLineColor.set(0xff0000);
            material.needsUpdate = true;

            // console.log(material);

            terrain.setBounds(
                (-width1 * resolution) / 2.0,
                (-height1 * resolution) / 2.0,
                (width1 * resolution) / 2.0,
                (height1 * resolution) / 2.0,
                0,
            );
            terrain.samples.set(width, height);
            terrain.maxSamplesPerDimension = options.maxSamplesPerDimension ?? terrain.maxSamplesPerDimension;
            terrain.sampleInWorldFrame = false;

            if (image.fileDirectory.ModelTiepoint) {
                // see http://geotiff.maptools.org/spec/geotiff2.6.html
                terrain.position.set(
                    image.fileDirectory.ModelTiepoint[3],
                    image.fileDirectory.ModelTiepoint[4],
                    image.fileDirectory.ModelTiepoint[5]
                );
            }

            // https://www.npmjs.com/package/geotiff#example-usage
            // Construct the WGS-84 forward and inverse affine matrices:
            const { ModelPixelScale: s, ModelTiepoint: t } = image.fileDirectory;
            const [sx, sy, _sz] = s;
            const [_px, _py, _k, gx, gy, _gz] = t;
            const pixelToGPS = [gx, sx, 0, gy, 0, -sy]; // WGS-84 tiles have a "flipped" y component

            // utm zone number and letter are needed for the UTMLatLng library
            const gtCitationGeoKey: string = image.geoKeys["GTCitationGeoKey"];
            const numberAndLetter: string = gtCitationGeoKey.replace(/.*UTM zone /, "");
            const utmZoneNumber: number = parseInt(numberAndLetter.replace(/[A-Za-z]*/, ""));
            const utmZoneLetter: string = numberAndLetter.replace(/[0-9]*/, "");

            terrain.userData["geoCoords"] = {
                dem: {
                    width: width,
                    height: height,
                    pixelToGPS: pixelToGPS,
                    utmZoneNumber: utmZoneNumber,
                    utmZoneLetter: utmZoneLetter
                }
            };

            terrain.update();
            return terrain;
        });
    }
}

class GeoTiffOrthoPhotoFileReader extends FetchArrayBufferLoader<DataTexture> {
    options: GeoTiffOptions;
    constructor(options: GeoTiffOptions) {
        super();
        this.options = options;
    }

    async parse(arrayBufer: ArrayBuffer): Promise<DataTexture> {
        return await fromArrayBuffer(arrayBufer).then(async (tiff) => {
            const image = await tiff.getImage(); // by default, the first image is read.
            const rasters = await image.readRasters();

            // TODO: there's a bunch of information in these objects that we should
            // probably take advantage of somehow...
            // console.log('GeoTiffOrthoPhotoFileReader tiff', tiff);
            // console.log('GeoTiffOrthoPhotoFileReader tiff image', image);
            // console.log('GeoTiffOrthoPhotoFileReader tiff rasters', rasters);

            let rawDataR = rasters[0] as Uint8Array;
            let rawDataG = rasters.length > 1 ? rasters[1] as Uint8Array : rawDataR;
            let rawDataB = rasters.length > 2 ? rasters[2] as Uint8Array : rawDataR;
            let rawDataA = rasters.length > 3 ? rasters[3] as Uint8Array : undefined;

            let width = rasters.width;
            let height = rasters.height;
            // 99.97% of browsers support 4096 as max texture size per
            // https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE
            const maxTextureSize = 4096;
            // TODO: split textures into several smaller textures
            // e.g. a 20000x4000 texture would be split into 5 tiles of 4000x4000
            if (width > maxTextureSize || height > maxTextureSize) {
                console.log(`texture size is too big ${width}x${height}`);
                const factor = width > height ? maxTextureSize / width : maxTextureSize / height;
                width = Math.floor(width * factor);
                height = Math.floor(height * factor);
                console.log(`texture size reduced to ${width}x${height}`);

                const subsampledRasters = await image.readRasters({ width: width, height: height, resampleMethod: 'bilinear' });
                console.log('tiff subsampledRasters', subsampledRasters);
                rawDataR = subsampledRasters[0] as Uint8Array;
                rawDataG = subsampledRasters.length > 1 ? subsampledRasters[1] as Uint8Array : rawDataR;
                rawDataB = subsampledRasters.length > 2 ? subsampledRasters[2] as Uint8Array : rawDataR;
                rawDataA = subsampledRasters.length > 3 ? subsampledRasters[3] as Uint8Array : undefined;
            }

            const size = width * height;
            const data = new Uint8Array(4 * size);

            for (let i = 0; i < size; i++) {
                const stride = i * 4;
                data[stride] = rawDataR[i];
                data[stride + 1] = rawDataG[i];
                data[stride + 2] = rawDataB[i];
                data[stride + 3] = rawDataA ? rawDataA[i] : 255;
            }

            const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
            texture.colorSpace = SRGBColorSpace;
            texture.magFilter = LinearFilter;
            texture.needsUpdate = true;
            return texture;
        });
    }
}

export { loadGeoTiff };