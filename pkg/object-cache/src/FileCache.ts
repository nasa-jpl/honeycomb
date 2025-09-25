import { serialize, deserialize } from './utils';
import path from 'path';
import fsSync, { promises as fs } from 'fs';
import tmp from 'tmp';

// https://stackoverflow.com/questions/12627586/is-node-js-rmdir-recursive-will-it-work-on-non-empty-directories
async function rmDirRecursive(path: string) {
    let files: string[] = [];
    if (fsSync.existsSync(path)) {
        files = await fs.readdir(path);
        for (const file of files) {
            const curPath = path + '/' + file;
            if ((await fs.lstat(curPath)).isDirectory()) {
                // recurse
                await rmDirRecursive(curPath);
            } else {
                // delete file
                await fs.unlink(curPath);
            }
        }

        await fs.rmdir(path);
    }
};

// TODO: change fs functions to the async variant
class FileCache<K, V> {
    private _tmpHandle!: tmp.DirResult;
    private _dir!: string;

    constructor() {
        this._resetDir();
    }

    private _resetDir() {
        if (this._tmpHandle) {
            this._tmpHandle.removeCallback();
        }
        this._tmpHandle = tmp.dirSync();
        this._dir = this._tmpHandle.name;
    }

    has(key: K): boolean {
        const p = path.join(this._dir, `${key}.json`);
        return fsSync.existsSync(p);
    }

    async set(key: K, value: V) {
        const result = serialize(value);
        const json = result.data;
        const bin = result.bin;
        const p = path.join(this._dir, `${key}.json`);

        try {
            await fs.writeFile(p, json, { encoding: 'utf8', flag: 'wx' });
        } catch {
            throw new Error(`Cache already contains ${key}.`);
        }

        if (bin.length > 0) {
            const binDir = path.join(this._dir, `${key}-bin`);
            await fs.mkdir(binDir);
            for (let i = 0, l = bin.length; i < l; i++) {
                const binPath = path.join(binDir, `${i}.bin`);
                const buffer = bin[i];
                await fs.writeFile(binPath, buffer);
            }
        }
    }

    private async getImpl(key: K): Promise<V> {
        // TODO: The JSON parse dominates here. Either find some way to make that faster or
        // make this async so it doesn't block user interaction.
        const p = path.join(this._dir, `${key}.json`);
        const data = await fs.readFile(p, { encoding: 'utf8' });

        const res = deserialize<V>(data, async (index: string, type: string) => {
            const binPath = path.join(this._dir, `${key}-bin`, `${index}.bin`);
            if (type === 'buffer') {
                const buffer = fs.readFile(binPath);
                return buffer;
            } if (type === 'string') {
                const str = await fs.readFile(binPath, { encoding: 'utf8' });
                return str;
            } else {
                return null;
            }
        });

        return await res;
    }

    get(key: K): Promise<V> | undefined {
        const exists = this.has(key);
        if (!exists) {
            return undefined;
        }

        return this.getImpl(key);
    }

    async delete(key: K) {
        const exists = this.has(key);
        if (!exists) {
            return;
        }

        const p = path.join(this._dir, `${key}.json`);
        const binPath = path.join(this._dir, `${key}-bin`);
        await fs.unlink(p);
        rmDirRecursive(binPath);
    }

    async clear() {
        this._resetDir();
    }
}

export { FileCache };
