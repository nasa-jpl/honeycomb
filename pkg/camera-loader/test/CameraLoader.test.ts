import { CameraLoader } from "../src";

describe('CameraLoaderBase', () => {
    it('should parse CameraModels properly into a dictionary', async () => {
        const loader = new CameraLoader();
        const result = loader.parse(
            `<?xml version="1.0" encoding="ascii"?>
            <CAMERA_MODELS>
                <CAMERA type="CAHVORE" name="CAM1" frame_name="CAM1_FRAME" width="1280" height="960" min_range="0.1" serial_number="1">
                    <C>1.103530,-0.008942,-0.829123</C>
                    <A>0.88,-0.12,0.23</A>
                    <H>2600.00,1600.438136,1270.5</H>
                    <V>650.823,-325.197,2832.188550</V>
                    <O>0.885345,-0.171272,0.423423</O>
                    <R>0.000001,0.001230,-0.005123</R>
                    <E>-0.005544,0.010203,0.002341</E>
                    <PUPILTYPE>3</PUPILTYPE>
                    <LINEARITY>0.25</LINEARITY>
                </CAMERA>
                <CAMERA type="CAHV" name="CAM2" frame_name="CAM2_FRAME" width="640" height="480" min_range="0.1" serial_number="2">
                    <C>0.932516,0.931234,-1.643244</C>
                    <A>0.954321,-0.005812,0.001230</A>
                    <H>2500.812423,2834.395570,14.234216</H>
                    <V>1918.658228,-3.141572,2985.009835</V>
                    <EXTRA>5</EXTRA>
                    <PUPILTYPE>3</PUPILTYPE>
                </CAMERA>
            </CAMERA_MODELS>`
        );

        const keys = Object.keys(result);

        expect(keys).toHaveLength(2);
        expect(result).toEqual(
            expect.objectContaining({
                CAM1: expect.any(Object),
                CAM2: expect.any(Object),
            }),
        );

        // check CAM1
        const CAM1 = result['CAM1'];
        expect(CAM1.type).toBe('CAHVORE');
        expect(CAM1.name).toBe('CAM1');
        expect(CAM1.frameName).toBe('CAM1_FRAME');
        expect(CAM1.width).toBe(1280);
        expect(CAM1.height).toBe(960);
        expect(CAM1.minRange).toBe(0.1);
        // expect(CAM1.serial_number).toBe(1);
        expect(CAM1.C).toEqual([1.103530, -0.008942, -0.829123]);
        expect(CAM1.A).toEqual([0.88, -0.12, 0.23]);
        expect(CAM1.H).toEqual([2600.0, 1600.438136, 1270.5]);
        expect(CAM1.V).toEqual([650.823, -325.197, 2832.18855]);
        expect(CAM1.O).toEqual([0.885345, -0.171272, 0.423423]);
        expect(CAM1.R).toEqual([0.000001, 0.00123, -0.005123]);
        expect(CAM1.E).toEqual([-0.005544, 0.010203, 0.002341]);
        expect(CAM1.pupilType).toBe(3);
        expect(CAM1.linearity).toBe(0.25);

        // check CAM2
        const CAM2 = result['CAM2'];
        expect(CAM2.type).toBe('CAHV');
        expect(CAM2.name).toBe('CAM2');
        expect(CAM2.frameName).toBe('CAM2_FRAME');
        expect(CAM2.width).toBe(640);
        expect(CAM2.height).toBe(480);
        expect(CAM2.minRange).toBe(0.1);
        // expect(CAM2.serial_number).toBe(2);
        expect(CAM2.C).toEqual([0.932516, 0.931234, -1.643244]);
        expect(CAM2.A).toEqual([0.954321, -0.005812, 0.00123]);
        expect(CAM2.H).toEqual([2500.812423, 2834.39557, 14.234216]);
        expect(CAM2.V).toEqual([1918.658228, -3.141572, 2985.009835]);
        // expect(CAM2.EXTRA).toEqual(5);
        expect(CAM2.pupilType).toBe(3);
    });
});
