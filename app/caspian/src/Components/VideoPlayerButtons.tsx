import React, { PureComponent } from 'react';
import { PlayArrow, Pause, Fullscreen, FullscreenExit, Stop, Map, BurstMode } from '@material-ui/icons';
import { IconButton, Tooltip } from '@material-ui/core';
import * as btnStyles from './styles/common/buttons.css';

export class FullscreenButton extends PureComponent<any, any> {
    render() {
        const { isFullscreen, onClick } = this.props;
        const fsButton = isFullscreen ? <FullscreenExit /> : <Fullscreen />;
        return (
            <Tooltip title="Fullscreen" placement="top">
                <IconButton className={btnStyles.iconSmall} onClick={onClick}>
                    {fsButton}
                </IconButton>
            </Tooltip>
        );
    }
}

export class PlayPauseButton extends PureComponent<any, any> {
    render() {
        const { isPlaying, onClick } = this.props;
        const playButton = isPlaying ? <Pause /> : <PlayArrow />;
        return (
            <IconButton className={btnStyles.iconSmall} onClick={onClick}>
                {playButton}
            </IconButton>
        );
    }
}

export class StopButton extends PureComponent<any, any> {
    render() {
        const { onClick } = this.props;
        return (
            <IconButton className={btnStyles.iconSmall} onClick={onClick}>
                <Stop />
            </IconButton>
        );
    }
}

export class SeekToHeightmapButton extends PureComponent<any, any> {
    render() {
        const { onClick } = this.props;
        return (
            <Tooltip title="Seek to next Heightmap" placement="top">
                <IconButton className={btnStyles.iconSmall} onClick={onClick}>
                    <BurstMode />
                </IconButton>
            </Tooltip>
        );
    }
}

export class SeekToCostmapButton extends PureComponent<any, any> {
    render() {
        const { onClick } = this.props;
        return (
            <Tooltip title="Seek to next Costmap" placement="top">
                <IconButton className={btnStyles.iconSmall} onClick={onClick}>
                    <Map />
                </IconButton>
            </Tooltip>
        );
    }
}
