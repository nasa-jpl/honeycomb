export class EnavImgsLoader {
    constructor() {
    }

    load(url) {
        const frames = [];
        const match =
            /(disp_approx|VgncRawLeft|VgncRawRight)_([0-9]*)-([0-9]*)/.exec(url);
        const sclkStr = `${match[2]}.${match[3]}`;
        const sclk = parseFloat(sclkStr);

        frames.push({
            time: parseFloat(sclk),
            state: {
                annotations: [{
                    permalink: url,
                    ocs_name: url
                }],
            },
        });

        return frames;
    }
}
