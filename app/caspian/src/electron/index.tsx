import * as Honeycomb from '@gov.nasa.jpl.honeycomb/core';
import { registerCommonLoaders } from '@gov.nasa.jpl.honeycomb/extensions';
import 'regenerator-runtime/runtime';
import { ipcRenderer } from 'electron';
import path from 'path';
import { FocusCamViewerMixin, ViewCubeViewerMixin, TightShadowViewerMixin } from '@gov.nasa.jpl.honeycomb/scene-viewers';
import { unmountComponentAtNode, render } from 'react-dom';
import { App } from '../Components/App';
import { WelcomePage } from '../Components/WelcomeScreen/WelcomePage';
import { MuiThemeProvider } from '@material-ui/core';

import { appTheme } from '../theme';
import { getDefaultConfig } from '../utils';
import * as Config from '../config';

const LOCAL_STORAGE_KEY = 'honeycomb-settings';
registerCommonLoaders();

const ViewerClass = ViewCubeViewerMixin(FocusCamViewerMixin(TightShadowViewerMixin(Honeycomb.Viewer)));
let currViewer = null;

// Init app
const appContainer = document.getElementById('AppContainer');
document.title = 'Honeycomb';

const appPath = ipcRenderer.sendSync('getAppPath', '');

// launch user selected config from menu
ipcRenderer.on('loadConfig', (event, filePath) => {
    loadConfig(filePath);
});

ipcRenderer.on('loadFilePaths', (event, filePaths) => {
    loadFilePaths(filePaths);
});

const groundTruthRegex = /.*hdsim.*\.rksml$/;

function loadConfig(filePath) {
    Config.load(filePath).then((config) => {
        applyConfig(config);
    });
}

function applyConfig(config) {
    document.title = config.title || 'Honeycomb';

    // TODO: unmountComponentAtNode is used in order to "cleanup" the current
    // react context. If this is actually needed it should be encapsulated
    // somewhere else.
    if (currViewer) currViewer.dispose();
    currViewer = new ViewerClass();
    unmountComponentAtNode(appContainer);

    // create new viewer and cull models that haven't been used for 3 scene loads
    Honeycomb.Loaders.setCacheEnabled(true);
    Honeycomb.Loaders.textureCache.markUnused();
    Honeycomb.Loaders.objectCache.markUnused();
    render(<App config={config} viewer={currViewer}/>, appContainer);
    Honeycomb.Loaders.textureCache.cullUnused(3);
    Honeycomb.Loaders.objectCache.cullUnused(3);
}

function loadFilePaths(filePaths) {
    if (filePaths) {
        const json = getDefaultConfig();
        const modelPath =
        process.env.NODE_ENV === 'development'
            ? path.resolve('../../assets/models/m2020/')
            : `${appPath}/../m2020/`;
        const m2020Robot = {
            id: 'm2020',
            path: `${modelPath}/m2020.urdf`,
            options: {
                packages: modelPath,
            },
        };
        json.robots.push(m2020Robot);

        let hasGroundTruth = false;
        for (let i = 0, l = filePaths.length; i < l; i++) {
            const filename = filePaths[i];
            hasGroundTruth = hasGroundTruth || groundTruthRegex.test(path.basename(filename));
        }

        if (hasGroundTruth) {
            const groundTruthRobot = JSON.parse(JSON.stringify(json.robots[0]));
            groundTruthRobot.id = 'm2020_ground_truth';
            json.robots.push(groundTruthRobot);

            const groundTruthDriver = JSON.parse(JSON.stringify(json.drivers[0]));
            groundTruthDriver.options.robot = groundTruthRobot.id;
            groundTruthDriver.options.telemetry = 'ground_truth';
            json.drivers.push(groundTruthDriver);

            if ( ! json.options.settings['Enav']) {
                json.options.settings['Enav'] = [];
            }
            json.options.settings['ENav'].push({
                label: 'Apply Ground Truth',
                tag: 'ground-truth',
                default: true,
            });
        }

        for (let i = 0, l = filePaths.length; i < l; i++) {
            const filePath = filePaths[i];
            const fileExtension = path.extname(filePath);
            if (fileExtension === '.pgm') {
                const zScaleRegex = /z-scale-(\d+\.*\d*)/;
                const zOffsetRegex = /z-offset-(-?\d+\.*\d*)/;
                const resRegex = /res-(\d+\.*\d*)/;

                const filePath = filePaths[i];
                let zScale = zScaleRegex.test(filePath) ? zScaleRegex.exec(filePath)[1] : 1;
                zScale = parseFloat(zScale);

                let zOffset = zOffsetRegex.test(filePath) ? zOffsetRegex.exec(filePath)[1] : 0;
                zOffset = parseFloat(zOffset);

                // res is in cm, convert to be in m
                let res = resRegex.test(filePath) ? resRegex.exec(filePath)[1] : 5;
                res *= 0.01;

                json.terrain.push({
                    id: 'pgm_terrain_' + json.terrain.length,
                    path: path.resolve(filePath),
                    options: {
                        cellWidth: res,
                        cellHeight: res,
                        zScale: zScale,
                        zOffset: zOffset,
                    },
                });
            } else if (
                fileExtension === '.gltf' ||
                fileExtension === '.glb' ||
                fileExtension === '.dae' ||
                fileExtension === '.stl' ||
                fileExtension === '.fbx' ||
                fileExtension === '.obj' ||
                fileExtension === '.mod'
            ) {
                json.terrain.push({
                    id: fileExtension + '_terrain_' + json.terrain.length,
                    path: path.resolve(filePaths[i]),
                });
            }
        }

        const prevSavedSettingsString = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        let savedSettings;
        if (prevSavedSettingsString) {
            savedSettings = JSON.parse(prevSavedSettingsString);
            if (savedSettings.kernelFile) {
                json.telemetry.push({
                    type: 'spice',
                    id: 'spice',
                    path: savedSettings.kernelFile,
                    options: {
                        baseTimeFormat: 'sclk',
                        spacecraft: 'M2020',
                        lmstFrame: -168900,
                        sunFrame: 'M2020_LOCAL_LEVEL',
                        sunObserverFrame: 'M2020',
                    },
                });
            }
        }

        applyConfig(json);
    }
}

const welcomePage = (
    <MuiThemeProvider theme={appTheme}>
        <WelcomePage />
    </MuiThemeProvider>
);

render(welcomePage, appContainer);

export { loadFilePaths };
