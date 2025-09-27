import { Component } from 'react';
import { CSSTransition } from 'react-transition-group';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { LoadingManager } from '@gov.nasa.jpl.honeycomb/core';
import { DisposableEventListeners } from '@gov.nasa.jpl.honeycomb/three-extensions';
import { Typography } from '@material-ui/core';
import * as Config from '../../config';
import { getViewerClass } from '../../getViewerClass';

import * as viewerStyles from './styles/root.css';
import {
    HoneycombVideoPlayer,
    HoneycombAppWrapper,
    HoneycombPlayButton,
} from '../Players';

const LOCAL_STORAGE_KEY = 'honeycomb-settings';

const settingsVersion = '0.0.12';

export class HoneycombBaseApp extends Component<any, any> {
    listeners: DisposableEventListeners;
    extraSettings: any;

    constructor(props) {
        super(props);

        this.state = {
            started: false,
            viewer: null,
            manager: null,
            config: null,
            containerElement: null,
            appProps: {},
            toggleNotif: { message: '', open: false, timeout: null },
            lockedData: {},
        };

        this.listeners = new DisposableEventListeners();

        this.loadConfig();
    }

    // Load and set up the config file
    async loadConfig() {
        const { props } = this;
        const { config: configOrPath, configOverrides } = props;

        let config;
        if (typeof config === 'string') {
            config = await Config.load(configOrPath);
        } else {
            // await promise.resolve because we can't call setState
            // in the constructor.
            config = Config.clean(configOrPath);
            await Promise.resolve();
        }

        // merge any overrides on top of the default config object
        config = Config.merge(config, configOverrides);
        await this.setState({ config }, () => {
            if (!props.deferLoad) {
                this.loadViewer();
            }
        });
    }

    // Load the viewer and all relevant data
    async loadViewer() {
        const { props, state } = this;
        const { config } = state;
        let viewer = props.viewer || null;

        const manager = new LoadingManager();
        if (viewer === null) {
            const rendererOptions = config.options;
            const ViewerClass = getViewerClass(config);
            if (!('checkShaderError' in rendererOptions)) {
                // __DEV__ is defined by the webpack plugin
                rendererOptions.checkShaderErrors = __DEV__;
            }
            viewer = new ViewerClass(rendererOptions);
        }

        this.setState({ started: true, manager, viewer }, async () => {
            await Config.applyConfigToViewer(config, viewer, manager);
            if (viewer.animator.liveData) {
                viewer.isLive = true;
                viewer.play();
            }

            this.initializeViewer();

            if (this.props.viewerRef) {
                this.props.viewerRef(viewer);
            }

        });
    }

    hideToggleNotification = () => {
        this.setState((prev) => {
            const updatedNotif = prev.toggleNotif;
            updatedNotif.open = false;
            return { toggleNotif: updatedNotif };
        });
    }

