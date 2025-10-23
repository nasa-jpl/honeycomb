const { RksmlLoader } = require('../src/RksmlLoader');

describe('RksmlLoader', () => {
    it('should parse rksml properly', async () => {
        const loader = new RksmlLoader();
        const result = loader.parse(`
            <?xml version="1.0"?>
            <RPK_Set xmlns="RPK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="RPK.xsd">
                <State_History Mission="MSL" Format="ET">
                    <Name>MSL:Simulation</Name>
                    <Node Time="1.1">
                        <Knot Name="ROVER_X" Units="METERS">0</Knot>
                        <Knot Name="ROVER_Y" Units="METERS">1</Knot>
                        <Knot Name="ROVER_Z" Units="METERS">2</Knot>
                    </Node>
                    <Node Time="2.2">
                        <Knot Name="ROVER_X" Units="METERS">7.5</Knot>
                        <Knot Name="ROVER_Y" Units="METERS">-10.1</Knot>
                        <Knot Name="ROVER_Z" Units="METERS">0.2</Knot>
                    </Node>
                </State_History>
            </RPK_Set>`);

        expect(result.name).toBe('MSL:Simulation');
        expect(result.mission).toBe('MSL');
        expect(result.frames).toHaveLength(2);

        expect(result.timeFormat).toBe('ET');

        expect(result.frames[0]).toEqual({
            time: 1.1,
            state: {
                ROVER_X: 0,
                ROVER_Y: 1,
                ROVER_Z: 2,
            },
        });

        expect(result.frames[1]).toEqual({
            time: 2.2,
            state: {
                ROVER_X: 7.5,
                ROVER_Y: -10.1,
                ROVER_Z: 0.2,
            },
        });
    });

    it('should throw an error if State_History cannot be found.', () => {
        const loader = new RksmlLoader();

        try {
            loader.parse(`
                <?xml version="1.0"?>
                <RPK_Set xmlns="RPK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="RPK.xsd"></RPK_Set>`);
        } catch {
            return;
        }

        throw new Error('Parser did not throw error.');
    });

    it('should backfill frame data if the option is set to true.', () => {
        const loader = new RksmlLoader();
        loader.backfill = true;

        const result = loader.parse(`
            <?xml version="1.0"?>
            <RPK_Set xmlns="RPK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="RPK.xsd">
                <State_History Mission="MSL" Format="ET">
                    <Name>MSL:Simulation</Name>
                    <Node Time="1.1">
                        <Knot Name="ROVER_X" Units="METERS">1</Knot>
                    </Node>
                    <Node Time="2.2">
                        <Knot Name="ROVER_Y" Units="METERS">2</Knot>
                    </Node>
                    <Node Time="3.3">
                        <Knot Name="ROVER_Z" Units="METERS">3</Knot>
                    </Node>
                </State_History>
            </RPK_Set>`);

        expect(result.frames[0]).toEqual({
            time: 1.1,
            state: {
                ROVER_X: 1,
                ROVER_Y: 2,
                ROVER_Z: 3,
            },
        });

        expect(result.frames[1]).toEqual({
            time: 1.1,
            state: {
                ROVER_X: 1,
            },
        });

        expect(result.frames[2]).toEqual({
            time: 2.2,
            state: {
                ROVER_Y: 2,
            },
        });

        expect(result.frames[3]).toEqual({
            time: 3.3,
            state: {
                ROVER_Z: 3,
            },
        });
    });
});
