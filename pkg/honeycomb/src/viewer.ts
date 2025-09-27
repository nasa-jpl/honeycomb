import { Vector3, Object3D, Vector2, AmbientLight, Mesh, ShaderMaterial, Plane } from 'three';

import { Scheduler, Debouncer, RENDER_PRIORITY, MOUSE_EVENT_PRIORITY } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import { TagTracker } from '@gov.nasa.jpl.honeycomb/tag-tracker';
import { InteractionManager } from '@gov.nasa.jpl.honeycomb/interaction-manager';
import { Viewer } from '@gov.nasa.jpl.honeycomb/scene-viewers';
import { type StateBase } from '@gov.nasa.jpl.honeycomb/common';

import { recursivelyUnregister, recursivelyRegister } from './viewerUtils';
import { Driver } from './Driver';
import { AnimatedViewer } from './AnimatedViewer';
import { isRobot } from './utils';
import { SceneObjectPlacement } from './scene';

const tempVec3 = new Vector3();
const TAG_TOGGLE_LAYER = 0;

const up = new Vector3(0, 1, 0);
const basePlane = new Plane(up);

type Constructor = new (...args: any) => Viewer;
export function ViewerMixin<T extends StateBase, TBase extends Constructor>(base: TBase) {
    return class extends base {
        fixedCamera: boolean;
        dirty: boolean;
        focusTarget?: Object3D;

        meshes: Set<Mesh>;
        protected _debouncer: Debouncer;

        drivers: Record<string, Driver<Partial<T>>>;

        /**
         * Objects in the scene
         */
        objects: Record<string, Object3D>;

        tags: TagTracker<any>;
        disabledTags: Set<string>;
        interactionManager: InteractionManager;
        ambientLight: AmbientLight;

        uniformOverrides: Record<string, any>;

        constructor(...args: any) {
            super(...args);

            const interactionManager = new InteractionManager(this.renderer);
            const tagTracker = new TagTracker();
            const disabledTags = new Set<string>();

            this.fixedCamera = false;
            this.dirty = false;

            // Interaction Manager setup
            const controls = this.controls;
            const startPos = new Vector2();
            let controlsStarted = false;
            let metaCtrlOrShiftKeyDownOnStart = false;
            interactionManager.addEventListener('mouse-down', () => {
                startPos.copy(interactionManager.mousePos);
                controlsStarted = true;
                metaCtrlOrShiftKeyDownOnStart = interactionManager.metaCtrlOrShiftKeyDown;

                // TODO: there is no guarantee that this viewer is mixed with the FocusCamViewer
                // when right mouse button dragged
                if (interactionManager.mouseButton === 2 || (
                    interactionManager.mouseButton === 0 && metaCtrlOrShiftKeyDownOnStart
                )) {
                    this.fixedCamera = false;
                }
            });

            interactionManager.addEventListener('mouse-move', () => {
                // "Change" can get called when controls.update() is called so make sure
                // change is called after a user started drag.
                if (controlsStarted) {
                    const diff = startPos.distanceTo(interactionManager.mousePos);
                    if (diff > 3) {
                        interactionManager.lock(controls);
                    }
                }
            });

            // @ts-expect-error
            controls.addEventListener('fly-start', () => {
                this.fixedCamera = false;
            });

            interactionManager.addEventListener('mouse-up', () => {
                controlsStarted = false;
                if (interactionManager.getLock() === controls) {
                    // wait until all the other events have run and flushed before
                    // unlocking the controls lock.
                    Scheduler.schedule(() => {
                        interactionManager.unlock(controls);
                    }, MOUSE_EVENT_PRIORITY + 1);
                }
            });

            interactionManager.addEventListener('event-handled', () => {
                this.dirty = true;
            });

            interactionManager.addEventListener('locked', () => {
                controls.enabled = interactionManager.getLock() === controls;

                // effectively cancel the current drag action usnig "reset". Reset also
                // updates the position of the camera to these 0 positions, as well, so
                // copy the camera info over so it's a no op.
                if (!controls.enabled) {
                    controls.target0.copy(controls.target);
                    controls.position0.copy(controls.object.position);

                    // TODO(tumbar) FIX?
                    (controls as any).zoom0 = (controls as any).object.zoom;
                    controls.reset();
                }
                this.dirty = true;
            });

            interactionManager.addEventListener('unlocked', () => {
                controls.enabled = true;
                this.dirty = true;
            });

            // TODO: it's not guaranteed that this viewer is mixed in with the focus cam viewer
            interactionManager.addEventListener('keydown', e => {
                if (e.target.nodeName !== 'INPUT') { // ensure that we're not modifying the view state when navigating an input
                    if (e.keyEvent.key === 'r') {
                        let target = this.focusTarget ?? this.getRobots()[0];

                        if (this.fixedCamera && target) {
                            const allRobots = this.getRobots();

                            let focusTargetIndex = allRobots.indexOf(target);
                            focusTargetIndex++;
                            focusTargetIndex = focusTargetIndex % allRobots.length;
                            this.focusTarget = allRobots[focusTargetIndex];
                            target = this.focusTarget;

                            this.dirty = true;
                        }

                        if (!this.fixedCamera && target) {
                            // Transfer the focus back to the target
                            this.focusTarget = target;

                            this.fixedCamera = true;
                            this.dirty = true;
                        }
                    } else if (e.keyEvent.key === 'f') {
                        let hit;
                        const results = interactionManager.getIntersections(this.world, true);
                        if (results) {
                            for (let i = 0, l = results.length; i < l; i++) {
                                if (!((results[i].object as Mesh).material as ShaderMaterial).transparent) {
                                    hit = results[i];
                                    break;
                                }
                            }
                        }

                        this.fixedCamera = false;

                        if (hit) {
                            const newTarget = hit.point;

                            // store the difference in position in controls.target
                            controls.target.subVectors(newTarget, controls.target);

                            // move the camera by the difference and then focus the
                            // controls on the new target
                            this.getCamera().position.add(controls.target);
                            controls.target.copy(newTarget);
                        } else {
                            // No hit on an object, focus on the base place
                            this.interactionManager.raycaster.ray.intersectPlane(basePlane, tempVec3);
                            controls.target.subVectors(tempVec3, controls.target);
                            this.getCamera().position.add(controls.target);
                            controls.target.copy(tempVec3);
                        }

                        this.dirty = true;
                    } else if (e.keyEvent.key === 'ArrowUp') {
                        // "North-Up top down view"
                        // based on Honeycomb implementation originally at
                        // https://github.jpl.nasa.gov/Honeycomb/honeycomb/pull/1505
                        const camera = this.getCamera();
                        tempVec3.set(0, 1, 0);

                        const tempVec3_2 = new Vector3();
                        tempVec3_2.set(0, 0, 1);
                        // apply a very small rotation to avoid gimbal lock issues
                        tempVec3.applyAxisAngle(tempVec3_2, 0.0001);

                        // maintain current distance
                        const currentDistanceToTarget = (new Vector3().copy(controls.target).sub(camera.position)).length();
                        tempVec3_2.copy(controls.target);
                        tempVec3.multiplyScalar(currentDistanceToTarget);
                        tempVec3_2.add(tempVec3);
                        camera.position.copy(tempVec3_2);
                        camera.lookAt(controls.target);
                        this.dirty = true;
                    }
                }
            });

            // lights
            const world = this.world;
            const ambientLight = new AmbientLight(0xffffff, 0.2);
            world.add(ambientLight);

            this._debouncer = new Debouncer();
            this.drivers = {};
            this.objects = {};
            this.tags = tagTracker;
            this.disabledTags = disabledTags;
            this.interactionManager = interactionManager;
            this.ambientLight = ambientLight;
            this.meshes = new Set();

            // Implement uniform overrides that copy uniform data into
            // uniforms on the materials before render.
            const meshes = this.meshes;
            const allObjects: Object3D[] = [];
            const uniformOverrides = {
                resolution: {
                    value: this.resolution,
                },
            };
            this.uniformOverrides = uniformOverrides;

            this.addEventListener('added', e => {
                const child = e.child;
                if (child.isMesh) {
                    meshes.add(e.child);
                }

                allObjects.push(e.child);
            });

            this.addEventListener('removed', e => {
                const child = e.child;
                if (child.isMesh) {
                    meshes.delete(e.child);
                }

                allObjects.splice(allObjects.indexOf(e.child), 1);
            });

            this.addEventListener('before-render', () => {
                // need to set interaction manager's camera on before-render
                // because user could toggle between ortho and perspective cameras
                this.interactionManager.camera = this.getCamera();
            });

            const debounceRerunTags = () => {
                this._debounceRerunTags();
            };

            tagTracker.addEventListener('add-tag', e => {
                debounceRerunTags();

                if (e.object instanceof Object3D && tagTracker.getTags(e.object)?.length === 1) {
                    recursivelyRegister(e.object, 'childadded', debounceRerunTags);
                    recursivelyRegister(e.object, 'childremoved', debounceRerunTags);
                }
            });

            tagTracker.addEventListener('remove-tag', e => {
                const object = e.object;
                if (object instanceof Object3D) {
                    object.traverse(c => {
                        c.layers.enable(TAG_TOGGLE_LAYER);
                    });
                } else if (object instanceof Function) {
                    const func = object;
                    func(true);
                }
                if (e.object instanceof Object3D && tagTracker.getTags(e.object) === null) {
                    recursivelyUnregister(e.object, 'childadded', debounceRerunTags);
                    recursivelyUnregister(e.object, 'childremoved', debounceRerunTags);
                }
                debounceRerunTags();
            });
        }

        /**
         * Bare frames usually don't have models attached to them
         * They are tracked by
         * @param o 
         * @returns 
         */
        isFrame(o: Object3D): boolean {
            return this.tags.getTags(o)?.includes('frame') ?? false;
        }

        isDisabled(o: Object3D): boolean {
            for (const tag of this.tags.getTags(o) ?? []) {
                if (this.disabledTags.has(tag)) {
                    return true;
                }
            }

            return false;
        }

        beforeRender(delta: number) {
            this._debouncer.flushAll();
            super.beforeRender(delta);

            const { meshes, uniformOverrides } = this;
            function updateMaterial(mat: ShaderMaterial) {
                // set the uniforms
                if (mat && mat.uniforms) {
                    const uniforms = mat.uniforms;
                    for (const key in uniformOverrides) {
                        if (key in uniforms) {
                            const uniform = uniforms[key];
                            const overrideUniform = uniformOverrides[key];
                            if (
                                uniform.value.constructor ===
                                overrideUniform.value.constructor
                            ) {
                                uniform.value.copy(overrideUniform.value);
                            }
                        }
                    }
                }
            }

            meshes.forEach(m => {
                const material = m.material;
                if (Array.isArray(material)) {
                    for (let i = 0, l = material.length; i < l; i++) {
                        updateMaterial(material[i] as ShaderMaterial);
                    }
                } else {
                    updateMaterial(material as ShaderMaterial);
                }
            });
        }

        removeObject(name: string, emit = true) {
            const obj = this.objects[name];
            if (!obj) {
                return;
            }

            const tags = this.tags.getTags(obj);

            if (tags) {
                this.tags.removeTag(obj, tags);
            }

            delete this.objects[name];

            if (obj.parent) {
                obj.removeFromParent();
            }

            this.dirty = true;

            if (emit) {
                this.dispatchEvent({ 'type': 'remove-object', object: obj, id: name });
            }
        }

        renameObject(obj: Object3D, name: string, emit = true) {
            delete this.objects[obj.name];
            obj.name = name;
            this.objects[obj.name] = obj;
            if (emit) {
                this.dispatchEvent({ type: 'rename-object', object: obj });
            }
        }

        // FIXME(tumbar) We should not have the viewer directly manage these
        addObject(obj: Object3D, placement: SceneObjectPlacement) {
            if (this.objects[obj.name] === obj) {
                return this.moveObject(obj, placement);
            }

            if (this.objects[obj.name]) {
                this.removeObject(obj.name);
            }

            this.moveObject(obj, placement, false);
            this.dispatchEvent({ type: 'add-object', object: obj });
        }

        // TODO: _emit isn't being used right now -- either remove it or use it...
        moveObject(obj: Object3D, placement?: SceneObjectPlacement, _emit = true) {
            this.objects[obj.name] = obj;

            if (placement?.pose?.position) {
                const p = placement.pose.position;
                obj.position.set(p[0], p[1], p[2]);
            }

            if (placement?.pose?.orientation) {
                const q = placement.pose.orientation;
                obj.quaternion.set(q[0], q[1], q[2], q[3]);
            }

            // Add the object to the scene
            const frame = placement?.frame ? Array.isArray(placement.frame) ? placement.frame : [placement.frame] : [];
            let parent: Object3D = this.world;

            for (const key of frame) {
                const found = parent.children.find(v => v.name === key);
                if (!found) {
                    throw new Error(`Failed to add ${obj.name} to frame '${frame}': ${key} is not a child of ${parent.name}`);
                }

                parent = found;
            }

            obj.removeFromParent();
            obj.updateMatrixWorld();
            parent.add(obj);

            this.dirty = true;
        }

        getRobots(): Object3D[] {
            return Object.values(this.objects).filter((obj) => isRobot(obj));
        }

        getRobot(id: string): Object3D | undefined {
            const robots = this.getRobots();
            return robots.find(obj => obj.name === id);
        }

        has(object: Object3D) {
            return new Set(Object.values(this.objects)).has(object);
        }

        // Driver Accessors
        addDriver<P extends Partial<T>>(driver: Driver<P>, id: string) {
            if (this.getDriver(id)) {
                this.removeDriver(id);
            }

            this.drivers[id] = driver;
            this.updateOrderedDrivers();
            driver.viewer = this as unknown as AnimatedViewer;
            driver.id = id;

            try {
                driver.initialize();
            } catch (e) {
                this.dispatchEvent({
                    type: 'error',
                    error: e,
                    source: driver,
                });
            }
        }

        // To be overrided by parent mixins
        updateOrderedDrivers() { }

        getDriver<P extends Partial<T>>(id: string) {
            return this.drivers[id] as Driver<P>;
        }

        removeDriver<P extends Partial<T>>(id: string): Driver<P> {
            const driver = this.getDriver(id);
            delete this.drivers[id];

            driver.dispose();
            driver.viewer = undefined;
            return driver as Driver<P>;
        }

        stop() { }

        dispose() {
            this.interactionManager.dispose();
            this.tags.dispose();

            this.stop();

            const drivers = this.drivers;
            for (const key in drivers) {
                this.removeDriver(key);
            }

            this.renderer.dispose();
            super.dispose();
        }

        toggle(tag: string, enabled: boolean) {
            const disabledTags = this.disabledTags;
            if (enabled === !disabledTags.has(tag)) {
                return;
            }

            if (!enabled) {
                disabledTags.add(tag);
            }
            else {
                disabledTags.delete(tag);
            }

            this.dispatchEvent({ type: 'toggle-tag', tag, enabled: !!enabled });
            this._debounceRerunTags();
        }

        /* Private Functions */
        private _debounceRerunTags() {
            this._debouncer.run('rerun-tags', () => this._rerunTags(), RENDER_PRIORITY - 1);
        }

        private _rerunTags() {
            const tags = this.tags;
            const disabledTags = this.disabledTags;
            let expr = '';
            disabledTags.forEach((tag) => {
                if (expr !== '') {
                    expr += '||';
                }

                expr += `(${tag})`;
            });

            // reenable all objects
            const allObjects = tags.getObjects();
            if (allObjects) {
                allObjects.forEach(obj => {
                    if (obj instanceof Object3D) {
                        obj.traverse(c => {
                            c.layers.enable(TAG_TOGGLE_LAYER);
                        });
                    } else if (obj instanceof Function) {
                        obj(true);
                    }
                });
            }

            // disable the ones that match the expression
            const objects = tags.getObjects(expr);
            if (objects) {
                objects.forEach(obj => {
                    if (obj instanceof Object3D) {
                        obj.traverse(c => {
                            c.layers.disable(TAG_TOGGLE_LAYER);
                        });
                    } else if (obj instanceof Function) {
                        obj(false);
                    }
                });
            }

            this.dirty = true;
        }
    };
}
