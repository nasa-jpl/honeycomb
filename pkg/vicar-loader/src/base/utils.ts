import { VicarLabel } from "./VicarLoaderBase";

type VicarPrim = number | string | string[];
export type VicarValue = VicarPrim | VicarValue[];

// Parse label values into numbers, strings, or arrays
export function parseValue(val: string): VicarValue {
    val = val.trim();
    if (val[0] === '(') {
        const tokens = val.replace(/[()]/g, '').split(/,/g);
        return tokens.map(v => parseValue(v));
    } else if (val[0] === '\'') {
        return val.substring(1, val.length - 1).replace(/''/g, '\'');
    } else {
        return Number(val);
    }
}

function consumeString(s: string, i: number) {
    let token = s[i];
    while (true) {
        i++;
        const c = s[i];

        token += c;

        if (c === '\'') {
            if (s[i + 1] === '\'') {
                token += '\'';
                i++;
            } else {
                break;
            }
        }
    }

    return { token, index: i };
}

function consumeArray(s: string, i: number) {
    let token = s[i];
    while (true) {
        i++;

        const c = s[i];
        if (c === '\'') {
            const info = consumeString(s, i);
            token += info.token;
            i = info.index;
        } else if (c === ')') {
            token += c;
            break;
        } else {
            token += c;
        }
    }
    return { token, index: i };
}

// Parse the list of labels into an object
export function parseLabels(s: string) {
    const tokens: string[] = [];
    let lastToken = '';
    for (let i = 0, l = s.length; i < l; i++) {
        const c = s[i];
        if (c === '=' || c === ' ') {
            if (lastToken.trim() !== '') {
                tokens.push(lastToken);
            }
            lastToken = '';
        } else if (c === '\'') {
            const { token, index } = consumeString(s, i);
            i = index;
            lastToken += token;
        } else if (c === '(') {
            const { token, index } = consumeArray(s, i);
            i = index;
            lastToken += token;
        } else {
            lastToken += c;
        }
    }

    if (lastToken.trim() !== '') {
        tokens.push(lastToken);
    }

    const labels: { name: string, value: VicarValue }[] = [];
    for (let i = 0, l = tokens.length; i < l; i += 2) {
        const name = tokens[i].trim();
        const val = parseValue(tokens[i + 1].trim());
        labels.push({
            name, value: val,
        });
    }

    return labels;
}

// Read string from buffer from index "from" to "to"
export function readString(buffer: Uint8Array, from: number, to: number) {
    let str = '';
    for (let i = from; i < to; i++) {
        const value = String.fromCharCode(buffer[i]);
        if (value === '\0') {
            break;
        }
        str += value;
    }
    return str;
}

// Read string from buffer until "cb" returns true
export function readUntil(buffer: Uint8Array, from: number, cb: (c: string) => boolean) {
    let str = '';
    for (let i = from; i < buffer.length; i++) {
        const c = String.fromCharCode(buffer[i]);

        if (cb(c)) {
            break;
        } else {
            str += c;
        }
    }
    return str;
}

export function getFirstLabelInstance<T extends string | number | VicarValue[]>(labels: VicarLabel[], name: string, defaultValue?: T): T {
    const label = labels.find(l => l.name === name);
    if (label === undefined && defaultValue === undefined) {
        throw new Error(`Could not find label ${name}`);
    }

    return (label?.value ?? defaultValue)! as T;
}
