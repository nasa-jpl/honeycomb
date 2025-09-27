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

interface GeoTIFFOrthoPhotoResult {
    texture: DataTexture;
    width: number; // world scale width
    height: number; // world scale height
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
    const demX = tempVec.x / geoCoordsData.resolutionWidth + geoCoordsData.rasterWidth / 2;
    const demY = tempVec.y / geoCoordsData.resolutionHeight + geoCoordsData.rasterHeight / 2;

    // get UTM coords in Easting, Northing format
    const [utmEasting, utmNorthing] = affineTransform(demX, demY, geoCoordsData.pixelToGPS);

    if (geoCoordsData.utmZoneLetter === 'Equirectangular Moon' || 
        geoCoordsData.utmZoneLetter === 'EQUIRECTANGULAR_MOON') {
        // with example values in comments from Reiner Gamma
        // https://wms.lroc.asu.edu/lroc/view_rdr/NAC_DTM_REINER4
        const MoonRadius = geoCoordsData.geoKeys.GeogSemiMajorAxisGeoKey; // 1737400
        const centralMeridian = geoCoordsData.geoKeys.ProjCenterLongGeoKey; // 180
        const centralParallel = geoCoordsData.geoKeys.ProjCenterLatGeoKey; // 0
        const standardParallel = geoCoordsData.geoKeys.ProjStdParallel1GeoKey; // 7

        // https://en.wikipedia.org/wiki/Equirectangular_projection#Reverse
        // Appendix B of https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DOCUMENT/RDRSIS.PDF
        const lat = utmNorthing / ((Math.PI/180) * MoonRadius) + centralParallel;
        const lon = utmEasting / ((Math.PI/180) * MoonRadius * Math.cos(standardParallel * Math.PI / 180)) + centralMeridian - 360;

        return {
            lat: lat,
            lon: lon,
            elevation: -tempVec.z // in meters
        };
    } else {
        // now convert to latitude and longitude
        const utm = new UTMLatLng();
        const latLng = utm.convertUtmToLatLng(utmEasting, utmNorthing, geoCoordsData.utmZoneNumber, geoCoordsData.utmZoneLetter);
        return {
            lat: (latLng as any).lat,
            lon: (latLng as any).lng,
            elevation: -tempVec.z // in meters
        };
    }
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

export function getXYFromGeoCoords(lat: number, lon: number, viewer: Viewer) {
    // TODO: do this in a more performant way...
    // TODO: assumes there's only one terrain that has geo coords, which is
    // probably a decent assumption for most cases, but not all cases...
    let terrainWithGeoCoords: Object3D | null = null;
    viewer.scene.traverse((obj: Object3D) => {
        if (obj.userData.geoCoords) {
            terrainWithGeoCoords = obj;
        }
    });

    if (!terrainWithGeoCoords) {
        return null;
    }

    const geoCoordsData = (terrainWithGeoCoords as any).userData.geoCoords || ((terrainWithGeoCoords as any).parent as any).userData.geoCoords;

    if (!geoCoordsData) {
        return null;
    }

    const utm = new UTMLatLng();
    const precision = 9;

    // @ts-expect-error case issue with convertLatLngToUtm and ConvertLatLngToUtm
    const utmResult = utm.convertLatLngToUtm(lat, lon, precision) as any;
    const utmEasting = utmResult["Easting"];
    const utmNorthing = utmResult["Northing"];

    const [demX, demY] = affineTransform(utmEasting, utmNorthing, geoCoordsData.gpsToPixel);

    // get terrain coords
    const x = (demX - geoCoordsData.rasterWidth / 2) * geoCoordsData.resolutionWidth;
    const y = (demY - geoCoordsData.rasterHeight / 2) * geoCoordsData.resolutionHeight;

    tempVec.set(x, y, 0);

    // get the terrain coords point in three.js scene coords
    FrameTransformer.transformPoint(
        tempMat.identity(),
        (terrainWithGeoCoords as any).matrixWorld.clone().invert(),
        tempVec,
        tempVec
    );

    return tempVec;
}


function loadGeoTiff(path: string, options: Partial<GeoTiffOptions>, manager: LoadingManager): Promise<Object3D> {
    return new Promise(async (resolve) => {
        const timeStart = performance.now();
        manager.itemStart(path);
        const resolvedPath = manager.resolveURL(path);
        const filename = resolvedPath.split('/').pop();
        const gtReader = new GeoTiffDEMFileReader(options, filename || '', manager);
        console.log(`Beginning to load ${filename}, full path ${resolvedPath}`);
        gtReader.load(resolvedPath)
            .then(async (obj: SampledTerrain) => {
                if (options.orthophotoPath) {
                    manager.itemStart(options.orthophotoPath);
                    const reader = new GeoTiffOrthoPhotoFileReader(options, options.orthophotoPath.split('/').pop() || '');
                    const geoTiffOrthoPhotoResult: GeoTIFFOrthoPhotoResult = await reader.load(
                        pathM.join(pathM.dirname(resolvedPath), options.orthophotoPath)
                    ).finally(() => manager.itemEnd(path));

                    const material = (obj.mesh.material as any);
                    material.textureStampMap = geoTiffOrthoPhotoResult.texture;
                    material.defines.ENABLE_TEXTURE_STAMP = 1;
                    material.defines.ENABLE_TEXTURE_STAMP_USE_MODEL_COORDINATES = 1;

                    // follow examples from Honeycomb:
                    // https://github.jpl.nasa.gov/Honeycomb/honeycomb/blob/master/packages/modules/honeycomb-extensions/src/enav/drivers/EnavHeightmap.js
                    // https://github.jpl.nasa.gov/Honeycomb/honeycomb/blob/master/packages/modules/honeycomb-extensions/src/enav/drivers/EnavCostmap.js

                    const tempVec3 = new Vector3();
                    const tempScale = new Vector3();
                    const tempQuat = new Quaternion();
                    const tempMat4 = new Matrix4();

                    // the orthophoto should be stretched to the world scale size
                    const width = geoTiffOrthoPhotoResult.width;
                    const height = geoTiffOrthoPhotoResult.height;

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

                // TODO: this time to load may be slightly misleading since if you load multiple GeoTIFF simultaneously,
                // it appears that they all get started in parallel, but sitll load in sequence after that...
                console.log(`${filename}: Took ${(performance.now() - timeStart)}ms to read in GeoTIFF${options.orthophotoPath ? ', including orthophoto' :''}`);

                resolve(obj);
            })
            .finally(() => manager.itemEnd(path));
    });
}

class GeoTiffDEMFileReader extends FetchArrayBufferLoader<SampledTerrain> {
    options: GeoTiffOptions;
    filename: string;
    manager: LoadingManager;
    constructor(options: GeoTiffOptions, filename: string, manager: LoadingManager) {
        super();
        this.options = options;
        this.filename = filename;
        this.manager = manager;
    }

    async parse(arrayBufer: ArrayBuffer): Promise<SampledTerrain> {
        return new Promise(async (resolve) => {
            const tiff = await fromArrayBuffer(arrayBufer);
            const image = await tiff.getImage(); // by default, the first image is read.
            let timeStart = performance.now();

            // await this.manager.itemProgress(`Reading raster for ${this.filename}...`);

            const rasters = await image.readRasters();
            console.log(`${this.filename}: Took ${performance.now() - timeStart}ms to read in raster`);

            // TODO: there's a bunch of information in these objects that we should
            // probably take advantage of somehow...
            // console.log('tiff', tiff);
            // console.log('tiff image', image); // TODO: utilize these parameters to get the orientation correct (i.e., north up)....
            // console.log('tiff rasters', rasters);
            const options = this.options;

            const rasterWidth = rasters.width;
            const rasterHeight = rasters.height;
            const zScale = options.zScale ?? 1;
            const zOffset = options.zOffset ?? 0;

            // console.log('rasterWidth * rasterHeight', rasterWidth * rasterHeight);

            // Note that 536346624 is the max length of ArrayBuffers in Chrome on MacOS per
            // https://stackoverflow.com/a/72124984. 536346624 * 4 bytes = 2,145,386,496 bytes.
            // This is 2^31 - 2^21 bytes.

            // The underlying OptimizedPlaneBufferGeometry class creates a Uint32Array
            // of length (rasterWidth - 1) * (rasterHeight - 1) * 6. Thus, to
            // utilize the underlying OptimizedPlaneBufferGeometry class, we'll
            // need to have a maximum square area of 89391104 units:
            //   89391104 === 536346624 / 6 === (2^29 - 2^19) / 6
            // (we need 6 indices per vertex; see
            //  honeycomb/modules/three-extensions/src/geometry/OptimizedPlaneBufferGeometry.ts)

            // However, the three-mesh-bvh package makes a Float32Array of length
            // 6 * triangle count === 6 * ((rasterWidth - 1) * (rasterHeight - 1) * 6) / 3)
            // This means:
            // 6 * ((rasterWidth - 1) * (rasterHeight - 1) * 6) / 3) <= 536346624
            // or (rasterWidth - 1) * (rasterHeight - 1) <= ((536346624 / 6) * 3) / 6
            // or (rasterWidth - 1) * (rasterHeight - 1) <= 44695552

            // In practice, it appears that even having rasters close to square areas
            // of 44695552 still doesn't always work (it loads but something messes up).
            // We've been able to get away with 75% of that number. Roughly, this means
            // making sure your image is less than 5800x5800 pixels.

            if ((rasterWidth - 1) * (rasterHeight - 1) > 44695552) {
                console.error('This raster is too large! ');
                console.error(`(rasterWidth - 1) * (rasterHeight - 1) = (${rasterWidth} - 1)` +
                    ` * (${rasterHeight} - 1) = ${(rasterWidth - 1) * (rasterHeight - 1)} >= 44695552`);
                console.error('Try to get your raster below 5800x5800');
            }

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
            const sampler = new ZOffsetSpatialSampler2D((rasters[0] as TypedArray), rasterWidth, 1);
            sampler.zOffset = zOffset;
            sampler.zScale = zScale;
            sampler.maxValue = maxValue;

            const terrain = new SampledTerrain(sampler);

            const material = (terrain.mesh.material as any);
            material.side = DoubleSide;
            material.flatShading = true; // needed for slope map to look ok
            material.topoLineColor.set(0xff0000);
            material.needsUpdate = true;

            // resolution is in meters per pixel
            const resolutionWidth = image.fileDirectory.ModelPixelScale[0];
            const resolutionHeight = image.fileDirectory.ModelPixelScale[1];
            terrain.setBounds(
                (-rasterWidth * resolutionWidth) / 2.0,
                (-rasterHeight * resolutionHeight) / 2.0,
                (rasterWidth * resolutionWidth) / 2.0,
                (rasterHeight * resolutionHeight) / 2.0,
                0,
            );
            terrain.samples.set(rasterWidth, rasterHeight);
            terrain.maxSamplesPerDimension = options.maxSamplesPerDimension ?? terrain.maxSamplesPerDimension;
            terrain.sampleInWorldFrame = false;

            if (image.fileDirectory.ModelTiepoint) {
                // TODO: what if ModelTiepoint[0-2] are not 0's?
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
            const [sx, _sy, _sz] = s;
            const sy = -_sy; // WGS-84 tiles have a "flipped" y component
            const [_px, _py, _k, gx, gy, _gz] = t;
            const pixelToGPS = [gx, sx, 0, gy, 0, sy];
            const gpsToPixel = [-gx / sx, 1 / sx, 0, -gy / sy, 0, 1 / sy];

            // utm zone number and letter are needed for the UTMLatLng library
            const gtCitationGeoKey: string = image.geoKeys["GTCitationGeoKey"];
            const numberAndLetter: string = gtCitationGeoKey.replace(/.*UTM zone /, "");
            const utmZoneNumber: number = parseInt(numberAndLetter.replace(/[A-Za-z]*/, ""));
            const utmZoneLetter: string = numberAndLetter.replace(/[0-9]*/, "");

            terrain.userData["geoCoords"] = {
                rasterWidth: rasterWidth,
                rasterHeight: rasterHeight,
                resolutionWidth: resolutionWidth,
                resolutionHeight: resolutionHeight,
                pixelToGPS: pixelToGPS,
                gpsToPixel: gpsToPixel,
                utmZoneNumber: utmZoneNumber,
                utmZoneLetter: utmZoneLetter,
                geoKeys: image.geoKeys
            };

            timeStart = performance.now();
            // await this.manager.itemProgress(`Loading terrain for ${this.filename}...`);
            terrain.update();
            // await this.manager.itemProgress(`Loading...`);
            console.log(`${this.filename}: Took ${performance.now() - timeStart}ms to update terrain.`);
            resolve(terrain);
        });
    }
}

class GeoTiffOrthoPhotoFileReader extends FetchArrayBufferLoader<GeoTIFFOrthoPhotoResult> {
    options: GeoTiffOptions;
    filename: string;
    constructor(options: GeoTiffOptions, filename: string) {
        super();
        this.options = options;
        this.filename = filename;
    }

    async parse(arrayBufer: ArrayBuffer): Promise<GeoTIFFOrthoPhotoResult> {
        return await fromArrayBuffer(arrayBufer).then(async (tiff) => {
            const image = await tiff.getImage(); // by default, the first image is read.

            let timeStart = performance.now();
            const rasters = await image.readRasters();
            console.log(`${this.filename} (orthophoto): Took ${performance.now() - timeStart}ms to read in raster`);

            // TODO: there's a bunch of information in these objects that we should
            // probably take advantage of somehow...
            // console.log('GeoTiffOrthoPhotoFileReader tiff', tiff);
            // console.log('GeoTiffOrthoPhotoFileReader tiff image', image);
            // console.log('GeoTiffOrthoPhotoFileReader tiff rasters', rasters);

            let rawDataR = rasters[0] as Uint8Array;
            let rawDataG = rasters.length > 1 ? rasters[1] as Uint8Array : rawDataR;
            let rawDataB = rasters.length > 2 ? rasters[2] as Uint8Array : rawDataR;
            let rawDataA = rasters.length > 3 ? rasters[3] as Uint8Array : undefined;

            let rasterWidth = rasters.width;
            let rasterHeight = rasters.height;
            // 99.97% of browsers support 4096 as max texture size per
            // https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE
            const maxTextureSize = 4096;
            // TODO: split textures into several smaller textures
            // e.g. a 20000x4000 texture would be split into 5 tiles of 4000x4000
            if (rasterWidth > maxTextureSize || rasterHeight > maxTextureSize) {
                console.log(`texture size is too big ${rasterWidth}x${rasterHeight}`);
                const factor = rasterWidth > rasterHeight ? maxTextureSize / rasterWidth : maxTextureSize / rasterHeight;
                rasterWidth = Math.floor(rasterWidth * factor);
                rasterHeight = Math.floor(rasterHeight * factor);
                console.log(`texture size reduced to ${rasterWidth}x${rasterHeight}`);

                const subsampledRasters = await image.readRasters({ width: rasterWidth, height: rasterHeight, resampleMethod: 'bilinear' });
                console.log('tiff subsampledRasters', subsampledRasters);
                rawDataR = subsampledRasters[0] as Uint8Array;
                rawDataG = subsampledRasters.length > 1 ? subsampledRasters[1] as Uint8Array : rawDataR;
                rawDataB = subsampledRasters.length > 2 ? subsampledRasters[2] as Uint8Array : rawDataR;
                rawDataA = subsampledRasters.length > 3 ? subsampledRasters[3] as Uint8Array : undefined;
            }

            const size = rasterWidth * rasterHeight;
            const data = new Uint8Array(4 * size);

            for (let i = 0; i < size; i++) {
                const stride = i * 4;
                data[stride] = rawDataR[i];
                data[stride + 1] = rawDataG[i];
                data[stride + 2] = rawDataB[i];
                data[stride + 3] = rawDataA ? rawDataA[i] : 255;
            }

            const texture = new DataTexture(data, rasterWidth, rasterHeight, RGBAFormat, UnsignedByteType);
            texture.colorSpace = SRGBColorSpace;
            texture.magFilter = LinearFilter;
            texture.needsUpdate = true;

            // resolution is in meters per pixel
            const resolutionWidth = image.fileDirectory.ModelPixelScale[0];
            const resolutionHeight = image.fileDirectory.ModelPixelScale[1];
            return {
                texture,
                width: rasters.width * resolutionWidth,
                height: rasters.height * resolutionHeight
            };
        });
    }
}

export { loadGeoTiff };