
/**
 * @typedef {Object} AnnotationData
 * Set of data parsed from an XML node within annotations. The structure is defined by the parse
 * function associated with the node. Type is the only value guaranteed to be defined. Other parameters
 * are included based on the annotation parser.
 *
 * @param {String} type
 * The name embedded in the ARKSML file.
 */

/**
 * @typedef {Object} ArksmlResult
 * @param {String} name
 * The name embedded in the ARKSML file.
 *
 * @param {Array<{ startTime: Number, endtime: Number, annotations: Array<AnnotationData>}>} spans
 * List of annotation spans within the file.
 *
 * @param {Array<{ time: Number, annotations: Array<AnnotationData>}>} events
 * List event annotation data.
 */

/**
 * @typedef {Object} ArksmlFramesResult
 * @param {String} name
 * The name embedded in the ARKSML file.
 *
 * @param {Array<{ time: Number, state: { annotations: Array<AnnotationData> } }>} frames
 * The array of annotations converted to frames. A new frame is inserted every time the
 * list of relevant annotations change. This includes events.
 *
 * @param {Array<{ time: Number, annotations: Array<AnnotationData>}>} events
 * List event annotation data.
 */

/**
 * Extendable class for loading and parsing ARKSML files.
 */
export class ArksmlLoader {
    /**
     * Takes a dictionary of parser functions for parsing annotation tags. The parser functions
     * are keyed based on the name of the annotation tag it should parse.
     * @param {Object<String, ParserFunction>} parsers
     */
    constructor(parsers = {}) {

        /**
         * Dictionary of parsers. 
         * @member {Object}
         */
        this.parsers = Object.assign(
            {
            },
            parsers,
        );

        /**
         * Whether or not to return the data as a set of frames in an array of the form
         * ```js
         * [{
         *     time,
         *     state: {
         *         annotations: [...]
         *     }
         * }, ...]
         * ```
         * @member {Boolean}
         * @default false
         */
        this.outputFrames = false;

        /**
         * What the minimum duration for events should be when converting to frames.
         * @member {Numbar}
         * @default 5.0
         */
        this.eventDuration = 5.0;

        /**
         * The minimum duration of any given annotation in the file. If an annotaiton is shorter
         * than this then it is extended from its startTime to this time.
         * @member {Numbar}
         * @default 5.0
         */
        this.minimumDuration = 0.0;

        /**
         * Fetch options for loading the file.
         * @member {Object}
         * @default { credentials: 'same-origin' }
         */
        this.fetchOptions = { credentials: 'same-origin' };
    }

