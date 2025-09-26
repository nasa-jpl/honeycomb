import React, { Component } from 'react';
import { AutoFieldList } from '../MaterialAutoField';
import { Terrain, MenuOpen } from '@material-ui/icons';

import { IconMenu } from '../IconMenu';
import { SettingsMenu } from '../SettingsMenu';
import { ViewPlayer } from '../ViewPlayer';
import { PureTypography } from '../Common';
import { LabeledTelemetryAnimatorGraph } from '../TelemetryAnimatorGraph';
import { ImageViewer } from '../ImageViewer';

import { Tooltip, IconButton } from '@material-ui/core';

import { ViewerContainer } from './ViewerContainer';
import EventMenu from './EventMenu';
import * as styles from './styles/index.css';
import * as displayStyles from './styles/display.css';

// TOL_LIGHT color scheme
const GRAPH_COLORS = [
    '#77AADD',
    '#EE8866',
    '#EEDD88',
    '#44BB99',
    '#99DDFF',
    '#FFAABB',
    '#BBCC33',
    '#AAAA00',
    '#DDDDDD',
];

const DEFAULT_TIME_FORMAT_TOKEN = '__DEFAULT_TIME_FORMAT__';
export default class extends Component {
    constructor() {
        super(...arguments);

        const { defaultTimeFormat, baseTimeFormat } = this.props;

        const pointCloudSettings = this.props.viewer?.pointCloudSettings;
        const pointCloudSettingsKeys = pointCloudSettings !== undefined ?
            Object.keys(pointCloudSettings) : [];
        const firstPointCloudSettings = pointCloudSettingsKeys.length > 0 ?
            pointCloudSettings[pointCloudSettingsKeys[0]] : {};

        this.state = {
            currTimeFormat: defaultTimeFormat ? defaultTimeFormat : baseTimeFormat ? baseTimeFormat : '',
            currPlaybackSpeed: 1,
            currSliderStartTimeInput: null,
            currSliderEndTimeInput: null,
            currSliderStartTime: null,
            currSliderEndTime: null,
            loopOnSeekToMaps: true,
            pointCloudSettings: Object.assign(
                {
                    name: '',
                    options: {
                        opacity: 0.8,
                        pointSize: 0.02,
                        colorChannelName: 'none',
                        useRainbowColor: true,
                    },
                },
                firstPointCloudSettings
            ),
            pointCloudSettingsInitialized: false,
            currentPointCloudTopicIndex: 0,
        };
    }

    componentDidMount() {
        const { editTimeWindow, defaultStartTime, defaultEndTime, viewer } =
            this.props;
        const { animator } = viewer;
        if (editTimeWindow) {
            const startTime = defaultStartTime || animator.startTime;
            const endTime = defaultEndTime || animator.endTime;
            const { fixedSliderStartTime, fixedSliderEndTime } =
                this.validateSliderTimes(startTime, endTime);

            if (fixedSliderStartTime) {
                animator.setTime(fixedSliderStartTime);
            }

            this.setState({
                currSliderStartTime: fixedSliderStartTime,
                currSliderEndTime: fixedSliderEndTime,
                currSliderStartTimeInput: fixedSliderStartTime,
                currSliderEndTimeInput: fixedSliderEndTime,
            });
        } else if (
            defaultStartTime &&
            defaultStartTime > animator.startTime &&
            defaultStartTime < animator.endTime
        ) {
            animator.setTime(defaultStartTime);
        }
    }

    // TODO: this is mars specific and should maybe be moved elsewhere
    getAbsoluteTime = anim => {
        const { timeFormats, timeTelemetry, displayAbsoluteTime } = this.props;
        const timeAnimator = anim.animators[timeTelemetry];

        if (timeAnimator && timeAnimator.ready) {
            const { currTimeFormat } = this.state;
            const currState = timeAnimator.state;

            if (currTimeFormat in timeFormats) {
                const time = currState[timeFormats[currTimeFormat]];
                if (/^\d*\.\d*$/.test(time)) {
                    return time.toFixed(2);
                } else if (/lmst/i.test(currTimeFormat)) {
                    return time;
                    // return time.replace(/[Ss]ol-(\d+){5} /, '');
                } else if (/utc/i.test(currTimeFormat)) {
                    return time.replace(/[T]/, ' ');
                }
            } else {
                return `${anim.time.toFixed(2)}`;
            }
        } else if (displayAbsoluteTime) {
            return `${anim.time.toFixed(2)}`;
        }

        return '';
    };

