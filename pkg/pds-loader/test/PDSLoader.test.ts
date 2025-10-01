import { PDSLoader } from '../src/PDSLoader';
import { getFirstLabelInstance } from '../src/utils';

function stringToBuffer(str) {
    const byteBuffer = new Uint8Array(new ArrayBuffer(str.length));
    for (let i = 0, l = str.length; i < l; i++) {
        byteBuffer[i] = str.charCodeAt(i);
    }
    return byteBuffer.buffer;
}

describe('PDSLoader', () => {
    it('should correctly parse header labels.', done => {
        const loader = new PDSLoader();
        const labels = `
            RECORD_TYPE = FIXED_LENGTH
            ENUM = A
            STRING="B"
            SPACE_STRING="LONG STRING"
            MULTILINE_STRING="
                THIS IS
                A
                MULTILINE"
            ARRAY=(1, "A")
            OBJECT=OBJECT_NAME
                NESTED_FIELD=1
            END_OBJECT
            END
        `;

        loader.parse(stringToBuffer(labels)).then(res => {
            expect(res.labels).toEqual([
                { name: 'RECORD_TYPE', value: 'FIXED_LENGTH' },
                { name: 'ENUM', value: 'A' },
                { name: 'STRING', value: 'B' },
                { name: 'SPACE_STRING', value: 'LONG STRING' },
                { name: 'MULTILINE_STRING', value:
                    '\n                THIS IS\n                A\n                MULTILINE' },
                { name: 'ARRAY', value: [1, 'A'] },
                {
                    isLabelGroup: true,
                    name: 'OBJECT_NAME',
                    value: [
                        { name: 'NESTED_FIELD', value: 1 },
                    ],
                },
            ]);
            done();
        });
    });

    it.todo('should load an internal vicar product.');
});

describe('getFirstLabelInstance', () => {
    it('should return just the first instance of the label.', () => {
        const labels = [
            { name: 'A', value: 1 },
            { name: 'B', value: 2 },
            { name: 'A', value: 3 },
            { name: 'D', value: [1,2,3] },
        ];
        expect(getFirstLabelInstance(labels, 'A', 4)).toEqual(1);
        expect(getFirstLabelInstance(labels, 'B', 4)).toEqual(2);
        expect(getFirstLabelInstance(labels, 'C', 4)).toEqual(4);
        expect(getFirstLabelInstance(labels, 'C')).toEqual(undefined);
        expect(getFirstLabelInstance(labels, 'D', 4)).toEqual([1, 2, 3]);

    });

    it('should support deep object nesting.', () => {
        const labels = [
            { isLabelGroup: true, name: 'A', value: [
                { isLabelGroup: true, name: 'C', value: [
                    {
                        name: 'D',
                        value: 'TEST',
                    },
                ] },
            ] },
            { name: 'B', value: [{ name: 'INSIDE', value: 10 }] },
        ];

        expect(getFirstLabelInstance(labels, 'A.C.D')).toEqual('TEST');
        expect(getFirstLabelInstance(labels, 'A.C')).toEqual([{ name: 'D', value: 'TEST' }]);
        expect(getFirstLabelInstance(labels, 'B.INSIDE')).toEqual(undefined);
    });
});
