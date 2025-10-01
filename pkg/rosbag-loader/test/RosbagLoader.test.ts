import { RosbagLoader, RosbagReader } from '../src/RosbagLoader.ts';
import path from 'path';
import fs from 'fs';
import { JSDOM } from 'jsdom';

// JSDOM + Jest seems to not support using TextDecoder now required by rosbag (though it is
// supported by Node / JSDOM) and node environment testing to remove JSDOM use doesn't support
// the following dependenceis which are also needed...
const { Blob, File, FileReader } = new JSDOM().window;
global.Blob = Blob;
global.File = File;
global.FileReader = FileReader;

// Use a blob to emulate how the browser / electron loads data.
// see https://github.jpl.nasa.gov/Honeycomb/honeycomb/issues/439
const bagPath = path.resolve(__dirname, './example.bag');
const bagBlob = new Blob([fs.readFileSync(bagPath)]);
describe('RosbagReader', () => {
    const handle = {
        connections: [
            { topic: '/tf' },
            { topic: '/tf_static' },
            { topic: 'test' },
            { topic: 'test/test' },
        ],
        readMessages(options, cb) {
            options.topics.forEach(topic => {
                cb({
                    topic,
                    message: `${topic}-message`,
                    data: { topic },
                    timestamp: { sec: 0, nsec: 0 },
                });
            });

            return Promise.resolve();
        },
    };

    it('should be returned by RosbagLoader when "readAllData" is false.', async () => {
        const loader = new RosbagLoader();
        let res;
        res = await loader.parse(bagBlob, { readAllData: false });
        expect(res instanceof RosbagReader).toEqual(true);

        res = await loader.parse(bagBlob, { readAllData: true });
        expect(res instanceof RosbagReader).toEqual(false);
        expect(typeof res).toEqual('object');
        expect('/tf' in res).toEqual(true);
    });

    it('should report the beginning and end times.', async () => {
        const loader = new RosbagLoader();
        const res = await loader.parse(bagBlob, { readAllData: false });
        expect(res.start).toEqual(1396293887844);
        expect(res.end).toEqual(1396293909544);
    });

    describe('normalizeTopicNames', () => {
        it('should cause ros topics to be normalized if true.', () => {
            const reader = new RosbagReader(handle, { normalizeTopicNames: true });
            expect(reader.topics).toEqual(['/tf', '/tf_static', '/test', '/test/test']);

            const reader2 = new RosbagReader(handle, { normalizeTopicNames: false });
            expect(reader2.topics).toEqual(['/tf', '/tf_static', 'test', 'test/test']);
        });

        it('should fail if names conflict.', () => {
            let caught = false;
            try {
                new RosbagReader(
                    {
                        connections: [{ topic: 'tf' }, { topic: '/tf' }],
                    },
                    { normalizeTopicNames: true },
                );
            } catch {
                caught = true;
            }
            expect(caught).toEqual(true);
        });

        it('should normalize message topic names if true.', async () => {
            let reader, res;
            reader = new RosbagReader(handle, { normalizeTopicNames: true, indexTransform: false });
            res = await reader.read(0, 1000, { topics: ['/tf', '/test', '/test/test'] });
            expect('/tf' in res).toEqual(true);
            expect('/test' in res).toEqual(true);
            expect('/test/test' in res).toEqual(true);
            expect('test' in res).toEqual(false);
            expect('test/test' in res).toEqual(false);

            reader = new RosbagReader(handle, {
                normalizeTopicNames: false,
                indexTransform: false,
            });
            res = await reader.read(0, 1000, { topics: ['/tf', 'test', 'test/test'] });
            expect('/tf' in res).toEqual(true);
            expect('/test' in res).toEqual(false);
            expect('/test/test' in res).toEqual(false);
            expect('test' in res).toEqual(true);
            expect('test/test' in res).toEqual(true);
        });
    });
});

describe('RosbagLoader', () => {
    describe('separateTopicArrays', () => {
        it('should return an object with multiple arrays if true.', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob);
            expect(typeof res).toEqual('object');
        });

        it('should return an array of objects if false.', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob, { separateTopicArrays: false });
            expect(Array.isArray(res)).toEqual(true);
        });
    });

    describe('topics', () => {
        it('should limit the returned topics.', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob, { topics: ['/turtle2/cmd_vel'] });
            expect(Object.keys(res)).toEqual(['/turtle2/cmd_vel']);
        });

        it('should return all topics if not specified.', async () => {
            const loader = new RosbagLoader();
            const reader = await loader.parse(bagBlob, { readAllData: false });
            const res = await loader.parse(bagBlob);
            expect(Object.keys(res)).toEqual(reader.topics);
        });
    });

    describe('indexTransform', () => {
        it('should transform the /tf state into an object if true', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob, {
                indexTransform: true,
                topics: ['/tf', '/tf_static'],
            });
            let frame;
            frame = res['/tf'][0].state;
            expect(typeof frame.transforms).toEqual('object');
            expect(Object.keys(frame.transforms)).toEqual(['turtle2']);

            frame = res['/tf_static'][0].state;
            expect(typeof frame.transforms).toEqual('object');
            expect(Object.keys(frame.transforms)).toEqual(['carrot']);
        });

        it('should keep the transform state as an array if true', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob, {
                indexTransform: false,
                topics: ['/tf', '/tf_static'],
            });
            let frame;
            frame = res['/tf'][0].state;
            expect(Array.isArray(frame.transforms)).toEqual(true);
            expect(frame.transforms).toHaveLength(1);
            expect(frame.transforms[0].child_frame_id).toEqual('turtle2');

            frame = res['/tf_static'][0].state;
            expect(Array.isArray(frame.transforms)).toEqual(true);
            expect(frame.transforms).toHaveLength(1);
            expect(frame.transforms[0].child_frame_id).toEqual('carrot');
        });

        it('should index properly when joining topic arrays.', async () => {
            const loader = new RosbagLoader();
            const res = await loader.parse(bagBlob, {
                indexTransform: true,
                separateTopicArrays: false,
                topics: ['/tf', '/tf_static'],
            });

            let frame;
            frame = res[1].state['/tf'];
            expect(typeof frame.transforms).toEqual('object');
            expect(Object.keys(frame.transforms)).toEqual(['turtle2']);

            frame = res[0].state['/tf_static'];
            expect(typeof frame.transforms).toEqual('object');
            expect(Object.keys(frame.transforms)).toEqual(['carrot']);
        });
    });
});
