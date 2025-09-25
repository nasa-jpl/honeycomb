import { LoadingManager } from 'three';
import { EventCallback, EventDispatcher, HoneycombEvent, IEventDispatcher } from '@gov.nasa.jpl.honeycomb/event-dispatcher';

export type UrlModifier = (url: string) => string;

// Subclass of three.js LoadingManager that will propagate load events
// up to other managers.
export class SubLoadingManager extends LoadingManager implements IEventDispatcher {
    _eventDispatcher: EventDispatcher;
    loadCompletions: number;
    total: number;
    loaded: number;

    urlModifier?: UrlModifier;

    constructor(
        readonly manager?: SubLoadingManager,
        onLoad?: () => void,
        onProgress?: (url: string, loaded: number, total: number) => void,
        onError?: (url: string) => void
    ) {
        super(onLoad, onProgress, onError);

        this._eventDispatcher = new EventDispatcher();

        this.loadCompletions = 0;
        this.total = 0;
        this.loaded = 0;

        // functions are overriden here because LoadingManager sets
        // functions explicitly in the function call, overwriting the
        // class functions that would be defined.
        const _itemStart = this.itemStart;
        const _itemEnd = this.itemEnd;
        const _itemError = this.itemError;
        const _getHandler = this.getHandler;

        this.itemStart = function (url) {
            if (this.total === this.loaded) {
                this._eventDispatcher.dispatchEvent({ type: 'start' });
            }

            this.total++;
            this._eventDispatcher.dispatchEvent({
                type: 'progress',
                total: this.total,
                loaded: this.loaded,
                url,
            });

            if (manager) {
                manager.itemStart(url);
            }
            _itemStart.call(this, url);
        };

        this.itemEnd = function (url) {
            this.loaded++;

            this._eventDispatcher.dispatchEvent({
                type: 'progress',
                total: this.total,
                loaded: this.loaded,
                url,
            });
            if (this.total === this.loaded) {
                this._eventDispatcher.dispatchEvent({ type: 'complete' });
                this.loadCompletions++;
            }

            _itemEnd.call(this, url);
            if (manager) {
                manager.itemEnd(url);
            }
        };

        this.itemError = function (url, error?: any) {
            if (!(error instanceof Error)) {
                error = new Error(`LoadingManager: Error loading "${url}"`);
            }

            _itemError.call(this, url);

            this.loaded++;
            this._eventDispatcher.dispatchEvent({ type: 'error', url, error });
            if (manager) {
                (manager.itemError as any)(url, error);
            }
        };

        this.getHandler = function (file) {
            const handler = _getHandler.call(this, file);
            if (handler) {
                return handler;
            } else if (manager) {
                return manager.getHandler(file);
            }
            return null;
        };

        this.setURLModifier = function (callback) {
            if (this.urlModifier) {
                throw new Error("URL modifier already set");
            }

            this.urlModifier = callback;
            return this;
        };

        this.resolveURL = function resolveURL(url: string): string {
            if (this.urlModifier) {
                return this.urlModifier(url);
            }

            // Use the parent managers url modifer if this one has not been set.
            if (this.manager) {
                return this.manager.resolveURL(url);
            }

            return url;
        };
    }

    hasEventListener(type: string, listener: EventCallback): boolean {
        return this._eventDispatcher.hasEventListener(type, listener);
    }

    dispatchEvent(event: HoneycombEvent): void {
        this._eventDispatcher.dispatchEvent(event);
    }

    addEventListener(type: string, listener: EventCallback) {
        this._eventDispatcher.addEventListener(type, listener);
    }

    removeEventListener(type: string, listener: EventCallback) {
        this._eventDispatcher.removeEventListener(type, listener);
    }
}
