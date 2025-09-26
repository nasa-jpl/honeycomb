export async function loadM20EnavArksml(paths, options, manager) {
    const { EnavArksmlLoader } = await import('./EnavArksmlLoader');
    const loader = new EnavArksmlLoader();

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

    // I'm making a BIG assumption that if there are multiple
    // paths for arksml, they'll all be in the same directory
    // TODO: think of a better way to deal with this
    const { EnavLookAheadAnimator } = await import('./EnavLookAheadAnimator');
    const fAnim = new EnavLookAheadAnimator(frames, resolvedPaths[0]);
    fAnim.fetchOptions = { ...fAnim.fetchOptions, ...options.fetchOptions };

    // TODO: The lookahead animator defaults to 1000ms and 100ms for preload
    // but ARKSML and RKSML use seconds to represent their time. This should be
    // changed.
    fAnim.lookAhead = 100;
    fAnim.lookBack = 10;
    return fAnim;
}