    changeDisplayTime = e => {
        const value = e.target.value === DEFAULT_TIME_FORMAT_TOKEN ? '' : e.target.value;
        this.setState({ currTimeFormat: value });
    };

    changePlaybackSpeed = e => {
        this.setState({ currPlaybackSpeed: e.target.value });
        this.props.viewer.playbackSpeed = e.target.value;
    };

    changeSliderStartTime = e => {
        this.setState({ currSliderStartTimeInput: parseFloat(e.target.value) });
    };

    changeSliderEndTime = e => {
        this.setState({ currSliderEndTimeInput: parseFloat(e.target.value) });
    };

    changeLoopOnSeekToMaps = e => {
        this.setState({ loopOnSeekToMaps: !this.state.loopOnSeekToMaps });
    };

    onSliderWindowBlur = e => {
        const { currSliderStartTimeInput, currSliderEndTimeInput } = this.state;
        const { viewer } = this.props;
        const { animator } = viewer;

        const { fixedSliderStartTime, fixedSliderEndTime } =
            this.validateSliderTimes(
                currSliderStartTimeInput,
                currSliderEndTimeInput
            );

        if (fixedSliderStartTime) {
            animator.setTime(fixedSliderStartTime);
        }

        this.setState({
            currSliderStartTime: fixedSliderStartTime,
            currSliderEndTime: fixedSliderEndTime,
            currSliderStartTimeInput: fixedSliderStartTime,
            currSliderEndTimeInput: fixedSliderEndTime,
        });
    };

    validateSliderTimes = (sliderStartTime, sliderEndTime) => {
        const { viewer } = this.props;
        const { animator } = viewer;

        let fixedSliderStartTime = sliderStartTime || animator.startTime;
        let fixedSliderEndTime = sliderEndTime || animator.endTime;

        if (fixedSliderStartTime > fixedSliderEndTime) {
            if (fixedSliderStartTime === animator.startTime) {
                fixedSliderEndTime = fixedSliderStartTime + 10;
            } else {
                fixedSliderStartTime = fixedSliderEndTime - 10;
            }
        }

        // try to make sure there's minimum of 10s gap
        if (fixedSliderEndTime - fixedSliderStartTime < 10) {
            if (fixedSliderEndTime === animator.endTime) {
                fixedSliderStartTime = fixedSliderEndTime - 10;
            } else {
                fixedSliderEndTime = fixedSliderStartTime + 10;
            }
        }

        // clamp to animator's start/end times
        fixedSliderStartTime = Math.max(animator.startTime, fixedSliderStartTime);
        fixedSliderStartTime = Math.min(animator.endTime, fixedSliderStartTime);

        fixedSliderEndTime = Math.max(animator.startTime, fixedSliderEndTime);
        fixedSliderEndTime = Math.min(animator.endTime, fixedSliderEndTime);

        if (fixedSliderStartTime === animator.startTime) {
            fixedSliderStartTime = null;
        }
        if (fixedSliderEndTime === animator.endTime) {
            fixedSliderEndTime = null;
        }

        return { fixedSliderStartTime, fixedSliderEndTime };
    };

    setTime = time => {
        const { viewer } = this.props;
        time = Math.max(viewer.animator.startTime, time);
        time = Math.min(viewer.animator.endTime, time);
        viewer.animator.setTime(time).then(() => {
            this.forceUpdate();
        });
    };

    getCurrentPointCloudTopic = (_index = null) => {
        const pointCloudTopicKeys = this.props.viewer.pointCloudSettings ?
            Object.keys(this.props.viewer.pointCloudSettings) : null;

        let index = _index !== null ? _index : this.state.currentPointCloudTopicIndex;

        const currentPointCloudTopic = pointCloudTopicKeys?.length ?
            pointCloudTopicKeys[index] : null;

        const pointCloudTopic = currentPointCloudTopic ?
            this.props.viewer.pointCloudSettings[currentPointCloudTopic] : null;

        return pointCloudTopic;
    }

    // we make the point cloud re-render immediately in case the point cloud data 
    // doesn't get updated immediately (e.g., due to throttling the topic or if
    // the viewer is paused, etc.)
    updatePointCloudRendering = () => {
        const pointCloudTerrains = this.props.viewer.tags.getObjects('pointcloud');
        if (pointCloudTerrains !== null) {
            const pointCloudTopic = this.getCurrentPointCloudTopic();

            const terrain = pointCloudTerrains.find(terrain => {
                return terrain.name === pointCloudTopic.name;
            });

            if (terrain) {
                terrain.update(true, pointCloudTopic.options);
                this.props.viewer.dirty = true;
            }
        }
    }

