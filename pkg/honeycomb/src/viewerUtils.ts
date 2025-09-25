// Utility functions to register and unregister events for every child under
// the passed object. Registers an event if another child object is added and
// unregisters if one is removed.

import { Object3D } from "three";

const ADDED_SYMBOL = Symbol('added callback');
const REMOVED_SYMBOL = Symbol('removed callback');
export function recursivelyRegister(obj: Object3D, event: string, callback: () => void) {
    obj.children.forEach(c => recursivelyRegister(c, event, callback));

    obj.addEventListener(event as any, callback);

    (obj as any)[ADDED_SYMBOL] = (obj as any)[ADDED_SYMBOL] || {};
    (obj as any)[ADDED_SYMBOL][event] = (e: any) => {
        recursivelyRegister(e.child, event, callback);
    };
    (obj as any)[REMOVED_SYMBOL] = (obj as any)[REMOVED_SYMBOL] || {};
    (obj as any)[REMOVED_SYMBOL][event] = (e: any) => {
        recursivelyUnregister(e.child, event, callback);
    };
    obj.addEventListener('childadded', (obj as any)[ADDED_SYMBOL][event]);
    obj.addEventListener('childremoved', (obj as any)[REMOVED_SYMBOL][event]);
}

export function recursivelyUnregister(obj: Object3D, event: any, callback: () => void) {
    obj.children.forEach(c => recursivelyUnregister(c, event, callback));
    obj.removeEventListener(event, callback);
    obj.removeEventListener('childadded', (obj as any)[ADDED_SYMBOL][event]);
    obj.removeEventListener('childremoved', (obj as any)[REMOVED_SYMBOL][event]);
}
