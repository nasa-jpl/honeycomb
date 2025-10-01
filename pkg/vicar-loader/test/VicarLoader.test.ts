import { VicarLoaderBase } from '../src/base/VicarLoaderBase';

function createFile(labels, labelSize, contentSize) {
    const trimmedLabels = labels.replace(/\s+/g, ' ').trim();
    const byteBuffer = new Uint8Array(labelSize + contentSize);
    for (let i = 0, l = trimmedLabels.length; i < l; i++) {
        byteBuffer[i] = trimmedLabels.charCodeAt(i);
    }
    return byteBuffer.buffer;
}

describe('PDSLoader', () => {
    it('should correctly parse the vicar contents.', () => {
        const loader = new VicarLoaderBase();
        const labels = `
            LBLSIZE=120
            RECSIZE=40
            FORMAT='REAL'
            ORG='BSQ'
            NS=10
            NL=10
            NB=3
        `;

        const result = loader.parse(createFile(labels, 120, 1200));
        expect(result.labels).toEqual([
            { name: 'LBLSIZE', value: 120 },
            { name: 'RECSIZE', value: 40 },
            { name: 'FORMAT', value: 'REAL' },
            { name: 'ORG', value: 'BSQ' },
            { name: 'NS', value: 10 },
            { name: 'NL', value: 10 },
            { name: 'NB', value: 3 },
        ]);
        expect(result.data.byteLength).toEqual(1200);
        expect(result.data instanceof Float32Array).toBeTruthy();

        expect(result.width).toEqual(10);
        expect(result.height).toEqual(10);
        expect(result.depth).toEqual(3);
    });

    it('should be tolerant to duplicate labels and use the first instance for defining the image.', () => {
        const loader = new VicarLoaderBase();
        const labels = `
            LBLSIZE=120
            RECSIZE=40
            FORMAT='REAL'
            ORG='BSQ'
            NS=10
            NL=10
            NB=3
            NL=1000
            TEST='A'
            TEST='B'
        `;

        const result = loader.parse(createFile(labels, 120, 1200));
        expect(result.labels).toEqual([
            { name: 'LBLSIZE', value: 120 },
            { name: 'RECSIZE', value: 40 },
            { name: 'FORMAT', value: 'REAL' },
            { name: 'ORG', value: 'BSQ' },
            { name: 'NS', value: 10 },
            { name: 'NL', value: 10 },
            { name: 'NB', value: 3 },
            { name: 'NL', value: 1000 },
            { name: 'TEST', value: 'A' },
            { name: 'TEST', value: 'B' },
        ]);
        expect(result.data.byteLength).toEqual(1200);
        expect(result.data instanceof Float32Array).toBeTruthy();

        expect(result.width).toEqual(10);
        expect(result.height).toEqual(10);
        expect(result.depth).toEqual(3);
    });

    it('should parse array labels and escaped quotes.', () => {
        const loader = new VicarLoaderBase();
        const labels = `
            LBLSIZE=200
            RECSIZE=40
            FORMAT='REAL'
            ORG='BSQ'
            NS=10
            NL=10
            NB=3
            NUM_ARR=(1,2,3, 4)
            STR_ARR=('A', 'B','C')
            MIX_ARR=( 'A', 1,'C', 3 )
            ESCAPED='test''s'
        `;

        const result = loader.parse(createFile(labels, 200, 1200));
        expect(result.labels).toEqual([
            { name: 'LBLSIZE', value: 200 },
            { name: 'RECSIZE', value: 40 },
            { name: 'FORMAT', value: 'REAL' },
            { name: 'ORG', value: 'BSQ' },
            { name: 'NS', value: 10 },
            { name: 'NL', value: 10 },
            { name: 'NB', value: 3 },
            { name: 'NUM_ARR', value: [1,2,3,4] },
            { name: 'STR_ARR', value: ['A','B','C'] },
            { name: 'MIX_ARR', value: ['A', 1, 'C', 3] },
            { name: 'ESCAPED', value: 'test\'s' },
        ]);
    });
});