    changePointCloudOpacity = e => {
        const pointCloudTopic = this.getCurrentPointCloudTopic();

        const opacity = parseFloat(e.target.value);
        if (pointCloudTopic?.options) {
            pointCloudTopic.options.opacity = opacity;
        }
        this.updatePointCloudRendering();

        const pointCloudSettings = this.state.pointCloudSettings;
        pointCloudSettings.options.opacity = opacity;
        this.setState({ pointCloudSettings: pointCloudSettings });
    }

    changePointCloudSize = e => {
        const pointCloudTopic = this.getCurrentPointCloudTopic();

        const pointSize = parseFloat(e.target.value);
        if (pointCloudTopic?.options) {
            pointCloudTopic.options.pointSize = pointSize;
        }
        this.updatePointCloudRendering();

        const pointCloudSettings = this.state.pointCloudSettings;
        pointCloudSettings.options.pointSize = pointSize;
        this.setState({ pointCloudSettings: pointCloudSettings });
    }

    changePointCloudColorChannelName = e => {
        const pointCloudTopic = this.getCurrentPointCloudTopic();

        const colorChannelName = e.target.value;

        let useRainbowColor = null;
        if (['x', 'y', 'z'].includes(colorChannelName)) {
            useRainbowColor = true;
        } else if (colorChannelName === 'none') {
            useRainbowColor = false;
        }

        if (pointCloudTopic?.options) {
            pointCloudTopic.options.colorChannelName = colorChannelName;
            if (useRainbowColor !== null)
                pointCloudTopic.options.useRainbowColor = useRainbowColor;
        }
        this.updatePointCloudRendering();

        const pointCloudSettings = this.state.pointCloudSettings;
        pointCloudSettings.options.colorChannelName = colorChannelName;
        if (useRainbowColor !== null)
            pointCloudSettings.options.useRainbowColor = useRainbowColor;

        this.setState({ pointCloudSettings: pointCloudSettings });
    }

    changePointCloudUseRainbowColor = e => {
        const pointCloudTopic = this.getCurrentPointCloudTopic();

        if (pointCloudTopic?.options) {
            pointCloudTopic.options.useRainbowColor = !pointCloudTopic.options.useRainbowColor;
        }
        this.updatePointCloudRendering();

        this.forceUpdate();
    }

    changePointCloudTopic = e => {
        const newPointCloudTopic = e.target.value;

        const pointCloudTopicKeys = this.props.viewer.pointCloudSettings ?
            Object.keys(this.props.viewer.pointCloudSettings) : null;

        // find new index value
        const newIndex =
            pointCloudTopicKeys.findIndex(key => key === newPointCloudTopic);

        const pointCloudTopic = this.getCurrentPointCloudTopic(newIndex);

        this.setState({
            pointCloudSettings: pointCloudTopic,
            currentPointCloudTopicIndex: newIndex,
        });
    }

    changePointCloudVisibility = e => {
        const pointCloudTopic = this.getCurrentPointCloudTopic();

        if (pointCloudTopic?.options) {
            pointCloudTopic.options.visible = !pointCloudTopic.options.visible;
        }
        this.props.viewer.toggle(pointCloudTopic.name, pointCloudTopic.options.visible);
        this.updatePointCloudRendering();

        this.forceUpdate();
    }

    toggleVR = () => {
        const { viewer } = this.props;
        viewer.toggleVR();
    };

