import { Vector2, Raycaster, WebGLRenderer, Object3D, Camera, Ray, type Intersection } from 'three';
import { EventDispatcher, type HoneycombEvent } from '@gov.nasa.jpl.honeycomb/event-dispatcher';
import { Debouncer, MOUSE_EVENT_PRIORITY } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import { isClickableObject, isExplicitlyClickable, isPsuedoObject } from '@gov.nasa.jpl.honeycomb/core';

const mouseEnterEvent: HoneycombEvent = { type: 'mouse-enter' };
const mouseMoveEvent: HoneycombEvent = { type: 'mouse-move' };
const mouseExitEvent: HoneycombEvent = { type: 'mouse-exit' };
const mouseUpEvent: HoneycombEvent = { type: 'mouse-up' };
const mouseDownEvent: HoneycombEvent = { type: 'mouse-down' };
const clickEvent: HoneycombEvent = { type: 'click' };
const keydownEvent: HoneycombEvent = { type: 'keydown' };
const keyupEvent: HoneycombEvent = { type: 'keyup' };
const eventHandledEvent: HoneycombEvent = { type: 'event-handled' };

const lockedEvent: HoneycombEvent = { type: 'locked' };
const unlockedEvent: HoneycombEvent = { type: 'unlocked' };

const tempArray: Intersection[] = [];

// TODO: we need to run the mouse move event lifecycle independent of mouse movement because the
// frame can render or camera can change and change objects without the mouse moving

// TODO: we can generate a list of events here.

/**
 * @typedef {Event} InteractionManagerEvent
 * @param {String} type
 * The event name.
 *
 * @param {Object3D|null} target
 * The current target the event is being dispatched on.
 *
 * @param {Object3D} originalTarget
 * The target that the raycast originally hit and event dispatched on.
 *
 * @param {Boolean} bubbling
 * Whether the event bubbles.
 *
 * @param {InteractionManager} interactionaManager
 * Reference to the interactionManager that dispatched the event.
 *
 * @param {Function} stopPropagation
 * Stop the bubbling of the event up the tree.
 *
 * @param {Object} hit
 * The raycast hit information returned from three.js' Raycaster
 *
 * @param {Event} mouseEvent
 * The original mouse event that trigged this event.
 */

/**
 * Class for managing and dispatching mouse events in a three.js scene. Events are dispatched up
 * the objects parents if relevant until "event.stopPropagation" is called. If an event is not
 * handled by any handler as the event bubbles then it is dispatched on the InteractionManager itself.
 *
 * @extends EventDispatcher
 *
 * @fires mouse-exit
 * Fired whenever the points leaves an object.
 *
 * @fires mouse-up
 * Fired whenever a mouse up event occurs.
 *
 * @fires mouse-down
 * Fired whenever a mouse down event occurs.
 *
 * @fires click
 * Fired whenever the pointer is clicked.
 *
 * @fires key-down
 * Fired whenever a keydown event occurs.
 *
 * @fires key-up
 * Fired whenever a keyup event occurs.
 *
 * @fires locked
 * Fired whenever the InteractionManager is locked using {@link #InteractionManager#lock lock}.
 *
 * @fires unlocked
 * Fired whenever the InteractionManager is unlocked using {@link #InteractionManager#unlock unlock}.
 *
 * @fires event-handled
 * Fired whenever stopPropagation is called to denote the event has been handled by a handler.
 */
class InteractionManager extends EventDispatcher {
    /**
     * Whether the manager is watching and dispatching events.
     */
    enabled: boolean = true;

    /**
     * The camera used to perform raycasts
     * @member {Camera}
     * @default null
     */
    camera?: Camera;

    /**
     * The list of objects to raycast against when mouse events are
     * dispatched. This must be populated manually.
     */
    private objects = new Set<Object3D>();

    raycaster: Raycaster;
    ray: Ray;
    normalizeMousePos: Vector2;
    mousePos: Vector2;
    mouseButton: number;
    metaCtrlOrShiftKeyDown: boolean;
    lastHit: Intersection | null;
    domElement: HTMLCanvasElement;

    private _lock: any | null;
    private _hoveredObject: Object3D | null;
    private _eventHandled: boolean;

