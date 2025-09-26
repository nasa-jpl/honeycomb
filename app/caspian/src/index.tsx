import * as Honeycomb from '@gov.nasa.jpl.honeycomb/core';
import * as Config from "./config";
import { registerCommonLoaders } from '@gov.nasa.jpl.honeycomb/extensions';
import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { MuiThemeProvider } from '@material-ui/core';
import { CaspianLandingPage } from './Components/LandingPage/CaspianLandingPage';
import { appTheme } from './theme';
import { getDefaultConfig } from './utils';
import { App } from './Components/App';
import { registerCaspianLoaders } from './loaders';

registerCommonLoaders();
registerCaspianLoaders();

const appContainer = document.getElementById('AppContainer');
let root = createRoot(appContainer);
document.title = 'Honeycomb';

function loadConfig(config, deferLoad) {
    root.unmount();
    root = createRoot(appContainer);
    document.title = config.title || 'Honeycomb';

    // create new viewer and cull models that haven't been used for 3 scene loads
    Honeycomb.Loaders.setCacheEnabled(true);
    Honeycomb.Loaders.textureCache.markUnused();
    Honeycomb.Loaders.objectCache.markUnused();

    root.render(<App config={config} deferLoad={deferLoad} />);
    Honeycomb.Loaders.textureCache.cullUnused(3);
    Honeycomb.Loaders.objectCache.cullUnused(3);
}

function buildAndLoadConfigFromSelectFiles(selectedFiles, deferLoad = false) {
    const defaultConfig = getDefaultConfig();
    const m2020Robot = {
        id: 'm2020',
        options: {
            fetchOptions: {
                credentials: 'include',
            },
            crossOrigin: 'use-credentials',
            withCredentials: true,
        },
    };
    defaultConfig.robots.push(m2020Robot);
    let sol = 0;
    const selectedTilesets = [];
    for (let i = 0, l = selectedFiles.length; i < l; i++) {
        const selectedFile = selectedFiles[i];
        const filename = selectedFile.name;
        const fileExtension = filename.split('.').pop();
        if (fileExtension === 'json') {
            selectedTilesets.push(selectedFile.permalink);
        }
    }

    if (sol !== 0) {
        const paddedSol = sol.toString().padStart(5, '0');
        defaultConfig.telemetry.push({
            id: 'enav_imgs',
            type: 'm20-enav-imgs',
            path: `\\/ods\\/surface\\/sol\\/${paddedSol}\\/ro\\/dl\\/mob\\/stereo`,
            options: {
                sol: sol,
                fetchOptions: {
                    credentials: 'include',
                },
            },
        });
        defaultConfig.images = [
            {
                animator: 'enav_imgs',
            },
        ];
    }

    if (selectedTilesets.length > 0) {
        defaultConfig.drivers.push({
            type: 'TilesRendererDriver',
            options: {
                path: selectedTilesets,
                fetchOptions: {
                    credentials: 'include',
                },
            },
        });
    }

    loadConfig(defaultConfig, deferLoad);
}

function renderMalformedURLPage() {
    const landingPage = (
        <MuiThemeProvider theme={appTheme}>
            <CaspianLandingPage malformedURL={true} />
        </MuiThemeProvider>
    );
    root.render(landingPage);
}

function reloadPage() {
    // first check if there's a config defined after hash and load if it exists
    // then check if there's a config defined by searchParams of URL and load if it exists
    // then check if there's selected files defined by searchParams of URL and load if it exists
    // then check if a config path has been specified globally outside the application
    // then check if a config has been specified globally outside the application

    const configPath = window.location.hash.replace(/^#/, '');
    const selectedFilesParams = new URL(window.location.href).searchParams.getAll('selectedFiles');

    if (configPath !== '') {
        Config.load(configPath).then(config => {
            loadConfig(config, true);
        });
    } else if (selectedFilesParams && selectedFilesParams.length > 0) {
        loadConfigFromSearchParams(selectedFilesParams);
    } else if ((window as any).HONEYCOMB_APP_CONFIG_PATH) {
        Config.load((window as any).HONEYCOMB_APP_CONFIG_PATH).then(config => {
            loadConfig(config, true);
        });
    } else if ((window as any).HONEYCOMB_APP_CONFIG) {
        loadConfig((window as any).HONEYCOMB_APP_CONFIG, true);
    } else {
        const landingPage = (
            <MuiThemeProvider theme={appTheme}>
                <CaspianLandingPage malformedURL={false} />
            </MuiThemeProvider>
        );
        root.render(landingPage);
    }
}

reloadPage();
window.addEventListener('popstate', event => {
    reloadPage();
});

export { buildAndLoadConfigFromSelectFiles };