    renderMenu = () => {
        const {
            viewer,
            timeFormats = {},
            timeTelemetry,
            defaultTimeFormat = null,
            baseTimeFormat = null,
            editTimeWindow = false,
            events = null,
            settings = {},
            buttons = [],
            terrainSettings = [],
            robotSettings = [],
            container,
            note,
            charts,
            images,
            playbackSpeedOptions = [0.25, 0.5, 1, 5, 10, 20, 50],
        } = this.props;
        const {
            currTimeFormat,
            currSliderStartTimeInput,
            currSliderEndTimeInput,
            loopOnSeekToMaps,
        } = this.state;

        // TODO: This container should be derived from the wrapper element
        // of the app rather than hard coding the AppContainer page element.
        const terrainMenu = (
            <IconMenu
                icon={<Terrain />}
                title="Terrains"
                container={container}
            >
                <AutoFieldList
                    container={container}
                    style={{ display: 'flex', marginTop: '5px' }}
                    items={terrainSettings}
                />
            </IconMenu>
        );

        // const robotMenu = (
        //     <IconMenu
        //         popoverClassName={styles.settingsPopover}
        //         icon={<Android />}
        //         title="Robots"
        //         container={container}
        //     >
        //         <AutoFieldList
        //             container={container}
        //             style={{ display: 'flex', marginTop: '5px' }}
        //             items={robotSettings}
        //         />
        //     </IconMenu>
        // );

        let timeFormatOptions = {};
        const timeFormat = defaultTimeFormat || baseTimeFormat;
        if (!(timeFormat in timeFormatOptions)) {
            timeFormatOptions[timeFormat || 'Default'] = timeFormat || DEFAULT_TIME_FORMAT_TOKEN;
        }
        Object.keys(timeFormats).forEach(format => timeFormatOptions[format] = format);

        const timeAnimator = viewer.animator.animators[timeTelemetry];
        const animatorTimeFormat = timeAnimator ? timeAnimator.baseTimeFormat : timeFormat;

        const playbackSettings = [
            Object.keys(timeFormats).length ?
                {
                    label: 'Time Format',
                    value: currTimeFormat || timeFormat || DEFAULT_TIME_FORMAT_TOKEN,
                    options: timeFormatOptions,
                    onChange: this.changeDisplayTime,
                }
                : null,
            {
                value: viewer.playbackSpeed,
                options: playbackSpeedOptions.reduce((acc, s) => {
                    acc[`${s}x`] = s;
                    return acc;
                }, {}),
                onChange: this.changePlaybackSpeed,
                label: 'Playback Speed',
            },
            editTimeWindow ? {
                label: `Time Window Start (${animatorTimeFormat})`,
                value: currSliderStartTimeInput ?
                    parseFloat(currSliderStartTimeInput.toFixed()) :
                    parseFloat(viewer.animator.startTime.toFixed()),
                onChange: this.changeSliderStartTime,
                onBlur: this.onSliderWindowBlur,
            } : null,
            editTimeWindow ? {
                label: `Time Window End (${animatorTimeFormat})`,
                value: currSliderEndTimeInput ?
                    parseFloat(currSliderEndTimeInput.toFixed()) :
                    parseFloat(viewer.animator.endTime.toFixed()),
                onChange: this.changeSliderEndTime,
                onBlur: this.onSliderWindowBlur,
            } : null,
            {
                label: 'Loop on Seek to Maps',
                value: loopOnSeekToMaps,
                onChange: this.changeLoopOnSeekToMaps,
            },
        ].filter(item => !!item);
        if (settings['Playback']) {
            const prevPlaybackSettings = settings['Playback'];
            playbackSettings.forEach(val => {
                const foundSetting = prevPlaybackSettings.find(prevSetting => {
                    return val.label === prevSetting.label;
                });
                if (!foundSetting) {
                    prevPlaybackSettings.push(val);
                } else {
                    foundSetting.value = val.value;
                }
            });
        } else {
            settings['Playback'] = playbackSettings;
        }

        const pointCloudTopic = this.getCurrentPointCloudTopic();

        if (pointCloudTopic) {

            const pointCloudTopicKeys = this.props.viewer.pointCloudSettings ?
                Object.keys(this.props.viewer.pointCloudSettings) : null;

            // we need to separately track it in React state for the UI 
            // to allow changes to occur in the settings menu
            const pointCloudSettingsState = this.state.pointCloudSettings;

            settings['PointCloud'] = [
                {
                    label: 'Opacity',
                    get value() {
                        return pointCloudSettingsState.options.opacity;
                    },
                    onChange: this.changePointCloudOpacity,
                },
                {
                    label: 'Point Size',
                    get value() {
                        return pointCloudSettingsState.options.pointSize;
                    },
                    onChange: this.changePointCloudSize,
                },
                {
                    label: 'Color Channel Name',
                    // TODO: dynamically set these options
                    // based on what's available in the topic
                    options: [
                        'none', 'x', 'y', 'z',
                        'intensity',
                        'reflectivity',
                        'ring',
                        'ambient',
                        'range',
                        't',
                    ],
                    get value() {
                        return pointCloudSettingsState.options.colorChannelName;
                    },
                    onChange: this.changePointCloudColorChannelName,
                },
                {
                    label: 'Use Rainbow Color',
                    get value() {
                        return pointCloudSettingsState.options.useRainbowColor;
                    },
                    // none, and x,y,z color channels always use rainbow color
                    disabled: ['none', 'x', 'y', 'z'].includes(pointCloudSettingsState.options.colorChannelName),
                    onChange: this.changePointCloudUseRainbowColor,
                },
                {
                    label: 'Topic',
                    options: pointCloudTopicKeys,
                    get value() {
                        return pointCloudTopic.name;
                    },
                    onChange: this.changePointCloudTopic,
                },
                {
                    label: 'Visible',
                    get value() {
                        return pointCloudSettingsState.options.visible;
                    },
                    onChange: this.changePointCloudVisibility,
                },
            ];
        }

        if (settings['ROS']) {
            settings['ROS'].forEach(setting => {
                if (setting.type === 'pointcloud') {
                    settings['PointCloud'].push(setting);
                }
            });
        }


        const settingsMenu = (
            <SettingsMenu
                container={container}
                settings={settings}
            />
        );

        const vrMenu = (
            <IconButton style={{ padding: 5, fontSize: 19 }} onClick={this.toggleVR}>
                VR
            </IconButton>
        );

        const openDrawer = (
            <Tooltip title="Charts & Images" placement="top">
                <IconButton style={{ padding: 5, fontSize: 19 }} onClick={() => {
                    const drawerOpen = !this.state.drawerOpen;
                    this.setState({ drawerOpen });
                }}>
                    <MenuOpen />
                </IconButton>
            </Tooltip>
        );

        return (
            <React.Fragment>
                <PureTypography variant="body2" className={styles.note} label={note} />
                <div
                    className={`${styles.staleIcon} ${viewer.animator.stale ? '' : displayStyles.hidden
                        }`}
                />
                {buttons}
                {/* {robotSettings.length ? robotMenu : null} */}
                {terrainSettings.length ? terrainMenu : null}
                {events ? (
                    <EventMenu events={events} setTime={this.setTime} container={container} />
                ) : null}
                {settingsMenu}
                {/* {viewer.isCapableVR ? vrMenu : null} */}
                {(charts && charts.length) || (images && images.length) ? openDrawer : null}
            </React.Fragment>
        );
    };

