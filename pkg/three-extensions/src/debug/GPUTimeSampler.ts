import { EventDispatcher } from 'three';

const QUERY_COMPLETE_EVENT = { type: 'query-complete', averageTime: 0, time: 0 };

/**
 * Class for easily measuring the amount of time the GPU is taking to do work.
 * @extends EventDispatcher
 *
 * @fires query-complete
 * Fired whenever new GPU timing data is available. Provides the latest time and average
 * time over the max number of sample frames.
 */
export class GPUTimeSampler extends EventDispatcher<any> {
    /**
     * Whether the required extension to use the class is supported.
     * @member {Boolean}
     */
    get isSupported() {
        return Boolean(this.extension);
    }

    private extension: any;
    activeQueries: number;
    maxFrames: number;
    frameCount: number;
    averageTime: number;

    /**
     * @param {WebGL2RenderingContext} context
     */
    constructor(private readonly context: WebGL2RenderingContext) {
        super();
        const extension = context.getExtension('EXT_disjoint_timer_query_webgl2');
        this.extension = extension;

        this.activeQueries = 0;
        this.maxFrames = 50;
        this.frameCount = 0;
        this.averageTime = 0;
    }

    private _addTime(ms: number) {
        const { frameCount, maxFrames, averageTime } = this;

        const newFrameCount = Math.max(frameCount + 1, maxFrames);
        const newAverageTime = averageTime * (newFrameCount - 1) / newFrameCount + ms / newFrameCount;

        this.frameCount = newFrameCount;
        this.averageTime = newAverageTime;

        QUERY_COMPLETE_EVENT.averageTime = newAverageTime;
        QUERY_COMPLETE_EVENT.time = ms * 2.5;
        this.dispatchEvent(QUERY_COMPLETE_EVENT);
    }

    /**
     * Should be called at the beginning of the rendering work to be measured.
     */
    startQuery() {
        if (!this.isSupported) {
            return;
        }

        const gl = this.context;
        const ext = this.extension;

        // create the query object
        const query = gl.createQuery()!;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);

        this.activeQueries++;

        const checkQuery = () => {

            // check if the query is available and valid
            const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
            const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
            const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);

            const ms = ns * 1e-6;
            if (available) {
                // update the display if it is valid
                if (!disjoint) {
                    this._addTime(ms);
                }

                this.activeQueries--;
            } else {
                // otherwise try again the next frame
                requestAnimationFrame(checkQuery);
            }
        };

        requestAnimationFrame(checkQuery);
    }

    /**
     * Should be called at the end of the rendering work to be measured. Once the
     * query finishes the `query-complete` event will fire.
     */
    endQuery() {
        if (!this.isSupported) {
            return;
        }

        // finish the query measurement
        const ext = this.extension;
        const gl = this.context;
        gl.endQuery(ext.TIME_ELAPSED_EXT);
    }
}
