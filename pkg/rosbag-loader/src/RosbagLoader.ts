// Guarantee that even in node that the web distribution of rosbag will be used
import { Bag } from '@foxglove/rosbag';
import { BlobReader } from '@foxglove/rosbag/web.js';
import * as TimeUtil from '@foxglove/rostime';
import * as lz4 from 'lz4js';

function indexTransformState(state) {
    const transforms = state.transforms;
    state.transforms = {};
    for (let j = 0, l2 = transforms.length; j < l2; j++) {
        const t2 = transforms[j];
        state.transforms[t2.child_frame_id] = t2;
    }
    return state;
}

function normalizeTopicName(name) {
    if (name[0] !== '/') return '/' + name;
    return name;
}

/**
 * @typedef {Object} ReaderOptions
 * A list of options to pass into the loader to control which messages are parsed and how. Any
 * {@link https://github.com/cruise-automation/rosbag.js#bagoptions BagOptions from rosbag.js } are valid here, too.
 *
 * @param {Boolean} [flattenState=false]
 * If true the hierarchy of objects is flattened into a single object with the `flattenDelimiter` separating
 * object children.
 *
 * @param {String} [flattenDelimiter='_']
 * The character to use to separate nested object names when flattening the object state.
 *
 * @param {Boolean} [indexTransform=true]
 *
 * If true the `transform` object in the "/tf" and "/tf_static" messages are converted from an array in to an
 * object indexed by `child_frame_id`:
 *
 * ```js
 * {
 *      transforms: [
 *          { child_frame_id: 'base_link', transform: { ... } },
 *          { child_frame_id: 'world', transform: { ... } }
 *      ]
 * }
 *
 * // into
 *
 * {
 *      transforms: {
 *          'base_link': { child_frame_id: 'base_link', transform: { ... } },
 *          'world': { child_frame_id: 'world', transform: { ... } }
 *      }
 * }
 *
 * ```
 *
 * @param {Boolean} [readAllData=true]
 * If true the full list of Rosbag data will be returned from the reader in the callback. Otherwise a RosbagReader
 * handle will be returned so data can be read as needed.
 *
 * @param {Boolean} [normalizeTopicNames=true]
 * If true all topic names are normalized to be prefixed with a `/` the way {@link https://github.com/RobotWebTools/roslibjs roslibjs}
 * registers them over websocket. If false some topic name may not be prefixed with slashes.
 *
 * @param {Boolean} [separateTopicArrays=false]
 * If true all topics are broken out into separate arrays of data in a map. Otherwise a single array of data is returned.
 */

/**
 * Class for reading data from the rosbag file.
 */
export class RosbagReader {
    /**
     * The start time in ms of the rosbag file.
     * @member {Number}
     */
    get start() {
        const { handle, options } = this;
        return TimeUtil.toDate(handle.startTime).getTime() * options.timeScale;
    }

    /**
     * The end time in ms of the rosbag file.
     * @member {Number}
     */
    get end() {
        const { handle, options } = this;
        return TimeUtil.toDate(handle.endTime).getTime() * options.timeScale;
    }

    /**
     * Takes a handle to the {@link https://github.com/cruise-automation/rosbag.js#bag-instance Rosbag.js Bag Instance} to read
     * messages from an a set of options to use when reading messages.
     * @param {RosbagHandle} handle
     * @param {ReaderOptions} options
     */
    constructor(handle, options) {
        Object.defineProperty(this, 'handle', {
            get() {
                return handle;
            },
        });

        // TODO: See if this data can be decompressed
        // asynchronously.
        this.options = Object.assign(
            {
                separateTopicArrays: true,
                indexTransform: true,
                normalizeTopicNames: true,
                timeScale: 1.0,

                decompress: {
                    lz4: buffer => {
                        return buffer.constructor.from(lz4.decompress(buffer));
                    },
                },
            },
            options,
        );

        const normalizeTopicNames = this.options.normalizeTopicNames;
        const messageTypes = {};
        const normalizedToTopic = {};
        const rawTopics = [];
        let topics = [];

        const connections = this.handle.connections;
        connections.forEach((connection, key) => {
            const rawTopic = connection.topic;
            if (!rawTopics.includes(rawTopic)) {
                rawTopics.push(rawTopic);
            }

            const topic = normalizeTopicNames ? normalizeTopicName(rawTopic) : rawTopic;
            if (!topics.includes(topic)) {
                topics.push(topic);
            }

            messageTypes[topic] = connection.type;
        });

        rawTopics.forEach(n => {
            const newName = normalizeTopicName(n);
            if (n !== newName && rawTopics.includes(newName)) {
                throw new Error('Normalized ROS Topic name conflicts with another topic name.');
            }
            normalizedToTopic[newName] = n;
        });

        /**
         * A map from topic name to ROS topic message type.
         * @member {Object}
         */
        this.messageTypes = messageTypes;

        /**
         * The list of topics available in the given Rosbag.
         * @member {Array<String>}
         */
        this.topics = topics;
        this.normalizedToTopic = normalizedToTopic;
        this.rawTopics = rawTopics;
        this.numEmptyTfMessagesSeen = 0;
    }

