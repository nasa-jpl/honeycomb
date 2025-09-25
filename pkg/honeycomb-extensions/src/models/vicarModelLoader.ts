import { TypedArray } from '@gov.nasa.jpl.honeycomb/common';
import { LoadingManager } from '@gov.nasa.jpl.honeycomb/core';
import { BandSampler2D, SpatialSampler2D } from '@gov.nasa.jpl.honeycomb/sampler-2d';
import { SampledTerrain } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import { DoubleSide, Object3D } from 'three';

interface VicarOptions {
    maxSamplesPerDimension: number;
}

function loadVicarHeightMap(path: string, options: Partial<VicarOptions>, manager: LoadingManager): Promise<Object3D> {
    const resolvedPath = manager.resolveURL(path);
    const pr = import('@gov.nasa.jpl.honeycomb/vicar-loader').then(({ VicarLoaderBase }) => {
        return new VicarLoaderBase()
            .load(resolvedPath)
            .then(res => {
                const { data, width, height, depth, labels } = res;

                const bands: SpatialSampler2D[] = [];
                for (let i = 0; i < depth; i++) {
                    const layer = i;
                    const offset = data.byteOffset + width * height * layer * data.BYTES_PER_ELEMENT;
                    const bandData: TypedArray = new (data as any).constructor(data.buffer, offset, width * height);
                    const band = new SpatialSampler2D(bandData, width, 1);
                    bands.push(band);
                }
                const sampler = new BandSampler2D(bands);

                // MAP_SCALE / 2.0 pulls vertices in by half a pixel so all
                // samples are positioned at the center of the fragments.
                const X_AXIS_MINIMUM_LABEL = labels.find(l => l.name === 'X_AXIS_MINIMUM');
                const Y_AXIS_MINIMUM_LABEL = labels.find(l => l.name === 'Y_AXIS_MINIMUM');
                const MAP_SCALE_LABEL = labels.find(l => l.name === 'MAP_SCALE');

                const X_AXIS_MINIMUM = X_AXIS_MINIMUM_LABEL ? X_AXIS_MINIMUM_LABEL.value as number : 0;
                const Y_AXIS_MINIMUM = Y_AXIS_MINIMUM_LABEL ? Y_AXIS_MINIMUM_LABEL.value as number : 0;
                let MAP_SCALE = MAP_SCALE_LABEL ? MAP_SCALE_LABEL.value as number | [number, number] : 1;
                if (!Array.isArray(MAP_SCALE)) {
                    // some vicar files are providing data as an array
                    MAP_SCALE = [MAP_SCALE, MAP_SCALE];
                }

                const terrain = new SampledTerrain(sampler);
                terrain.sampleInWorldFrame = false;
                terrain.maxSamplesPerDimension = options.maxSamplesPerDimension || 2000;
                terrain.samples.set(width, height);
                terrain.channel = 1;
                terrain.setBounds(
                    X_AXIS_MINIMUM + MAP_SCALE[0] / 2.0,
                    Y_AXIS_MINIMUM + MAP_SCALE[1] / 2.0,
                    X_AXIS_MINIMUM + width * MAP_SCALE[0] - MAP_SCALE[0] / 2.0,
                    Y_AXIS_MINIMUM + height * MAP_SCALE[1] - MAP_SCALE[1] / 2.0,
                    0,
                );
                terrain.update();

                (terrain.mesh.material as any).side = DoubleSide;
                (terrain.mesh.material as any).flatShading = true;

                (terrain.mesh.material as any).defines.ENABLE_TOPO_LINES = 1;
                (terrain.mesh.material as any).topoLineColor.set(0x333333);

                (terrain.mesh.material as any).maxSteepness = 0.75;
                (terrain.mesh.material as any).defines.ENABLE_STEEPNESS_CLIP = 1;

                return terrain;
            });
    });

    return pr;
}

export { loadVicarHeightMap };