    initializeViewer() {
        const { viewer, config, containerElement } = this.state;
        viewer.controls.enableKeys = false;

        // Focus the camera on the first robot or the focus target if
        // it's already set (by driver or other means).
        const robot = viewer.focusTarget || Object.values(viewer.objects)[0];
        if (robot) {
            viewer.focusTarget = robot;

            // Position the camera at a good starting spot on first data
            robot.updateMatrixWorld();

            // position the camera at the rover
            const camera = viewer.getCamera();
            camera.position.set(10, -5, -5);
            FrameTransformer.transformPoint(
                robot.matrixWorld,
                viewer.scene.matrixWorld,
                camera.position,
                camera.position,
            );

            camera.position.y = Math.abs(camera.position.y);
            viewer.controls.update();
        }

        // Set render order for stencils
        for (const key in viewer.terrain) {
            const terr = viewer.getTerrain(key);
            if (terr) {
                terr.traverse(t => t.isMesh && (t.renderOrder = -3));
            }
        }

        // Get time info
        const timeInfo = config.timeInfo;
        const timeFormatAnimator = viewer.getAnimator(timeInfo.telemetry);
        const formats = timeInfo.formats;
        const timeTelemetry = timeInfo.telemetry;
        let timeFormats = [];
        if (timeFormatAnimator && formats) {
            const state = timeFormatAnimator.frames.length > 0 ?
                timeFormatAnimator.frames[0] : timeFormatAnimator.state;
            Object.keys(formats).forEach(val => {
                if (formats[val] in state) {
                    timeFormats[val] = formats[val];
                }
            });
        }

        const events =
            timeInfo && timeInfo.events ?
                viewer.animators[timeInfo.events].frames :
                null;

        let timelineDataVolumes = null;
        const { options } = config;

        let playbackSpeedOptions;
        if (options?.playbackSpeedOptions) {
            playbackSpeedOptions = options.playbackSpeedOptions;
        }

        if (options.timelineDataVolumes && options.timelineDataVolumes.length > 0) {
            timelineDataVolumes = {};
            options.timelineDataVolumes.forEach(val => {
                const telemKey = val.telemetry;
                if (telemKey in viewer.animators) {
                    const animator = viewer.animators[telemKey];
                    if (!animator.isBufferedAnimator) {
                        timelineDataVolumes[telemKey] = {
                            frames: animator.frames,
                            color: val.color,
                        };
                    } else {
                        console.warn(`Cannot display data volumes for ${telemKey}`);
                    }
                }
            });
        }

        const viewerStateChanged = () => {
            viewer.dirty = true;
            viewer.dispatchEvent({ type: 'change' });
        };

        const settings = {
            'Playback': [
                {
                    label: 'Interpolate',
                    value: false,
                    onChange(e, val) {
                        // TODO: the animation state update should happen automagically
                        viewer.animator.interpolate = val;
                        viewer.animator.setTime(viewer.animator.time);
                        this.value = val;

                        viewerStateChanged();
                    },
                },
            ],
            'Rendering': [
                {
                    label: 'Fixed Camera',
                    get value() {
                        return viewer.fixedCamera;
                    },
                    onChange(e, val) {
                        viewer.fixedCamera = val;
                        viewerStateChanged();
                    },
                },
                {
                    label: 'Display Grid',
                    get value() {
                        return viewer.gridVisibility;
                    },
                    onChange(e, val) {
                        viewer.gridVisibility = val;
                        viewerStateChanged();
                    },
                },
            ],
        };

        let terrainSettings;

        const prevSavedSettingsString = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        let savedSettings = { settings: {}, terrain: {}, version: settingsVersion };
        if (prevSavedSettingsString) {
            const prevSavedSettings = JSON.parse(prevSavedSettingsString);
            if (prevSavedSettings['version'] === settingsVersion) {
                savedSettings = prevSavedSettings;
            } else {
                window.localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }

        const cacheSettings = () => {
            const cachedSettings = JSON.parse(JSON.stringify(savedSettings));
            Object.keys(settings).forEach(key => {
                settings[key].forEach(setting => {
                    if (!cachedSettings.settings[key]) {
                        cachedSettings.settings[key] = {};
                    }
                    cachedSettings.settings[key][setting.label] = setting.value;
                });
            });

            if (terrainSettings) {
                terrainSettings.forEach(tSetting => {
                    cachedSettings.terrain[tSetting.name] = tSetting.value;
                });
            }

            try {
                window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedSettings));
                console.log('saved settings in local storage');
            } catch (err) {
                console.error('out of memory for local storage');
                console.log(err);
            }
        };

