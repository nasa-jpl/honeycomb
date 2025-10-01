import { ArksmlLoader } from '../src/ArksmlLoader';

describe('ArksmlLoader', () => {
    it('should parse arksml properly into frames', async () => {
        const loader = new ArksmlLoader({
            Test: node => {
                return { value: parseFloat(node.innerHTML) };
            },
        });
        loader.outputFrames = true;
        const result = loader.parse(
            `<?xml version="1.0" ?>
            <RPK_Annotations
                xmlns:xsi="http://www.w3.org./2001/XMLSchema-instance"
                xsi:schemaLocation="RPK_Annotations.xsd"
            >
                <Annotations>
                    <Name>Test Annotations</Name>
                    <Annotation Start="0.0" End="10.0">
                        <Test>1</Test>
                    </Annotation>
                    <Annotation Start="3.0" End="8.0">
                        <Test>2</Test>
                    </Annotation>
                    <Annotation Start="8.0" End="12.0">
                        <Test>3</Test>
                    </Annotation>
                    <Annotation Start="10.0" End="20.0">
                        <Test>4</Test>
                    </Annotation>
                    <Annotation Start="12.0" End="18.0">
                        <Test>5</Test>
                    </Annotation>
                </Annotations>
            </RPK_Annotations>`
        );

        const frames = result.frames;

        expect(frames).toHaveLength(7);

        // check times
        expect(frames[0].time).toBe(0);
        expect(frames[1].time).toBe(3);
        expect(frames[2].time).toBe(8);
        expect(frames[3].time).toBe(10);
        expect(frames[4].time).toBe(12);
        expect(frames[5].time).toBe(18);
        expect(frames[6].time).toBe(20);

        // check annotations length
        expect(frames[0].state.annotations).toHaveLength(1);
        expect(frames[1].state.annotations).toHaveLength(2);
        expect(frames[2].state.annotations).toHaveLength(2);
        expect(frames[3].state.annotations).toHaveLength(2);
        expect(frames[4].state.annotations).toHaveLength(2);
        expect(frames[5].state.annotations).toHaveLength(1);
        expect(frames[6].state.annotations).toHaveLength(0);

        // check frame state annotations contents
        expect(frames[0].state.annotations).toEqual([{ type: 'Test', value: 1 }]);
        expect(frames[1].state.annotations).toEqual([
            { type: 'Test', value: 1 },
            { type: 'Test', value: 2 },
        ]);
        expect(frames[2].state.annotations).toEqual([
            { type: 'Test', value: 1 },
            { type: 'Test', value: 3 },
        ]);
        expect(frames[3].state.annotations).toEqual([
            { type: 'Test', value: 3 },
            { type: 'Test', value: 4 },
        ]);
        expect(frames[4].state.annotations).toEqual([
            { type: 'Test', value: 4 },
            { type: 'Test', value: 5 },
        ]);
        expect(frames[5].state.annotations).toEqual([{ type: 'Test', value: 4 }]);
        expect(frames[6].state.annotations).toEqual([]);
    });

    it.todo('Test parsing arksml to not use outputToFrames');

    it.todo('Test with ARKSML that has instantaneous events');
});