    emptyTfConsoleMessageFunction = () => {
        const timePeriod = 5;
        const timePeriodMs = timePeriod * 1000;
        if (this.numEmptyTfMessagesSeen > 0) {
            console.warn(this.numEmptyTfMessagesSeen + 
                ' empty transforms message(s), skipped reading those frame(s) from rosbag, checking again in ' +
                timePeriod + ' seconds...');
            this.numEmptyTfMessagesSeen = 0;
        }

        this.emptyTfConsolesMessageHandle = setTimeout(this.emptyTfConsoleMessageFunction, timePeriodMs);
    }

    /**
     * Takes a from time and and to time in milliseconds and returns the set of data between those times. A
     * set of options can be provided to override the set of options originally passed into the reader. Options
     * from rosbag.js cannot be overriden here.
     *
     * The shape of the returned data depends on the `separateTopicArrays`. If true then a map of topic name
     * to array of frames of data is returned:
     *
     * ```js
     * {
     *      '/tf' : [ ... ],
     *      '/tf_static' : [ ... ],
     *      '/markers' : [ ... ],
     * }
     * ```
     *
     * Otherwise an array of frames is returned. A frame consists of a `time` field in ms and `state` field which
     * contains the ros topic message contents:
     *
     * ```js
     * {
     *      time: number,
     *      state: {
     *          //...
     *      }
     * }
     * ```
     * @param {Number} from
     * @param {Number} to
     * @param {ReaderOptions} options
     * @returns {Promise<Object|Array>}
     */
    async read(from, to, options) {
        const handle = this.handle;
        const map = {};
        const frames = [];
        options = Object.assign({}, this.options, options);

        const timeScale = options.timeScale;
        if (from) {
            options.startTime = TimeUtil.fromDate(new Date(from / timeScale));
        }

        if (to) {
            options.endTime = TimeUtil.fromDate(new Date(to / timeScale));
        }

        if (options.normalizeTopicNames && options.topics) {
            // note that some topics will "normalize" to "undefined" because they're not present in this bag
            // but it isn't an issue.
            options.topics = options.topics.map(n => this.normalizedToTopic[n]);
        }

        this.emptyTfConsoleMessageFunction();

        const normalizeTopicNames = options.normalizeTopicNames;
        const separateTopicArrays = options.separateTopicArrays;
        const indexTransform = options.indexTransform;
        await handle.readMessages(options, res => {
            let topic;
            if (normalizeTopicNames) {
                topic = normalizeTopicName(res.topic);
            } else {
                topic = res.topic;
            }

            const time = TimeUtil.toDate(res.timestamp).getTime() * timeScale;
            const message = res.message;
            const data = res.data;

            let state = null;
            if (message) {
                state = message;
            } else {
                state = data;
            }

            let messageHasContent = true;
            if (topic === '/tf' || topic === '/tf_static') {
                if (state.transforms && !Object.keys(state.transforms).length) {
                    messageHasContent = false;
                    this.numEmptyTfMessagesSeen++;
                } else if (indexTransform) {
                    indexTransformState(state);
                }
            }

            if (messageHasContent) {
                if (separateTopicArrays) {
                    let arr = map[topic];
                    if (!arr) arr = map[topic] = [];

                    // Generate the telemetry object
                    arr.push({
                        time,
                        state,
                    });
                } else {
                    frames.push({
                        time,
                        state: {
                            [topic]: state,
                        },
                    });
                }
            }
        });

        clearTimeout(this.emptyTfConsolesMessageHandle);

        return separateTopicArrays ? map : frames;
    }
}

export class RosbagLoader {
    static indexTransformState(...args) {
        return indexTransformState(...args);
    }

    constructor() {
        /**
         * @member {Object}
         * @description Fetch options for loading the file.
         * @default { credentials: 'same-origin' }
         */
        this.fetchOptions = { credentials: 'same-origin' };
    }

    /**
     * Loads and parses the ROS bag file. The promise resolves with the returned data from the `parse` function.
     * @param {String} url
     * @param {ReaderOptions|null} [options=null]
     * @returns {Map|Array|RosbagReader}
     */
    load(url, options) {
        return fetch(url, this.fetchOptions)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`RosbagLoader: Failed to load file "${url}" with status ${res.status} : ${res.statusText}`);
                }
                return res.blob();
            })
            .then(blob => this.parse(blob, options));
    }

    /**
     * Takes a file handle blob to read and a set of options to read the messages with. If `readAllData` is
     * false a {@link #RosbagReader RosbagReader} instance is returned otherwise all frames are read and returned. See the
     * {@link #RosbagReader#read} for a description of the returned data.
     * @param {Blob} data
     * @param {ReaderOptions|null} [options=null]
     * @returns {Map|Array|RosbagReader}
     */
    async parse(data, options = {}) {
        // default options
        options = Object.assign(
            {
                readAllData: true,
            },
            options,
        );

        // Generate a file object for the parsing library
        let file = null;
        if (data instanceof File) {
            file = data;
        } else if (data instanceof Blob) {
            file = new File([data], 'temp-name.bag');
        } else if (data instanceof ArrayBuffer) {
            file = new File(new Blob([new Uint8Array(data)]), 'temp-name.bag');
        } else if (typeof data === 'string') {
            file = data;
        }

        // Parse the messages
        const handle = new Bag(new BlobReader(file));
        await handle.open();

        const reader = new RosbagReader(handle, options);

        if (options.readAllData) {
            return reader.read();
        } else {
            return reader;
        }
    }
}
