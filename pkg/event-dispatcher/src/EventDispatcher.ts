/**
 * https://github.com/mrdoob/eventdispatcher.js/
 */

import { type Disposable } from "@gov.nasa.jpl.honeycomb/common";

export type EventCallback = (v: any) => void;
export interface HoneycombEvent {
    type: string | any;
    target?: any;
    [name: string]: unknown;
}

export interface IEventSource {
    addEventListener(type: string, listener: EventCallback): void;
    removeEventListener(type: string, listener: EventCallback): void;
    hasEventListener(type: string, listener: EventCallback): boolean;
}

export interface IEventDispatcher extends IEventSource {
    dispatchEvent(event: HoneycombEvent): void;
}

export class EventDispatcher implements IEventDispatcher, Disposable {
    private _listeners: { [type: string]: Set<EventCallback> } = {};

    addEventListener(type: string, listener: EventCallback): Disposable {
        if (this._listeners === undefined) {
            this._listeners = {};
        }

        const listeners = this._listeners;
        if (listeners[type] === undefined) {
            listeners[type] = new Set();
        }

        listeners[type].add(listener);

        const disp = { dispose: () => this.removeEventListener(type, listener) };
        return disp;
    }

    hasEventListener(type: string, listener: EventCallback): boolean {
        if (this._listeners === undefined) {
            return false;
        }

        const listeners = this._listeners;
        return listeners[type] !== undefined && listeners[type].has(listener);
    }

    removeEventListener(type: string, listener: EventCallback) {
        if (this._listeners === undefined) {
            return;
        }

        const listeners = this._listeners;
        const listenerArray = listeners[type];

        if (listenerArray !== undefined) {
            listenerArray.delete(listener);
        }

    }

    dispatchEvent(event: HoneycombEvent) {
        if (this._listeners === undefined) {
            return;
        }

        const listeners = this._listeners;
        const listenerArray = listeners[event.type];

        if (listenerArray !== undefined) {
            event.target = this;
            listenerArray.forEach((v) => v(event));
        }
    }

    dispose() {
        this._listeners = {};
    }
}
