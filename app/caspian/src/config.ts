import { convertStandardMaterialToPhong } from '@gov.nasa.jpl.honeycomb/core/src/utils';
import { loadTelemetryAnimator, loadModel, createDriver } from '@gov.nasa.jpl.honeycomb/core/src/Loaders';
import path from 'path';
import mergeWith from 'lodash.mergewith';
import { DefaultLoadingManager, Color, Group, MathUtils } from 'three';
import { SubLoadingManager } from '@gov.nasa.jpl.honeycomb/core/src/SubLoadingManager';


function resolvePath(basePath, p) {
    const rootRegex = /^[/\\]/;
    const protocolRegex = /^[a-zA-Z]+:[/\\]{2}/;
    const dataRegex = /^data:/;
    const blobRegex = /^blob:/;

    // trying to match URLs:
    // https://data.(tb or dev or sops).m20.jpl.nasa.gov
    const ocsRegex = /data.[a-zA-Z-]+.m20.jpl.nasa.gov/;

    const isRoot = rootRegex.test(p);
    const hasProtocol = protocolRegex.test(p);
    const isDataURL = dataRegex.test(p);
    const isBlobURL = blobRegex.test(p);

    const isBaseProtocol = protocolRegex.test(basePath);
    const isOCSURL = ocsRegex.test(basePath);

    // edge case specific for OCS
    if (isBaseProtocol && isRoot && isOCSURL) {
        const baseOCSProtocolPath = /^[a-zA-Z]+:[/\\]{2}[a-zA-Z.0-9]+\/[a-zA-z\-0-9]+/;
        const baseOCSPath = baseOCSProtocolPath.exec(basePath)[0];
        const res = baseOCSPath + p;
        return res.replace(/\\/g, '/');
    }

    let res;
    if (isRoot || hasProtocol) {
        res = p;
    } else if (isDataURL || isBlobURL) {
        return p;
    } else {
        // check if the base path has an end slash before appending
        if (/[\\/]$/.test(basePath)) {
            res = basePath;
        } else {
            res = basePath + '/';
        }
        res += p;
    }

    res = res
        .replace(/\\/g, '/')        // replace forward slashes
        .replace(/\/\.\//g, '/')    // replace /./
        .replace(/^\.\//, '');       // replace ./

    // clean up '../'
    const finalHasProtocol = protocolRegex.test(res);
    const finalIsRoot = rootRegex.test(res);
    let prefix = '';
    let remaining = res;
    if (finalHasProtocol) {
        prefix = `${remaining.split('//')[0]}//`;
        remaining = remaining.replace(protocolRegex, '');
    }

    const splits = remaining.split(/\//g);
    if (finalHasProtocol || finalIsRoot) {
        prefix += splits.shift() + '/';
    }

    const finalPath = [];
    for (let i = 0; i < splits.length; i++) {
        const token = splits[i];
        if (token === '..') {
            const lastToken = finalPath[finalPath.length - 1];
            if ((finalPath.length || finalIsRoot || finalHasProtocol) && lastToken !== '..') {
                finalPath.pop();
            } else {
                finalPath.push(token);
            }
        } else {
            finalPath.push(token);
        }
    }

    return prefix + finalPath.join('/').replace(/\/{1,}/g, '/');
}


const CONFIG_LINEAGE = Symbol('CONFIG_LINEAGE');

function mergeConfig(...objects) {
    const target = {};
    mergeWith(target, ...objects, (objValue, srcValue, key) => {
        if (Array.isArray(objValue) && Array.isArray(srcValue)) {
            return [...objValue, ...srcValue];
        } else if (objValue && srcValue && Array.isArray(objValue) !== Array.isArray(srcValue)) {
            console.warn(`Config: Array type mismatch when merging key "${key}"`);
        }
    });
    return target;
}

function applyConfigToViewer(config, viewer, loadingManager = DefaultLoadingManager) {
    const lineage = config[CONFIG_LINEAGE] || [config];
    lineage[0] = clean(lineage[0]);

    // create a separate manager so we can override the onProgress callback below
    const configManager = new SubLoadingManager(loadingManager);
    const managers = lineage.map(c => {
        // Set the manager to resolve urls using the base path of the config
        const basePath = c.basePath;
        const manager = new SubLoadingManager(configManager);
        manager.setURLModifier(url => {
            let parentUrl;
            if (manager.manager) {
                parentUrl = manager.manager.resolveURL(url);
            } else {
                parentUrl = url;
            }
            return resolvePath(basePath, parentUrl);
        });
        return manager;
    });

    // Load all settings and files from the lineage of configs
    const promises = [];
    for (let i = 0; i < lineage.length; i++) {
        const config = lineage[i];
        const manager = managers[i];
        const options = config.options;
        if (options?.playbackSpeed) viewer.playbackSpeed = options.playbackSpeed;
        if (options?.gridVisibility) viewer.gridVisibility = options.gridVisibility;
        if (options?.up) viewer.world.setUpDirection(options.up);
        if (options?.lightDirection) viewer.lightDirection?.set(...options.lightDirection);

        viewer.renderer.setClearColor(new Color(0x131619).convertSRGBToLinear().getHex());
        viewer.getCamera().position.set(2, 2, 2);

        // Load telemetry
        config.telemetry?.forEach(t => {
            const loadingKey = t.path || t.paths.join();
            manager.itemStart(loadingKey);

            const pr = loadTelemetryAnimator(t.type, t.path || t.paths, t.options, manager)
                .then(res => {
                    manager.itemEnd(loadingKey);
                    if (!res.isTelemetryAnimator) {
                        for (const name in res) {
                            viewer.animator.addAnimator(res[name], `${t.id}/${name}`);
                        }
                    } else {
                        viewer.animator.addAnimator(res, t.id);
                    }
                })
                .catch(e => {
                    manager.itemError(loadingKey, e);
                    manager.itemEnd(loadingKey);
                });

            promises.push(pr);
        });

        // load in all terrain defined in config file
        config.terrain?.forEach(t => {
            let pr = loadModel(t.type, t.path || t.paths, t.options, manager)
                .then(terr => {
                    if (Array.isArray(terr)) {
                        const terrGroup = new Group();
                        terrGroup.add(...terr);
                        terr = terrGroup;
                    }
                    convertStandardMaterialToPhong(terr);
                    terr.traverse(c => {
                        c.castShadow = false;
                        c.receiveShadow = true;
                    });
                    viewer.addTerrain(terr, t.id);

                    const { position, rotation, quaternion } = t.options;
                    if (position && position.length === 3) {
                        terr.position.set(...position);
                    }

                    if (rotation && rotation.length === 3) {
                        terr.rotation.set(
                            MathUtils.degToRad(rotation[0]),
                            MathUtils.degToRad(rotation[1]),
                            MathUtils.degToRad(rotation[2]),
                        );
                    }

                    if (quaternion && quaternion.length === 4) {
                        terr.quaternion.set(...quaternion);
                    }
                })
                .catch(e => {
                    // errors caught by model loader already
                });
            promises.push(pr);
        });

        config.robots?.forEach(r => {
            const pr = loadModel(r.type, r.path, r.options, manager).then(robot => {
                convertStandardMaterialToPhong(robot);
                robot.traverse(c => {
                    if (c.isMesh && !c.material.transparent || !c.isMesh) {
                        c.castShadow = true;
                    }
                    c.receiveShadow = true;
                });
                viewer.addObject(robot, {}, r.id);
            });
            promises.push(pr);
        });
    }

    // Add drivers last after everything is resolved to make sure it's all available.
    configManager.itemStart('load-drivers');
    viewer.pointCloudSettings = {};

    Promise.all(promises).then(() => {
        viewer.shadowTargets = Object.values(viewer.objects);

        // load all drivers from the lineage of configs
        const driverPromises = [];
        for (let i = 0; i < lineage.length; i++) {
            const config = lineage[i];
            const manager = managers[i];

            config.drivers?.forEach((d, i) => {
                const loadingKey = d.type;
                manager.itemStart(loadingKey);
                const driverPr = new Promise((res, rej) => {
                    createDriver(d.type, d.options, manager).then(driver => {
                        const id = d.id || `driver-${i}`;
                        try {
                            viewer.addDriver(driver, id);

                            // add any point cloud topics
                            if (d.options?.topics) {
                                d.options.topics.forEach(topic => {
                                    if (topic?.type === 'sensor_msgs/PointCloud2') {
                                        const driverTopic = driver.options.topics.find(t => {
                                            return t.name === topic.name;
                                        });
                                        viewer.pointCloudSettings[topic.name] = driverTopic;

                                        driverTopic.options = Object.assign(
                                            {
                                                opacity: 0.8,
                                                pointSize: 0.02,
                                                colorChannelName: 'none',
                                                useRainbowColor: true,
                                                visible: true,
                                            },
                                            driverTopic.options
                                        );
                                        console.log('Found point cloud topic', topic.name, driver, driverTopic);
                                    }
                                });
                            }

                            manager.itemEnd(loadingKey);
                            res();
                        } catch (e) {
                            manager.itemError(loadingKey, e);
                            manager.itemEnd(loadingKey, e);
                            rej(e);
                        }
                    });
                });
                driverPromises.push(driverPr);
            });
        }

        Promise.all(driverPromises).then(() => {
            configManager.itemEnd('load-drivers');
        });
    });

    // Once all the terrain, robots, animators, and drivers have loaded then we finish.
    return new Promise(resolve => {
        configManager.onLoad = () => {
            if (viewer.animator.seekable) {
                viewer.animator.setTime(viewer.animator.startTime);
            } else {
                viewer.play();
            }
            resolve(viewer);
        };
    });
}

function clean(config, basePath = null) {
    if (basePath === null) {
        // if there's no base path then remove the hash of the current origin and remove
        // the next file so we can load relative to the current page.
        basePath = window.location.href.replace(/#.+/, '').replace(/[\\/][^/\\]*$/, '');
    }

    const defaultConfig = {
        root: null,
        basePath,
        title: '',
        robots: [],
        terrain: [],
        telemetry: [],
        drivers: [],
        timeInfo: {
            telemetry: '',
            timeFormats: {},
        },
        options: {
            up: '+Z',
            viewCube: true,
            playbackSpeed: 1,
            gridVisibility: false,
            renderer: {},
            settings: {},
        },
    };

    // iteration does not include symbols so copy CONFIG_LINEAGE over explicitly
    const cleanedConfig = mergeConfig(defaultConfig, config);
    cleanedConfig[CONFIG_LINEAGE] = config[CONFIG_LINEAGE];

    return cleanedConfig;
}

function load(_path, fetchOptions = { credentials: 'same-origin' }, lineage = [], stack = []) {
    const targetPath = path.normalize(_path);
    if (stack.includes(targetPath)) {
        throw new Error(`Config: Cyclic dependency on "${_path}" found in config.`);
    } else {
        stack.push(targetPath);
    }

    const basePath = path.dirname(_path);
    return fetch(_path, fetchOptions)
        .then(res => res.json())
        .then(config => {
            // If the config references a parent config definition in "root" then
            // load the parent and merge it in
            const cleanedConfig = clean(config, basePath);
            if (cleanedConfig.root) {
                const resolvedRootUrl = resolvePath(basePath, cleanedConfig.root);
                return load(resolvedRootUrl, fetchOptions, lineage, stack).then(parentConfig => {
                    lineage.push({ ...config, basePath });

                    const merged = mergeConfig(parentConfig, config);
                    merged[CONFIG_LINEAGE] = [...lineage];
                    return merged;
                });
            } else {
                lineage.push({ ...cleanedConfig });
                cleanedConfig[CONFIG_LINEAGE] = [...lineage];
                return cleanedConfig;
            }
        });
}

export { load, clean, applyConfigToViewer, mergeConfig as merge, CONFIG_LINEAGE };