        const configSettingsKeys = Object.keys(config.options.settings);
        configSettingsKeys.forEach(key => {
            const settingsToAdd = [...(config.options.settings[key].map(t => {
                viewer.toggle(t.tag, t.default);
                const setting: any = {
                    label: t.label,
                    value: t.default,
                    type: t.type,
                    onChange(e, val) {
                        this.value = val;
                        viewer.toggle(t.tag, val);
                        viewerStateChanged();
                        cacheSettings();
                    },
                };
                if (t.lockable) {
                    setting.lockable = t.lockable;
                    setting.lockValue = false;
                    setting.lockOnChange = (e, val) => {
                        setting.lockValue = val;
                        viewer.toggle(t.tag + '-lock', val);
                        viewerStateChanged();
                        this.setState((prevState) => {
                            const prevLockedData = prevState.lockedData;
                            if (val) {
                                prevLockedData[t.tag] = true;
                            } else {
                                if (prevLockedData[t.tag]) {
                                    delete prevLockedData[t.tag];
                                }
                            }
                            return prevLockedData;
                        });
                    };
                }
                if (t.shortcut) {
                    setting.shortcut = '';
                    const splitShortcut = t.shortcut.split('+');
                    const shortcutKey = splitShortcut.pop();
                    // there are modifiers
                    let isShift = shortcutKey === shortcutKey.toUpperCase();
                    let isCtrl = false;
                    let isAlt = false;

                    if (isShift) {
                        setting.shortcut += '\u21e7 ';
                    }
                    splitShortcut.forEach(val => {
                        if (val.toLowerCase() === 'shift') {
                            isShift = true;
                            setting.shortcut += '\u21e7 ';
                        }
                        if (val.toLowerCase() === 'ctrl') {
                            isCtrl = true;
                            setting.shortcut += '^ ';
                        }
                        if (val.toLowerCase() === 'alt') {
                            isAlt = true;
                            setting.shortcut += 'Alt + ';
                        }
                    });
                    setting.shortcut += shortcutKey.toUpperCase();
                    this.listeners.addEventListener(containerElement, 'keydown', e => {
                        let matched = true;
                        matched = matched && e.key.toLowerCase() === shortcutKey.toLowerCase();
                        if (isShift) {
                            matched = matched && e.shiftKey;
                        }
                        if (isCtrl) {
                            matched = matched && e.ctrlKey;
                        }
                        if (isAlt) {
                            matched = matched && e.altKey;
                        }
                        if (matched) {
                            this.setState((prevState) => {
                                const prevToggleNotif = prevState.toggleNotif;
                                prevToggleNotif.message = `${setting.label} ${!setting.value ? 'ON' : 'OFF'}`;
                                prevToggleNotif.open = true;
                                if (prevToggleNotif.timeout) {
                                    clearTimeout(prevToggleNotif.timeout);
                                }
                                prevToggleNotif.timeout = setTimeout(this.hideToggleNotification, 1000);
                                return { toggleNotif: prevToggleNotif };
                            });
                            setting.onChange(null, !setting.value);
                        }
                    });
                }
                return setting;
            }))];

            if (key in settings) {
                settings[key].push(...settingsToAdd);
            } else {
                settings[key] = settingsToAdd;
            }
        });

        const extraSettings = this.extraSettings;
        for (const key in extraSettings) {
            if (key in settings) {
                settings[key].push(...extraSettings[key]);
            } else {
                settings[key] = [...extraSettings[key]];
            }
        }

        // Apply previously saved settings
        for (const key in settings) {
            settings[key].forEach(setting => {
                setting.onChange = setting.onChange.bind(setting);
                if (setting.lockOnChange) {
                    setting.lockOnChange = setting.lockOnChange.bind(setting);
                    // lockable data products should always default to "unlocked"
                    setting.lockOnChange(null, setting.lockValue);
                }
                let savedSetting = null;
                const savedCategory = savedSettings.settings[key];
                if (savedCategory) {
                    if (savedCategory[setting.label] !== undefined) {
                        savedSetting = savedCategory[setting.label];
                    }
                }

                if (savedSetting === null) {
                    setting.onChange(null, setting.value);
                } else {
                    setting.onChange(null, savedSetting);
                }
            });
        }

