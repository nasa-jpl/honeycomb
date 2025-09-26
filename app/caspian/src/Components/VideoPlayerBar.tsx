import React, { PureComponent } from 'react';
import { Slider, withStyles } from '@material-ui/core';
import { PlayerTimeStamp } from './PlayerTimeStamp';
import { TimelineEvents } from './TimelineEvents';
import { TimelineDataVolumes } from './TimelineDataVolumes';
import { PlayPauseButton, FullscreenButton, StopButton, SeekToCostmapButton, SeekToHeightmapButton } from './VideoPlayerButtons';
import * as styles from './styles/VideoPlayerBar.css';
import { PureTypography } from './Common';

// Remove the transitions from the slider so the
// thumb can keep as the video plays quickly
// Styles to override here:
// https://github.com/mui-org/material-ui/blob/master/packages/material-ui-lab/src/Slider/Slider.js
const TransitionlessSlider = withStyles(() => ({
    track: {
        transition: 'none',
    },
    thumb: {
        transition: 'none',
    },
}))(Slider);

// Passible video playback bar with slots for button extensions
export class VideoPlayerBar extends PureComponent<any, any> {
    /* Life Cycle Functions */
    render() {
        const {
            sliderStartTime,
            sliderEndTime,
            sliderTime,

            relCurrTime,
            relDuration,
            absCurrTime,
            currTimeFormat,
            defaultTimeFormat,
            baseTimeFormat,
            setTime,

            isPlaying,
            isFullscreen,
            isLive,
            haveCostmapTime,
            haveHeightmapTime,
            displayLive,
            prefix,

            onClickPlay,
            onClickStop,
            onClickSeekToHeightmap,
            onClickSeekToCostmap,
            onClickFullScreen,
            onClickLive,

            onChange,

            buttons,

            events,
            timelineDataVolumes,

            disabled,

            container,
            className,
            style,
        } = this.props;

        return (
            <div
                className={`${styles.root} ${className || ''}`}
                style={style}
                tabIndex={0}
            >
                <TransitionlessSlider
                    className={styles.slider}
                    min={sliderStartTime || 0}
                    max={sliderEndTime || 0}
                    value={sliderTime || 0}
                    step={0.001}
                    onChange={onChange}
                    disabled={disabled}
                />

                {timelineDataVolumes ?
                    <div className={styles.dataVolume}>
                        <TimelineDataVolumes
                            start={sliderStartTime || 0}
                            end={sliderEndTime || 0}
                            timelineDataVolumes={timelineDataVolumes}
                        />
                    </div> :
                    null
                }

                {timelineDataVolumes ?
                    (
                        <div className={styles.dataVolumeLabels}>
                            {Object.keys(timelineDataVolumes).map((val, idx) => {
                                return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'row' }}>
                                        <div
                                            className={styles.dataVolumeLabelSwatch}
                                            style={{
                                                backgroundColor: timelineDataVolumes[val].color,
                                            }}
                                        />
                                        <div>
                                            {val}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) :
                    null
                }

                <TimelineEvents
                    start={sliderStartTime || 0}
                    end={sliderEndTime || 0}
                    events={events}
                    onClick={onChange}
                    container={container}
                />

                <div className={styles.buttonBar}>
                    <div>
                        <PlayPauseButton
                            onClick={onClickPlay}
                            isPlaying={isPlaying}
                            disabled={disabled}
                        />
                        <StopButton onClick={onClickStop} disabled={disabled} />
                    </div>
                    <div className={styles.buttonBarCenter}>
                        <PlayerTimeStamp
                            prefix={prefix}
                            relCurrTime={relCurrTime}
                            relDuration={relDuration}
                            absCurrTime={absCurrTime}
                            currTimeFormat={currTimeFormat}
                            defaultTimeFormat={defaultTimeFormat}
                            baseTimeFormat={baseTimeFormat}
                            setTime={setTime}
                        />
                        <PureTypography
                            variant="body2"
                            className={`${styles.liveIndicator} ${
                                displayLive ? '' : styles.hidden
                            } ${isLive ? styles.isLive : ''}`}
                            onClick={onClickLive}
                        />
                    </div>
                    <div className={styles.buttonBarRight}>
                        {buttons}
                        {haveHeightmapTime && <SeekToHeightmapButton onClick={onClickSeekToHeightmap} /> }
                        {haveCostmapTime && <SeekToCostmapButton onClick={onClickSeekToCostmap} /> }
                        <FullscreenButton onClick={onClickFullScreen} isFullscreen={isFullscreen} />
                    </div>
                </div>
            </div>
        );
    }
}
