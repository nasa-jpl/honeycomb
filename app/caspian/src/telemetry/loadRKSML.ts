import { TransformAnimator } from '@gov.nasa.jpl.honeycomb/extensions/src/telemetry/TransformAnimator';

async function loadRKSML(paths, options, manager) {
    const { RksmlLoader } = await import('@gov.nasa.jpl.honeycomb/rksml-loader');
    const resolvedPaths = paths.map(p => manager.resolveURL(p));
    const data = await Promise.all(
        resolvedPaths.map(p => {
            const loader = new RksmlLoader();
            loader.fetchOptions = { ...loader.fetchOptions, ...options.fetchOptions };
            loader.backfill = true;
            return loader.load(p);
        }),
    );
    const frames = data.map(data => data.frames).flat();
    frames.sort((a, b) => a.time - b.time);

    const timeFormat = data[0].timeFormat;
    data.forEach(data => {
        if (data.timeFormat !== timeFormat) {
            throw new Error('Not all RKSML time formats are the same.');
        }
    });

    const quatMap = {
        qx: 'QUAT_X',
        qy: 'QUAT_Y',
        qz: 'QUAT_Z',
        qw: 'QUAT_C',
    };

    const anim = new TransformAnimator(frames, {
        rotationMaps: [quatMap],
    });
    anim.continuous = true;
    anim.interpolate = true;
    (anim as any).timeFormat = timeFormat;
    anim.optimize();
    return anim;
}

export { loadRKSML };