    render() {
        const {
            viewer,
            events,
            timelineDataVolumes,
            container,
            defaultTimeFormat,
            baseTimeFormat,
            significantAnimators,
            // drawerComponent,
            charts = [],
            images = [],
        } = this.props;
        const { currTimeFormat, drawerOpen, currSliderStartTime, currSliderEndTime, loopOnSeekToMaps } = this.state;

        let drawerComponent = null;
        if (drawerOpen && (charts.length || images.length)) {
            // const hierarchy = new SceneHierarchy(viewer.world);
            // drawerComponent= <SceneHierarchyComponent
            //     hierarchy={hierarchy}
            //     onMouseEnter={e => viewer.addSelection(e.object)}
            //     onMouseLeave={e => viewer.removeSelection(e.object)}
            // />;

            const graphComponents = charts.map((graph, i) => {
                const {
                    animator,
                    duration,
                    fields,
                    labels,
                    units,
                    relative,
                } = graph;

                return (
                    <LabeledTelemetryAnimatorGraph
                        key={i}
                        animator={viewer.animators[animator]}
                        duration={duration}
                        fields={fields}
                        colors={GRAPH_COLORS}
                        labels={labels}
                        units={units}
                        relativeTime={relative ? viewer.animator.startTime : 0}
                    />
                );
            });

            const imageComponents = images.map((img, i) => {
                const {
                    animator,
                } = img;

                return (
                    <ImageViewer
                        key={i}
                        animator={viewer.animators[animator]}
                    />
                );
            });

            drawerComponent = (
                <div style={{ padding: '5px', overflow: 'auto', height: '100%' }}>
                    {graphComponents}
                    {imageComponents}
                </div>
            );
        }

        const menu = this.renderMenu();
        return (
            <ViewPlayer
                ref={e => (this.viewPlayerComponent = e)}
                viewer={viewer}
                animator={viewer.animator}
                viewerContainer={
                    <ViewerContainer viewer={viewer} style={{ height: '100%', width: '100%', flexShrink: 1, overflow: 'hidden' }} />
                }
                drawerComponent={drawerComponent}
                events={events}
                timelineDataVolumes={timelineDataVolumes}
                getAbsoluteTime={this.getAbsoluteTime}
                defaultTimeFormat={defaultTimeFormat || baseTimeFormat}
                baseTimeFormat={baseTimeFormat || defaultTimeFormat}
                setTime={this.setTime}
                currTimeFormat={currTimeFormat}
                currSliderStartTime={currSliderStartTime ?
                    currSliderStartTime :
                    viewer.animator.startTime
                }
                currSliderEndTime={currSliderEndTime ? currSliderEndTime : viewer.animator.endTime}
                loopOnSeekToMaps={loopOnSeekToMaps}
                buttons={menu}
                container={container}
                significantAnimators={significantAnimators}
            />
        );
    }
}
