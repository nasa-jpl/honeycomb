
export async function loadM20EnavImgs(paths, options, manager) {
    const { EnavImgsLoader } = await import('./EnavImgsLoader');
    const loader = new EnavImgsLoader();

    loader.fetchOptions = { ...loader.fetchOptions, ...options.fetchOptions };
    loader.outputFrames = true;
    loader.eventDuration = options.eventDuration || loader.eventDuration;
    loader.minimumDuration = options.minimumDuration || loader.minimumDuration;

    const resolvedPaths = paths.map(p => manager.resolveURL(p));
    const data = await (await Promise.all(resolvedPaths.map(p => loader.load(p)))).flat();

    // need to resort because could be multiple paths
    data.sort((a, b) => a.time - b.time);

    const { EnavImgsLookAheadAnimator } = await import('./EnavImgsLookAheadAnimator');
    const fAnim = new EnavImgsLookAheadAnimator(data);
    fAnim.fetchOptions = { ...fAnim.fetchOptions, ...options.fetchOptions };

    fAnim.lookAhead = 100;
    fAnim.lookBack = 10;
    return fAnim;
}
