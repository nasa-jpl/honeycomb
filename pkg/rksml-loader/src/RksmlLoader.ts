/**
 * @typedef {Object} RKSMLResult
 *
 * @param {String} name
 * The name of the RKSML file as specified by the `<Name>` tag.
 *
 * @param {String} mission
 * The name of the mission in the RKSML file.
 *
 * @param {('ET'|'SCLK')} timeFormat
 * The format of the times reported in the frames. Either "ET" or "SCLK"
 *
 * @param {Array} frames
 * An array of objects describing the state of the RKSML knots at a given time:
 * ```js
 * {
 *     time: 0,
 *     state: {
 *         ROVER_X: 0.0,
 *         ROVER_Y: 0.0,
 *         ROVER_Z: 0.0,
 *         // ...
 *     }
 * }
 * ```
 */

/** Class for loading and parsing RKSML */
export class RksmlLoader {
    constructor() {
        /**
         * If true a new frame is created at the beginning of the list of
         * frames containing the initial state for all knot fields in the RKSML.
         * @member {Boolean}
         * @default false
         */
        this.backfill = false;

        /**
         * @member {Object}
         * @description Fetch options for loading the file.
         * @default { credentials: 'same-origin' }
         */
        this.fetchOptions = { credentials: 'same-origin' };
    }

    /**
     * Loads and parses the RKSML file. The promise resolves with the returned
     * data from the {@link #RksmlLoader#parse parse} function.
     * @param {String} url
     * @returns {Promise<RKSMLResult>}
     */
    load(url) {
        return fetch(url, this.fetchOptions)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`RKSMLLoader: Failed to load file "${url}" with status ${res.status} : ${res.statusText}`);
                }
                return res.text();
            })
            .then(txt => this.parse(txt));
    }

    /**
     * Parses the contents of the given RKSML and returns an object describing
     * the telemetry.
     * @param {String} str
     * @returns {RKSMLResult}
     */
    parse(str) {
        // This is much faster than using the DomParser but clearly
        // less robust.
        const shRegex = /<State_History(.*?)>([\s\S]*?)<\/\s*State_History\s*>/g;
        const nodeRegex = /<Node([\s\S]*?)>([\s\S]*?)<\/\s*Node\s*>/g;
        const knotRegex = /<Knot([\s\S]*?)>([\s\S]*?)<\/\s*Knot\s*>/g;
        const nameRegex = /<Name>([\s\S]*?)<\/\s*Name\s*>/;
        const timeAttrRegex = /Time\s*=\s*"(.+?)"/;
        const nameAttrRegex = /Name\s*=\s*"(.+?)"/;
        const missionAttrRegex = /Mission\s*=\s*"(.+?)"/;
        const formatAttrRegex = /Format\s*=\s*"(.+?)"/;

        // Parse <State_History>s
        while (true) {
            console.time('RKSMLLoader: Parse');

            let timeFormat = null;
            let mission = null;
            let name = null;
            const frames = [];
            const sh = shRegex.exec(str);

            if (sh === null) break;

            const shAttrs = sh[1];
            timeFormat = formatAttrRegex.test(shAttrs) ? formatAttrRegex.exec(shAttrs)[1] : null;
            mission = missionAttrRegex.test(shAttrs) ? missionAttrRegex.exec(shAttrs)[1] : null;

            const shContent = sh[2];
            const nameTag = shContent.match(nameRegex);
            if (nameTag) name = nameTag[1];

            // Parse <Node>s
            while (true) {
                const node = nodeRegex.exec(shContent);
                if (node == null) break;

                const nodeAttrs = node[1];
                const nodeContent = node[2];

                const frame = {};
                frame.time = parseFloat(nodeAttrs.match(timeAttrRegex)[1]);
                frame.state = {};

                // Parse <Knot>s
                while (true) {
                    const knot = knotRegex.exec(nodeContent);
                    if (knot == null) break;

                    const knotAttrs = knot[1];
                    const value = parseFloat(knot[2]);
                    const name = knotAttrs.match(nameAttrRegex)[1];

                    frame.state[name] = value;
                }
                knotRegex.lastIndex = 0;
                frames.push(frame);
            }

            console.timeEnd('RKSMLLoader: Parse');

            // If the time format is not explicitly specified then try to guess using
            // the `<Name>` field. Assume that `:Simulation` means the time format is ET
            // and anything else is in SCLK
            if (!timeFormat) {
                timeFormat = /:Simulation/.test(name) ? 'ET' : 'SCLK';
            }
            timeFormat = timeFormat.toUpperCase();

            frames.sort((a, b) => a.time - b.time);

            if (frames.length > 0 && this.backfill) {
                console.time('RKSMLLoader: Backfill');

                const backfilled = {};
                for (let i = frames.length - 1; i >= 0; i--) {
                    const thisState = frames[i].state;
                    for (const key in thisState) {
                        backfilled[key] = thisState[key];
                    }
                }

                frames.unshift({
                    time: frames[0].time,
                    state: backfilled,
                });

                console.timeEnd('RKSMLLoader: Backfill');
            }

            // only parse one for the moment
            return { frames, name, timeFormat, mission };
        }

        throw new Error('RksmlLoader: Could not parse RKSML.');
    }
}
