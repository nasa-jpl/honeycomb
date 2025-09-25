import { EventDispatcher } from '@gov.nasa.jpl.honeycomb/event-dispatcher';

function validateTag(tag: string) {
    if (isExpression(tag)) {
        throw new Error(`Tag '${tag}' is not valid.`);
    }
}

function isExpression(expression: string) {
    return /[&|()!=<>~\s\n\r]/.test(expression);
}

/**
 * Prebuilds the expression evaluation function to use with the {@link #TagTracker#getObjects getObjects} function.
 * This can be faster than building the function on the fly.
 *
 * @param {String} expression
 * @returns {Function}
 */
function compileExpression<T extends (...args: any[]) => boolean>(expression: string): T {
    const exp = expression.replace(/[^&|()!=<>~\s]+/g, tag => `set.has('${tag}')`);
    const body = `return ${exp};`;
    return new Function('set', body) as T;
}

// TODO: This will keep a handle to the objects indefinitely unless all
// tags are explicitly removed. Provide an API for removing the object
// explicitly or do something like register for a dispose event, which would
// mean relying on THREE.js behavior.

/**
 * Class for adding, tracking, and querying sets of tags on objects.
 * @extends EventDispatcher
 */
class TagTracker<T = any> extends EventDispatcher {
    _objectsToTags = new Map<T, Set<string>>();
    _tagToObjects: { [name: string]: Set<any> };

    constructor() {
        super();
        this._tagToObjects = {};
    }

    /**
     * Associates a tag or set of tags with an object.
     *
     * Returns true for a tag if it was added successfully or false if the tag was already
     * associated with an object.
     *
     * !> Tags cannot contain character that may be included in an expression or white, including !,
     * &, <, >, |, =, or ~.
     */
    addTag(obj: T, tag: string | string[]): boolean {
        if (Array.isArray(tag)) {
            const res: boolean[] = [];
            for (let i = 0, l = tag.length; i < l; i++) {
                res.push(this.addTag(obj, tag[i]));
            }
            return !res.includes(false);
        }

        tag = tag.toString();
        const o2t = this._objectsToTags;
        const t2o = this._tagToObjects;

        validateTag(tag);

        if (!o2t.has(obj)) {
            o2t.set(obj, new Set<string>());
        }

        if (!(tag in t2o)) {
            t2o[tag] = new Set();
        }

        const objSet = t2o[tag];
        if (objSet.has(obj)) {
            return false;
        } else {
            const tagSet = o2t.get(obj)!;
            objSet.add(obj);
            tagSet.add(tag);
            this.dispatchEvent({ type: 'add-tag', tag, object: obj });
            return true;
        }
    }

    /**
     * Removes a tag or st of tags from an object.
     *
     * Returns true for a tag if it was removed successfully or false if the tag wasn't already associated with an object.
     */
    removeTag(obj: T, tag: string | string[]): boolean {
        if (Array.isArray(tag)) {
            const res: boolean[] = [];
            for (let i = 0, l = tag.length; i < l; i++) {
                res.push(this.removeTag(obj, tag[i]));
            }
            return !res.includes(false);
        }

        tag = tag.toString();
        const o2t = this._objectsToTags;
        const t2o = this._tagToObjects;

        validateTag(tag);

        if (!o2t.has(obj)) {
            return false;
        }

        if (!(tag in t2o)) {
            return false;
        }

        const objSet = t2o[tag];
        const tagSet = o2t.get(obj)!;
        objSet.delete(obj);
        tagSet.delete(tag);

        if (objSet.size === 0) {
            delete t2o[tag];
        }

        if (tagSet.size === 0) {
            o2t.delete(obj);
        }

        this.dispatchEvent({ type: 'remove-tag', tag, object: obj });
        return true;
    }

    /**
     * Returns true if the object has the given tag.
     */
    hasTag(obj: T, tag: string): boolean {
        const t2o = this._tagToObjects;
        const objSet = t2o[tag];
        return !!(objSet && objSet.has(obj));
    }

    /**
     * Filters the given tree of objects to a flattened list of objects if
     * `flatten` is true. `obj` is expected to have an array of `children` on
     * it if `flatten` is true.
     *
     * Returns the filtered result.
     */
    filter<T>(obj: T | T[], tagOrExp: string | ((tag: Set<string>) => boolean), flatten: boolean = false): T[] {
        const isFunc = typeof tagOrExp === 'function';
        const func = isFunc ? tagOrExp : compileExpression<(tag: Set<string>) => boolean>(tagOrExp);
        const result: T[] = [];

        const emptySet = new Set<string>();
        const objectsToTags = this._objectsToTags;
        const doFilter = (o: T) => {
            const tagSet = objectsToTags.get(o as any) || emptySet;
            if (func(tagSet)) {
                result.push(o);
                if (flatten && (o as any).children) {
                    const children = (o as any).children;
                    for (let i = 0, l = children.length; i < l; i++) {
                        doFilter(children[i]);
                    }
                }
            }
        };

        if (Array.isArray(obj)) {
            obj.forEach(o => doFilter(o as T));
        } else {
            doFilter(obj);
        }

        return result;
    }

    /**
     * Returns the set of objects that matches the given tag or expression. An expression may be a string
     * or {@link #compileExpression pre-compoiled expression function}. For example:
     *
     * ```js
     * tracker.getObjects('tag-a && tag-b && !tag-c || tag-d');
     * ```
     *
     * If the expression is `null` then all objects are returned.
     *
     * @param {String|Function} tagOrExp
     * @returns {Array<Object3D>|null}
     */
    getObjects(tagOrExp?: string | ((tag: Set<string>) => boolean)): T[] | null {
        const o2t = this._objectsToTags;
        const t2o = this._tagToObjects;

        const isFunc = typeof tagOrExp === 'function';
        if (tagOrExp && (isFunc || isExpression(tagOrExp))) {
            const func = isFunc ? tagOrExp : compileExpression(tagOrExp);
            const arr: T[] = [];

            o2t.forEach((tagSet, obj) => {
                if (func(tagSet)) {
                    arr.push(obj as T);
                }
            });

            return arr.length ? arr : null;
        } else if (typeof tagOrExp === 'string') {
            const objSet = t2o[tagOrExp];
            const arr = objSet && Array.from(objSet.values());
            return arr || null;
        } else {
            const allObjects = new Set<T>();
            for (const key in t2o) {
                const objSet = t2o[key];
                objSet.forEach(obj => allObjects.add(obj));
            }
            return allObjects.size !== 0 ? Array.from(allObjects.values()) : null;
        }
    }

    /**
     * Returns the set of tags associated with an object. Returns null if there are no tags.
     */
    getTags(obj: T): string[] | null {
        const o2t = this._objectsToTags;

        const tagSet = o2t.get(obj as any);
        const arr = tagSet && Array.from(tagSet.values());
        return arr || null;
    }

    /**
     * Remove an object an all associated tags from the tracker.
     */
    removeObject(obj: T) {
        const tags = this.getTags(obj);
        // tags could've been null
        if (tags !== null) {
            for (let i = 0, l = tags.length; i < l; i++) {
                this.removeTag(obj as any, tags[i]);
            }
        }
    }

    /**
     * Returns an array of all currently tracked tag names
     */
    getAllTags(): string[] {
        return Object.keys(this._tagToObjects);
    }
}

export { TagTracker, compileExpression };
