
async function loadARKSML(paths, options, manager) {
    if (options.type) {
        console.warn('Arksml Animator "type" option has been deprecated in favor of explicitly typed animators such as "m20-arksml".');
    }

    const { ArksmlLoader } = await import('@gov.nasa.jpl.honeycomb/arksml-loader');
    const loader = new ArksmlLoader();
    loader.fetchOptions = { ...loader.fetchOptions, ...options.fetchOptions };
    loader.outputFrames = true;
    loader.eventDuration = options.eventDuration || loader.eventDuration;
    loader.minimumDuration = options.minimumDuration || loader.minimumDuration;

    const resolvedPaths = paths.map(p => manager.resolveURL(p));
    const data = await Promise.all(resolvedPaths.map(p => loader.load(p)));

    const frames = data.map(d => d.frames).flat();
    const events = data.map(d => d.events).flat();
    // need to resort because could be multiple arksml files
    frames.sort((a, b) => a.time - b.time);
    events.sort((a, b) => a.time - b.time);

    const { TelemetryAnimator } = await import('@gov.nasa.jpl.honeycomb/telemetry-animator');
    const fAnim = new TelemetryAnimator(frames);
    fAnim.interpolate = false;
    fAnim.optimize();
    const eAnim = new TelemetryAnimator(events);
    eAnim.interpolate = false;
    eAnim.optimize();

    return {
        frames: fAnim,
        events: eAnim,
    };
}

export { loadARKSML };
