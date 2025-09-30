import { RosTransformTrackerBase } from './RosTransformTrackerBase';
import { compareTimeStamps } from './utils';

/**
 * Transform tracker that retains a buffer of tf and tf_static ros messages over time so
 * they can be used to derive the latest position of a ros frame.
 */
export class RosTransformTracker extends RosTransformTrackerBase {
    bufferMs: number;
    messages: any[];

    /**
     * As well as the name of the root fixed frame to provide transforms relative to a buffer in
     * milliseconds is provided so we know how long to keep data around.
     * @param {Number} [bufferMs=10000]
     */
    constructor(bufferMs = 10000) {
        super();

        this.bufferMs = bufferMs;
        this.messages = [];
    }

    /**
     * Override of {@link #RosTransformTrackerBase#applyMessage RosTransformTrackerBase.applyMessage} that
     *
     * @param {RosTfMessage} msg
     * @param {('/tf'|'/tf_static')} topic
     * @returns {void}
     */
    applyMessage(msg, topic) {
        super.applyMessage(msg, topic);

        // copy the message contents
        const messages = this.messages;
        msg = JSON.parse(JSON.stringify(msg));

        // Get the time stamp in the message. Use a for in loop that
        // terminates immediately in order to handle the object index
        // or array case.
        let stamp;
        for (const key in msg.transforms) {
            stamp = msg.transforms[key].header.stamp;
            break;
        }

        const obj = {
            stamp,
            [topic]: msg,
            topic,
        };

        // Find where the message should be inserted. Walk backwards from
        // the latest time.
        let inserted = false;
        for (let i = 0, l = messages.length; i < l; i++) {
            const index = l - i - 1;
            const state = messages[index];
            if (compareTimeStamps(state.stamp, stamp) < 0) {
                messages.splice(index + 1, 0, obj);
                inserted = true;
                break;
            }
        }

        // if we didn't insert then it must be oldest.
        if (!inserted) {
            messages.unshift(obj);
        }

        // remove all messages that are outside the buffer time
        const latestObj = messages[messages.length - 1];
        const latestStamp = latestObj.stamp;
        const ms =
            'secs' in latestStamp
                ? latestStamp.secs * 1e3 + latestStamp.nsecs * 1e-6
                : latestStamp.sec * 1e3 + latestStamp.nsec * 1e-6;
        const bufferMs = this.bufferMs;
        while (true) {
            if (messages.length === 0) break;

            const msgStamp = messages[0].stamp;
            const msgMs =
                'secs' in msgStamp
                    ? msgStamp.secs * 1e3 + msgStamp.nsecs * 1e-6
                    : msgStamp.sec * 1e3 + msgStamp.nsec * 1e-6;

            if (ms - msgMs > bufferMs) {
                messages.shift();
            } else {
                break;
            }
        }
    }

    /**
     * Override of {@link #RosTransformTrackerBase#seekBack RosTransformTrackerBase.seekBack} that
     * iterates over the the stored messages from latest to earliest.
     * @param {Function} cb
     * @returns {void}
     */
    seekBack(cb) {
        const messages = this.messages;
        for (let i = 0, l = messages.length; i < l; i++) {
            const index = l - i - 1;
            const state = messages[index];
            if (cb(state) === true) {
                return;
            }
        }
    }

    /**
     * Override of {@link #RosTransformTrackerBase#reset RosTransformTrackerBase.reset} that
     * clears the saved messages as well as the transforms.
     * @param {Function} cb
     * @returns {void}
     */
    reset(resetStatic) {
        super.reset(resetStatic);
        this.messages = [];
    }
}
