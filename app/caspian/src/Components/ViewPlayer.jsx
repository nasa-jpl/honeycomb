import React, { Component } from 'react';
import { VideoPlayerBar } from './VideoPlayerBar.jsx';
import { DisplayTime } from './Common.jsx';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import { ConnectionIndicator } from './ConnectionIndicator.jsx';
import { EventWatcher } from './EventWatcher.jsx';

const drawerWidth = 400;
const useStyles = withStyles(theme => ({
    root: {
        width: drawerWidth,
        zIndex: 0,
        height: '100%',
        flexShrink: 0,
    },
}));
const PaperWithStyles = useStyles(Paper);

// Video player wrapper that integrates a video playback bar with an animator
export class ViewPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            fullscreen: false,
        };
    }

    setTime = (e, val) => {
        this.props.animator.setTime(val).then(() => {
            this.forceUpdate();
        });
        this.props.viewer.isLive = false;
    };

    // TODO: consider moving the rerender logic to exports.jsx
    onClickStop = () => {
        this.props.viewer.stop(this.props.currSliderStartTime);
        this.forceUpdate();
    };

    onClickPlay = () => {
        if (this.props.viewer.isPlaying) {
            this.props.viewer.pause();
        } else {
            this.props.viewer.play();
        }

        this.forceUpdate();
    };

    onClickLive = () => {
        if (!this.props.viewer.isLive) {
            this.props.viewer.isLive = true;
            this.props.viewer.play();
        }

        this.forceUpdate();
    };

    // TODO: Remove this if possible
    onDocClick = e => {
        if (document.activeElement.toString() == '[object HTMLButtonElement]') {
            document.activeElement.blur();
        }
    };

    updateIsFullscreen = () => {
        this.setState({ fullscreen: this.isFullscreen() });
    };

    isFullscreen = () => {
        return !!(
            document.fullscreenElement ||
            document.mozFullScreen ||
            document.webkitIsFullScreen ||
            document.msIsFullscreen
        );
    };

    enterFullscreen = () => {
        const docElm = this.props.container || document.documentElement;

        if (docElm.requestFullscreen) {
            docElm.requestFullscreen();
        } else if (docElm.mozRequestFullScreen) {
            docElm.mozRequestFullScreen();
        } else if (docElm.webkitRequestFullScreen) {
            docElm.webkitRequestFullScreen();
        } else if (docElm.msRequestFullscreen) {
            docElm.msRequestFullscreen();
        }
    };

    exitFullscreen = () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    };
    
    onClickSeekToCostmap = () => {
        const { animator, loopOnSeekToMaps } = this.props;
        for (const key in animator.animators) {
            const anim = animator.animators[key];
            if (anim.costmapTimes?.length) {
                const currentTime = animator.time;
                const nextTime = anim.costmapTimes.find(t => t > currentTime) || 
                    (loopOnSeekToMaps ? anim.costmapTimes[0] : currentTime);
                this.setTime(undefined, nextTime);
                break;
            }
        }
    };

    onClickSeekToHeightmap = () => {
        const { animator, loopOnSeekToMaps } = this.props;
        for (const key in animator.animators) {
            const anim = animator.animators[key];
            if (anim.heightmapTimes?.length) {
                const currentTime = animator.time;
                const nextTime = anim.heightmapTimes.find(t => t > currentTime) || 
                    (loopOnSeekToMaps ? anim.heightmapTimes[0] : currentTime);
                this.setTime(undefined, nextTime);
                break;
            }
        }
    };

    onClickFullscreen = () => {
        if (this.isFullscreen()) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    };

    onKeyDown = e => {
        if (e.target.nodeName !== 'INPUT') {
            const props = this.props;
            switch (e.keyCode) {
                case 32: {
                    // space
                    this.onClickPlay();
                    break;
                }
                case 37: {
                    // left arrow
                    const animator = props.animator;
                    const prevTime = animator.getPrevSignificantTime(props.significantAnimators);
                    if (prevTime !== null) {
                        props.animator.setTime(prevTime);
                        this.forceUpdate();
                    }
                    break;
                }
                case 39: {
                    // right arrow
                    const animator = props.animator;
                    const nextTime = animator.getNextSignificantTime(props.significantAnimators);
                    if (nextTime !== null) {
                        props.animator.setTime(nextTime);
                        this.forceUpdate();
                    }
                    break;
                }
            }
        }
    };

    componentDidMount() {
        document.addEventListener('fullscreenchange', this.updateIsFullscreen);
        document.addEventListener('mozfullscreenchange', this.updateIsFullscreen);
        document.addEventListener('webkitfullscreenchange', this.updateIsFullscreen);
        document.addEventListener('msfullscreenchange', this.updateIsFullscreen);
        document.addEventListener('click', this.onDocClick);
    }

    componentWillUnmount() {
        document.removeEventListener('fullscreenchange', this.updateIsFullscreen);
        document.removeEventListener('mozfullscreenchange', this.updateIsFullscreen);
        document.removeEventListener('webkitfullscreenchange', this.updateIsFullscreen);
        document.removeEventListener('msfullscreenchange', this.updateIsFullscreen);
        document.removeEventListener('click', this.onDocClick);
    }

    render() {
        const { fullscreen } = this.state;
        const {
            animator,
            viewer,
            viewerContainer,
            container,
            currTimeFormat,
            absoluteTime,
            getAbsoluteTime,
            setTime,
            defaultTimeFormat,
            baseTimeFormat,
            buttons,
            prefix,
            events,
            timelineDataVolumes,
            drawerComponent,
            currSliderStartTime,
            currSliderEndTime,
        } = this.props;
        const frames = {};
        for (const an in animator.animators) frames[an] = animator.animators[an].frames;

        let relCurrTime = '--';
        let relDuration = '--';
        if (animator.ready) {
            const animTime = Math.max(
                Math.min(animator.time, animator.endTime),
                animator.startTime,
            );
            const currSeconds = animTime - animator.startTime;
            const durationSeconds = animator.endTime - animator.startTime;

            relCurrTime = <DisplayTime seconds={currSeconds} />;
            relDuration = <DisplayTime seconds={durationSeconds} />;
        }

        const relKeyframes =
            (animator.generatedKeyframesUpTo - animator.startTime) /
            (animator.endTime - animator.startTime);

        let drawer = null;
        if (drawerComponent) {
            drawer =<PaperWithStyles square>{drawerComponent}</PaperWithStyles>;
        }

        let connectedIndicator = null;
        if (animator.liveData) {
            let connectedCount = 0;
            let connected = false;
            let connectionChangeTime = null;
            for (const key in animator.animators) {
                const anim = animator.animators[key];
                if (anim.liveData) {
                    connectedCount ++;
                    connected = anim.connected;
                    connectionChangeTime = anim.connectionChangeTime;
                }
            }

            if (connectedCount > 1) {
                console.warn('ViewPlayer: More than one live connected animator found. Only one supported for display.');
            }

            connectedIndicator = <ConnectionIndicator
                connected={connected}
                connectionChangeTime={connectionChangeTime}
            />;
        }

        let haveCostmapTime = false;
        let haveHeightmapTime = false;
        for (const key in animator.animators) {
            const anim = animator.animators[key];
            if (anim.costmapTimes?.length) {
                haveCostmapTime = true;
            }
            if (anim.heightmapTimes?.length) {
                haveHeightmapTime = true;
            }
        }

        return (
            <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
                {connectedIndicator}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
                    {viewerContainer}
                    {drawer}
                </div>
                <div
                    style={{
                        background: 'white',
                        height: '2px',
                        width: `${relKeyframes * 100}%`,
                        display: animator.generatingKeyframes ? 'block' : 'none',
                    }}
                />
                <VideoPlayerBar
                    prefix={prefix}
                    sliderStartTime={currSliderStartTime || animator.startTime}
                    sliderEndTime={currSliderEndTime || animator.endTime}
                    sliderTime={viewer.isLive ? animator.endTime : animator.time}
                    relCurrTime={relCurrTime}
                    relDuration={relDuration}
                    absCurrTime={absoluteTime || (getAbsoluteTime && getAbsoluteTime(animator))}
                    currTimeFormat={currTimeFormat}
                    defaultTimeFormat={defaultTimeFormat}
                    baseTimeFormat={baseTimeFormat}
                    setTime={setTime}
                    onChange={this.setTime}
                    onClickPlay={this.onClickPlay}
                    onClickStop={this.onClickStop}
                    onClickSeekToHeightmap={this.onClickSeekToHeightmap}
                    onClickSeekToCostmap={this.onClickSeekToCostmap}
                    onClickFullScreen={this.onClickFullscreen}
                    onClickLive={this.onClickLive}
                    haveCostmapTime={haveCostmapTime}
                    haveHeightmapTime={haveHeightmapTime}
                    isFullscreen={fullscreen}
                    isPlaying={viewer.isPlaying}
                    isLive={viewer.isLive}
                    displayLive={animator.liveData}
                    buttons={buttons}
                    events={events || []}
                    timelineDataVolumes={timelineDataVolumes}
                    disabled={animator.seekable === false}
                />
                <EventWatcher
                    target={container}
                    events={[ 'keydown' ]}
                    onEventFired={this.onKeyDown}
                />
            </div>
        );
    }
}