    /**
     * Loads and parses the ARKSML file. The promise resolves with the returned
     * data from the {@link #ArksmlLoader#parse parse} function.
     * @param {String} url
     * @returns {Promise<ArksmlResult|ArksmlFramesResult>}
     */
    load(url) {
        return fetch(url, this.fetchOptions)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`ARKSMLLoader: Failed to load file "${url}" with status ${res.status} : ${res.statusText}`);
                }
                return res.text();
            })
            .then(txt => this.parse(txt));
    }

    /**
     * Parses the contents of the given ARKSML and returns an object describing
     * the telemetry.
     * @param {String} str
     * @returns {RKSMLResult}
     */
    parse(str) {
        console.time('ARKSMLLoader: Parse');
        const doc = new DOMParser().parseFromString(str, 'application/xml');
        const rpkNode = doc.querySelector('RPK_Annotations');
        const annotationsNode = rpkNode.querySelector('Annotations');
        const annotationNodeList = annotationsNode.querySelectorAll('Annotation');

        const nameNode = rpkNode.querySelector('Name');

        const spans = [];
        const events = [];
        const name = nameNode.innerHTML;

        for (let i = 0, l = annotationNodeList.length; i < l; i++) {
            const node = annotationNodeList[i];

            const arksmlAnnotation = {};
            arksmlAnnotation.annotations = [];

            // there might be multiple annotation types in the annotation
            // node, iterate through and parse each one
            const children = node.children;
            for (let j = 0, ll = children.length; j < ll; j++) {
                const type = children[j].nodeName;
                if (this.parsers.hasOwnProperty(type)) {
                    const parsedAnnotation = this.parsers[type](children[j]);

                    if (parsedAnnotation.type) {
                        console.error(
                            `ARKSMLLoader: Parser for "${type}" node incorrectly defined type field in result.`,
                        );
                    }

                    parsedAnnotation.type = type;
                    arksmlAnnotation.annotations.push(parsedAnnotation);
                } else {
                    console.error(
                        `ARKSMLLoader: parsers did not have implementation for "${type}" node`,
                    );
                }
            }

            if (node.hasAttribute('Start') && node.hasAttribute('End')) {
                arksmlAnnotation.startTime = parseFloat(node.getAttribute('Start'));
                arksmlAnnotation.endTime = parseFloat(node.getAttribute('End'));
                spans.push(arksmlAnnotation);
            } else if (node.hasAttribute('Time')) {
                arksmlAnnotation.time = parseFloat(node.getAttribute('Time'));
                events.push(arksmlAnnotation);
            } else {
                throw new Error(`ArksmlLoader: Unknown annotation time format ${node}`);
            }
        }
        console.timeEnd('ARKSMLLoader: Parse');

        return this.outputFrames
            ? this.convertToFrames(spans, events, name)
            : { spans, events, name };
    }

    /* Override */
    /**
     * Overrideable function called when we need to preprocess spans and events
     * @param {Array<{ startTime: Number, endtime: Number, annotations: Array<AnnotationData>}>} rawSpans
     * @param {Array<{ time: Number, annotations: Array<AnnotationData>}>} rawEvents
     * @param {String} name
     * @returns {void}
     */
    preprocessFrames(rawSpans, rawEvents, name) {}

    // convert raw data from loading ARKSML to frames that Honeycomb animators can use
    convertToFrames(rawSpans, rawEvents, name) {
        this.preprocessFrames(rawSpans, rawEvents, name);

        const events = [];
        if (rawEvents) {
            const duration = this.eventDuration;
            for (let i = 0, l = rawEvents.length; i < l; i++) {
                const rawEvent = rawEvents[i];

                // Store the event in the events list
                const frameEvent = {};
                frameEvent.time = rawEvent.time;
                // TODO is anyone using this already?  Maybe it should not have this nested state?
                frameEvent.state = {};
                frameEvent.state.annotations = rawEvent.annotations;
                events.push(frameEvent);

                // convert rawEvents to spans with the default duration
                const fakeSpan = {};
                fakeSpan.startTime = frameEvent.time;
                fakeSpan.annotations = rawEvent.annotations.map(a => {
                    return { ...a, event: true };
                });
                fakeSpan.endTime = rawEvent.time + duration;
                rawSpans.push(fakeSpan);
            }
        }

        // enforce a minimum duration
        rawSpans.forEach(f => {
            f.endTime = Math.max(f.endTime, f.startTime + this.minimumDuration);
        });

        // gather all unique start & end times
        const allFrameTimesSet = new Set();
        for (let i = 0, l = rawSpans.length; i < l; i++) {
            allFrameTimesSet.add(rawSpans[i].startTime);
            allFrameTimesSet.add(rawSpans[i].endTime);
        }
        const allFrameTimesArr = Array.from(allFrameTimesSet);
        allFrameTimesArr.sort((a, b) => {
            return a - b;
        });

        // generate frames with all times
        const frames = [];
        for (let i = 0, l = allFrameTimesArr.length; i < l; i++) {
            const frame = {};
            frame.time = allFrameTimesArr[i];
            frame.state = {};
            frame.state.annotations = [];
            frames.push(frame);
        }

        // populate frames with annotations relevant to their time ranges
        for (let i = 0, l = rawSpans.length; i < l; i++) {
            const currAnnotationWindow = rawSpans[i];
            for (let j = 0, ll = frames.length; j < ll; j++) {
                const currentFrame = frames[j];
                if (
                    currentFrame.time >= currAnnotationWindow.startTime &&
                    (currentFrame.time < currAnnotationWindow.endTime ||
                    currAnnotationWindow.startTime === currAnnotationWindow.endTime)
                ) {
                    currentFrame.state.annotations = currentFrame.state.annotations.concat(
                        currAnnotationWindow.annotations,
                    );
                }
            }
        }

        return { frames, events, name };
    }
}
