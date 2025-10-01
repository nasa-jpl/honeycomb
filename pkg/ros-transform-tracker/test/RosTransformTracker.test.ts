import { RosTransformTracker } from '../src/RosTransformTracker';
import { Matrix4, Vector3, Quaternion } from 'three';

describe('RosTransformTracker', () => {
    const frames = [
        {
            transforms: [
                {
                    header: { frame_id: 'world', stamp: { sec: 1, nsec: 1 } },
                    child_frame_id: 'base_link',
                    transform: {
                        translation: { x: 1, y: 2, z: 3 },
                        rotation: { x: 0, y: 0, z: 0, w: 1 },
                    },
                },
            ],
        },
        {
            transforms: [
                {
                    header: { frame_id: 'world', stamp: { sec: 5, nsec: 1 } },
                    child_frame_id: 'map',
                    transform: {
                        translation: { x: 1, y: 2, z: 3 },
                        rotation: { x: 1, y: 0, z: 0, w: 0 },
                    },
                },
            ],
        },
        {
            transforms: [
                {
                    header: { frame_id: 'base_link', stamp: { sec: 8, nsec: 1 } },
                    child_frame_id: 'wheel',
                    transform: {
                        translation: { x: 1, y: 2, z: 3 },
                        rotation: { x: 0, y: 0, z: 0, w: 1 },
                    },
                },
            ],
        },
        {
            transforms: [
                {
                    header: { frame_id: 'world', stamp: { sec: 9, nsec: 2 } },
                    child_frame_id: 'base_link',
                    transform: {
                        translation: { x: 4, y: 5, z: 6 },
                        rotation: { x: 0, y: 1, z: 0, w: 0 },
                    },
                },
            ],
        },
    ];

    let tracker;
    let matrix, pos, rot, sca;
    beforeEach(() => {
        tracker = new RosTransformTracker();
        frames.forEach(f => tracker.applyMessage(f, '/tf'));
        matrix = new Matrix4().identity();
        pos = new Vector3();
        rot = new Quaternion();
        sca = new Vector3();
    });

    it('should track transform frames', () => {
        expect(tracker.messages).toHaveLength(4);

        let count = 0;
        tracker.seekBack(() => count++);
        expect(count).toEqual(4);

        tracker.getTransformInFrame('base_link', 'world', matrix);
        matrix.decompose(pos, rot, sca);
        expect(pos).toEqual(new Vector3(4, 5, 6));
        expect(rot).toEqual(new Quaternion(0, 1, 0, 0));

        expect(tracker.messages.map(tf => tf.stamp)).toEqual(
            frames.map(tf => tf.transforms[0].header.stamp),
        );
    });

    it('should retrieve the position and rotation before a certain time.', () => {
        tracker.getTransformInFrame('base_link', 'world', matrix, { sec: 7, nsec: 0 });
        matrix.decompose(pos, rot, sca);
        expect(pos).toEqual(new Vector3(1, 2, 3));
        expect(rot).toEqual(new Quaternion(0, 0, 0, 1));
    });

    it('should discard messages beyond the specified buffer length.', () => {
        expect(tracker.messages).toHaveLength(4);
        const newMsg = {
            transforms: [
                {
                    header: { frame_id: 'world', stamp: { sec: 13, nsec: 2 } },
                    child_frame_id: 'base_link',
                    transform: {
                        translation: { x: 4, y: 5, z: 6 },
                        rotation: { x: 0, y: 1, z: 0, w: 0 },
                    },
                },
            ],
        };
        tracker.applyMessage(newMsg, '/tf');
        expect(tracker.messages).toHaveLength(4);
    });

    it('should apply transforms to child objects', () => {
        tracker.getTransformInFrame('wheel', 'world', matrix, { sec: 9, nsec: 0 });
        matrix.decompose(pos, rot, sca);

        expect(pos).toEqual(new Vector3(2, 4, 6));
        expect(rot).toEqual(new Quaternion(0, 0, 0, 1));
    });

    it('getTransformInFrame should return false if it cannot find a message in the cached data', () => {
        const found = tracker.getTransformInFrame('wheel', 'world', matrix, { sec: 9, nsec: 0 });
        const notFound = tracker.getTransformInFrame('wheel', 'world', matrix, { sec: 7, nsec: 0 });

        expect(found).toEqual(true);
        expect(notFound).toEqual(false);
    });

    it.todo('should be resilient to "sec" / "secs" and "nsec" / "nsecs" in the timestamp.');
});
