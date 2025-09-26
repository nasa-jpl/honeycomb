import { BufferGeometry, Mesh, Vector3 } from 'three';
import { IconMenu } from './IconMenu';
import { Palette } from '@material-ui/icons';
import { ColorLabel } from './ColorLabel';

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { HoneycombBaseApp } from './BaseApp/HoneycombBaseApp';

const tempVec3 = new Vector3();
const tempVec3_2 = new Vector3();

export class App extends HoneycombBaseApp {
    constructor(props) {
        super(props);

        // Using three-mesh-bvh can help speed up terrain raycasts immensely for
        // large terrains. For example, on a terrain with 7.5M vertices and 15M faces,
        // normal raycasts took over 1100ms but the sped-up version took under 1ms.
        // Note that computeBoundsTree() must be called one time on the geometry prior
        // to any raycasts (not for each raycast), otherwise the normal three raycast 
        // function will be used. We are now calling computeBoundsTree() on loaded 
        // objects by default. Here are some typical timings on computeBoundsTree():
        // - .stl terrain with 7.5M vertices, 15M faces -- 6.8 seconds
        // - .obj terrain with 500K vertices, 996K faces -- 340ms
        // - small .stl mesh files for a rover -- all under 22ms
        // See also:
        // - honeycomb/modules/honeycomb/src/Loaders.ts
        // - useOptimizedRaycast option in ModelObject in 
        //   honeycomb/modules/honeycomb/src/scene.ts
        BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
        BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
        Mesh.prototype.raycast = acceleratedRaycast;

    }

    initializeViewer() {
        super.initializeViewer();

        const { viewer, config, containerElement, appProps } = this.state;
        const { terrainSettings } = appProps;

        viewer.controls.enableKeys = false;

        this.listeners.addEventListener(containerElement, 'keydown', e => {
            switch(e.key) {
                case 'ArrowUp':
                    {
                        const camera = viewer.getCamera();
                        tempVec3.set(0, 1, 0);
                        tempVec3_2.set(0, 0, 1);
                        // apply a very small rotation to avoid gimbal lock issues
                        tempVec3.applyAxisAngle(tempVec3_2, 0.0001);

                        tempVec3_2.copy(viewer.controls.target);
                        tempVec3.multiplyScalar(10);
                        tempVec3_2.add(tempVec3);
                        camera.position.copy(tempVec3_2);
                        camera.lookAt(viewer.controls.target);
                        viewer.dirty = true;
                    }
                    break;
                case 'T':
                    {
                        let terrainActivated = false;
                        terrainSettings.forEach(val => {
                            terrainActivated = terrainActivated || Boolean(val.value);
                        });
                        terrainSettings.forEach(val => {
                            val.onChange(null, !terrainActivated);
                        });
                        this.setState((prevState) => {
                            const prevToggleNotif = prevState.toggleNotif;
                            prevToggleNotif.message = `Terrain ${!terrainActivated ? 'ON' : 'OFF'}`;
                            prevToggleNotif.open = true;
                            if (prevToggleNotif.timeout) {
                                clearTimeout(prevToggleNotif.timeout);
                            }
                            prevToggleNotif.timeout = setTimeout(this.hideToggleNotification, 1000);
                            return { toggleNotif: prevToggleNotif };
                        });
                    }
                    break;
            }
        });

        const colorLegendMenu = (
            <IconMenu
                icon={<Palette />}
                title="Color Legend"
                container={containerElement}
                key="color-palette"
            >
                <ColorLabel color="#111111" label="No Issues" />
                <ColorLabel color="orange" label="Drove on Unknown" />
                <ColorLabel color="magenta" label="Min Clearance" />
                <ColorLabel color="blue" label="Max Wheel Drop" />
                <ColorLabel color="red" label="Max Local Tilt" />
                <ColorLabel color="darkred" label="Max Global Tilt" />
                <ColorLabel color="yellow" label="KIOZ Violated" />
                <ColorLabel color="darkcyan" label="Limit Cycle" />
                <ColorLabel color="lightgreen" label="Max N Ace Evals" />
                <ColorLabel color="cyan" label="Max Backtrack" />
                <ColorLabel color="gray" label="Floating Wheel" />
                <ColorLabel color="gray" label="Out of Bounds" />
                <ColorLabel color="green" label="Planefit Failed" />
            </IconMenu>
        );

        const showColorLegend = config.options.showColorLegend;
        const buttons = showColorLegend ? [colorLegendMenu] : null;

        this.setState(prevState => {
            return {
                appProps: {
                    ...prevState.appProps,
                    buttons,
                },
            };
        });
    }
}