        terrainSettings = [];
        // terrainSettings = Object.keys(viewer.terrain).map(key => {
        //     const terrain = viewer.getTerrain(key);
        //     const setting = {
        //         label: terrain.name || key,
        //         name: key,
        //         value: true,
        //         onChange(e, val) {
        //             this.value = val;
        //             viewer.toggle(key, val);
        //             viewerStateChanged();
        //             cacheSettings();
        //         },
        //     };
        //     setting.onChange = setting.onChange.bind(setting);
        //     const savedSetting = savedSettings.terrain[key];
        //     if (savedSetting === undefined) {
        //         setting.onChange(null, setting.value);
        //     } else {
        //         setting.onChange(null, savedSetting);
        //     }
        //     return setting;
        // });

        // TODO: viewer.objects now instead of viewer.robots
        const robotSettings = Object.keys(viewer.objects).map(key => {
            const setting = {
                label: key,
                name: key,
                value: true,
                onChange(e, val) {
                    this.value = val;
                    viewer.toggle(key, val);

                    viewerStateChanged();
                },
            };
            setting.onChange = setting.onChange.bind(setting);
            setting.onChange(null, setting.value);
            return setting;
        });

        this.listeners.addEventListener(window as any, 'beforeunload', e => {
            cacheSettings();
        });

        this.setState({
            appProps: {
                timeTelemetry,
                timeFormats,
                robotSettings,
                terrainSettings,
                settings,
                events,
                timelineDataVolumes,
                playbackSpeedOptions,
            },
        });
    }

    // Retain a reference to the parent container
    setAppContainer = containerElement => {
        this.setState({ containerElement });
    }

    render() {
        const { state } = this;
        const {
            viewer,
            manager,
            started,
            config,
            appProps,
            containerElement,
            toggleNotif,
            lockedData,
        } = state;

        if (!started || !config) {
            return <div className={viewerStyles.viewerContainer}>
                <HoneycombAppWrapper
                    componentType={() => {
                        if (config) {
                            return <HoneycombPlayButton
                                title={config.title}
                                onClickPlay={() => {
                                    this.loadViewer();
                                }}
                            />;
                        } else {
                            return null;
                        }
                    }}
                />
            </div>;
        } else {
            return <div
                className={viewerStyles.viewerContainer}
                ref={this.setAppContainer}>
                <HoneycombAppWrapper
                    {...appProps}
                    viewer={viewer}
                    manager={manager}
                    note={config.options.note}
                    displayAbsoluteTime={config.options.displayAbsoluteTime}
                    editTimeWindow={config.options.editTimeWindow}
                    defaultStartTime={config.options.defaultStartTime}
                    defaultEndTime={config.options.defaultEndTime}
                    baseTimeFormat={config.options.baseTimeFormat}
                    defaultTimeFormat={config.options.defaultTimeFormat}
                    showColorLegend={config.options.showColorLegend}
                    significantAnimators={config.options.significantAnimators}
                    title={config.title}
                    charts={config.charts}
                    images={config.images}
                    container={containerElement}
                    componentType={HoneycombVideoPlayer}
                />
                <div className={viewerStyles.notifContainer}>
                    <CSSTransition
                        mountOnEnter={true}
                        unmountOnExit={true}
                        in={toggleNotif.open}
                        timeout={350}
                        classNames={{
                            enter: viewerStyles.toggleNotifEnter,
                            enterActive: viewerStyles.toggleNotifEnterActive,
                            exit: viewerStyles.toggleNotifExit,
                            exitActive: viewerStyles.toggleNotifExitActive,
                            exitDone: viewerStyles.toggleNotifExitDone,
                        }}
                    >
                        <div className={viewerStyles.toggleNotif}>
                            <Typography className={viewerStyles.toggleNotifContent}>
                                {toggleNotif.message}
                            </Typography>
                        </div>
                    </CSSTransition>
                    <div>
                        {Object.keys(lockedData).map((key) => {
                            return (
                                <div className={viewerStyles.toggleNotif} key={key}>
                                    <Typography className={viewerStyles.toggleNotifContent}>
                                        {`${key} LOCKED`}
                                    </Typography>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>;
        }
    }

    componentWillUnmount() {
        this.listeners.dispose();
        if (this.state.viewer) {
            this.state.viewer.dispose();
        }
    }
}