    /**
     * Takes the renderer with associated canvas that interaction event should
     * be listed for on.
     */
    constructor(renderer: WebGLRenderer) {
        super();

        this.raycaster = new Raycaster();
        this.raycaster.params.Line2 = { threshold: 2 };
        this.ray = this.raycaster.ray;
        this.normalizeMousePos = new Vector2();
        this.mousePos = new Vector2();
        this.mouseButton = 0;
        this.metaCtrlOrShiftKeyDown = false;
        this.lastHit = null;

        const domElement = renderer.domElement;
        this.domElement = domElement;

        this._lock = null;
        this._hoveredObject = null;
        this._eventHandled = false;

        // mouse events can get fired multiple times per frame render so make sure
        // we only raycast and update as much as we need to here.
        const debouncer = new Debouncer();
        const mouseDownPos = new Vector2();
        const events: PointerEvent[] = [];

        const flushEvents = () => {
            const lastEvent = events[events.length - 1];
            this._updateMousePos(lastEvent);
            this._updateLastHit();
            this._onMouseMove(lastEvent);

            for (let i = 0, l = events.length; i < l; i++) {
                const e = events[i];
                switch (e.type) {
                    case 'pointerdown': {
                        mouseDownPos.copy(this.mousePos);
                        this.mouseButton = e.button;

                        const hit = this.lastHit || null;
                        const object = hit ? hit.object : null;
                        this._dispatchBubblingEvent(object, { ...mouseDownEvent, mouseEvent: e, hit });
                        break;
                    }

                    case 'pointerup': {
                        const hit = this.lastHit || null;
                        const object = hit ? hit.object : null;
                        this._dispatchBubblingEvent(object, { ...mouseUpEvent, hit, mouseEvent: e });

                        // Only trigger a click if the mouse has moved less than 2 pixels from
                        // where it was pressed.
                        const dist = mouseDownPos.distanceTo(this.mousePos);
                        if (dist < 2) {
                            this._onClick(e);
                        }
                        break;
                    }
                }
            }

            events.length = 0;
        };

        const callback = (e: PointerEvent) => {
            events.push(e);
            debouncer.run('flush-mouse-events', flushEvents, MOUSE_EVENT_PRIORITY);
        };

        domElement.addEventListener('pointermove', callback);
        domElement.addEventListener('pointerdown', callback);
        domElement.addEventListener('pointerup', callback);

        // need to set canvas' tabindex attribute to 0
        // in order for it to capture keyboard presses
        domElement.setAttribute('tabindex', "0");
        domElement.addEventListener('keydown', (e) => {
            // for now always send keydown event to viewer
            keydownEvent.keyEvent = e;
            this.metaCtrlOrShiftKeyDown = e.ctrlKey || e.metaKey || e.shiftKey;
            this.dispatchEvent(keydownEvent);
        });
        domElement.addEventListener('keyup', (e) => {
            // for now always send keyup event to viewer
            keyupEvent.keyEvent = e;
            this.metaCtrlOrShiftKeyDown = e.ctrlKey || e.metaKey || e.shiftKey;
            this.dispatchEvent(keyupEvent);
        });

        // make sure handleEvent is bound to this always
        this.handleEvent = this.handleEvent.bind(this);
    }

    /**
     * Returns the object currently tracked lock on the manager indicating that a specific object
     * has control over interactions.
     * @returns {any}
     */
    getLock(): any {
        return this._lock;
    }

