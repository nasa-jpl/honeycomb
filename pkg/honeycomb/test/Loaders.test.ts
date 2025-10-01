import { resolvePath } from '../src/Loaders';

describe('resolvePath', () => {
    it('should resolve URLS with protocol correctly.', () => {
        expect(resolvePath('https://this.is.a.url/test/test2', 'path/to/file.json'))
            .toEqual('https://this.is.a.url/test/test2/path/to/file.json');

        expect(resolvePath('test://a/to/', 'path.json'))
            .toEqual('test://a/to/path.json');
    });

    it('should ignore base paths when the file is relative to the root.', () => {
        expect(resolvePath('/this/is/a/base/path', '/path.json'))
            .toEqual('/path.json');
    });

    it('should ignore base path when resolving blob and data urls.', () => {
        expect(resolvePath('/this/is/a/base/path', 'data:text/vnd-example+xyz;foo=bar;base64,R0lGODdh'))
            .toEqual('data:text/vnd-example+xyz;foo=bar;base64,R0lGODdh');

        expect(resolvePath('/this/is/a/base/path', 'blob:https://www.testurl.com/ec11089d-ec29-4ea8-a656-703240b0a756'))
            .toEqual('blob:https://www.testurl.com/ec11089d-ec29-4ea8-a656-703240b0a756');
    });

    it('should simplify path directory changes.', () => {
        expect(resolvePath('/this/base/path', '../../file.json'))
            .toEqual('/this/file.json');

        expect(resolvePath('/this/base/path', '../../../../file.json'))
            .toEqual('/file.json');

        expect(resolvePath('/this/base/../path', 'file.json'))
            .toEqual('/this/path/file.json');

        expect(resolvePath('/this/base/path', 'path/./file.json'))
            .toEqual('/this/base/path/path/file.json');

        expect(resolvePath('this/base/path', '../../../../file.json'))
            .toEqual('../file.json');

        expect(resolvePath('https://www.testurl.com/path/', '../../../../file.json'))
            .toEqual('https://www.testurl.com/file.json');

        expect(resolvePath('./../../', 'path.json'))
            .toEqual('../../path.json');
    });

    it('should clean up duplicate slashes.', () => {
        expect(resolvePath('/this/path//', 'file.json'))
            .toEqual('/this/path/file.json');

        expect(resolvePath('/this/path//', 'path//to//file.json'))
            .toEqual('/this/path/path/to/file.json');
    });
});