    /**
     * Sets the interaction manager lock and dispatches a `locked` event if a lock was not already set.
     * Returns `true` if the lock was set, false otherwise.
     */
    lock(key: any): boolean {
        if (this._lock === key || this._lock === null) {
            this._lock = key;
            this.dispatchEvent(lockedEvent);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Unlocks the interaction manager if the given object is currently being used to lock
     * interactions. Dispatches an `unlocked` event if the lock was successfully unlocked.
     * Returns true if the manager was unlocked, false otherwise.
     */
    unlock(key: any): boolean {
        if (this._lock === null) {
            console.warn(
                'InteractionManager: trying to unlock when InteractionManager was not locked in the first place',
            );

            return true;
        }

        if (this._lock === key) {
            this._lock = null;
            this.dispatchEvent(unlockedEvent);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Triggers that an event was handed and prevents it from bubbling up
     * the object tree any further. Dispatches and `event-handled` event.
     * @return {void}
     */
    handleEvent(): void {
        this._eventHandled = true;
        this.dispatchEvent(eventHandledEvent);
    }

    /**
     * Returns the first object that was hit by the ray from the given list of
     * object using the last mouse position.
     */
    getIntersection(objects: Object3D | Object3D[], recursive: boolean = true): Intersection<Object3D> | null {
        if (!Array.isArray(objects)) {
            objects = [objects];
        }

        return this._getClosestHit(objects, true, recursive);
    }

    /**
     * Returns the hit results that were found by the ray from the given list of
     * object using the last mouse position.
     */
    getIntersections(objects: Object3D[] | Object3D, recursive = true): Intersection<Object3D>[] | null {
        if (!Array.isArray(objects)) {
            objects = [objects];
        }

        return this._getHits(objects, true, recursive);
    }

    private _dispatchBubblingEvent(target: Object3D | null, event: HoneycombEvent) {
        event.originalTarget = target;
        event.bubbling = true;
        event.interactionManager = this;
        event.stopPropagation = this.handleEvent;

        this._eventHandled = false;

        let curr = target;
        while (curr && !this._eventHandled && !this.getLock()) {
            curr.dispatchEvent(event as any);
            curr = curr.parent;
        }

        if (!this._eventHandled) {
            event.target = null;
            this.dispatchEvent(event);
        }
    }

    private _updateMousePos(e: PointerEvent) {
        const domElement = this.domElement;
        const mousePos = this.mousePos;
        const normalizeMousePos = this.normalizeMousePos;
        const raycaster = this.raycaster;
        const camera = this.camera;

        if (!camera) {
            return;
        }

        const clientRect = domElement.getBoundingClientRect();

        mousePos.x = e.clientX - clientRect.x;
        mousePos.y = e.clientY - clientRect.y;

        normalizeMousePos.x = (mousePos.x / domElement.clientWidth) * 2 - 1;
        normalizeMousePos.y = -(mousePos.y / domElement.clientHeight) * 2 + 1;

        raycaster.setFromCamera(normalizeMousePos, camera);
    }

    private _updateLastHit() {
        this.lastHit = this._getClosestHit();
    }

    private _onMouseMove(mouseEvent: PointerEvent) {
        const hit = this.lastHit;
        const obj = hit ? hit.object : null;

        if (obj) {
            if (this._hoveredObject !== obj) {
                if (this._hoveredObject) {
                    this._dispatchBubblingEvent(this._hoveredObject, {
                        ...mouseExitEvent,
                        hit,
                        mouseEvent,
                    });
                }
                this._dispatchBubblingEvent(obj, { ...mouseEnterEvent, hit, mouseEvent });
                this._hoveredObject = obj;
            } else {
                this._dispatchBubblingEvent(obj, { ...mouseMoveEvent, hit, mouseEvent });
            }
        } else {
            if (this._hoveredObject) {
                this._dispatchBubblingEvent(this._hoveredObject, {
                    ...mouseExitEvent,
                    hit,
                    mouseEvent,
                });
            }
            this._hoveredObject = null;

            this._dispatchBubblingEvent(null, { ...mouseMoveEvent, hit, mouseEvent });
        }
    }

    private _onClick(mouseEvent: PointerEvent) {
        const hit = this.lastHit;
        const obj = hit ? hit.object : null;

        this._dispatchBubblingEvent(obj, { ...clickEvent, mouseEvent, hit });
    }

    private _getHits(
        overrideObjects?: Iterable<Object3D>,
        force: boolean = false,
        recursive: boolean = true,
        target: Intersection[] = []
    ) {
        const camera = this.camera;
        if ((force || this.enabled) && camera !== null) {
            const objects = overrideObjects || this.objects;
            const raycaster = this.raycaster;

            const visibleObjects: Object3D[] = [];
            for (const obj of objects) {
                getVisibleObjects(obj, visibleObjects, recursive);
            }

            target.length = 0;
            raycaster.intersectObjects(visibleObjects, false, target);
            return target.length > 0 ? target : null;
        } else {
            return null;
        }
    }

    private _getClosestHit(
        overrideObjects?: Iterable<Object3D>,
        force: boolean = false,
        recursive: boolean = true
    ) {
        const results = this._getHits(overrideObjects, force, recursive, tempArray);
        return results ? results[0] : null;
    }

    markInteractable(obj: Object3D) {
        this.objects.add(obj);
    }

    isInteractable(obj: Object3D) {
        return this.objects.has(obj);
    }

    unmarkInteractable(obj: Object3D) {
        this.objects.delete(obj);
    }
}

function getVisibleObjects(obj: Object3D, arr: Object3D[], recurse: boolean) {
    if (obj.visible || isExplicitlyClickable(obj)) {
        if (isClickableObject(obj)) {
            arr.push(obj);
        }

        if (recurse) {
            for (const child of obj.children) {
                if (!isPsuedoObject(child)) {
                    getVisibleObjects(child, arr, recurse);
                }
            }
        }
    }
}

export { InteractionManager };
