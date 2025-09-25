import React, { PureComponent } from 'react';
import { Typography } from '@material-ui/core';
import { secondsToDisplayTime } from './utils/timeUtils.js';

export class PureTypography extends PureComponent {
    render() {
        const { variant, className, label, ...rest } = this.props;
        return (
            <Typography variant={variant} className={className} {...rest}>
                {label}
            </Typography>
        );
    }
}

export class DisplayTime extends PureComponent {
    render() {
        const { seconds, humanReadable } = this.props;
        const label = secondsToDisplayTime(seconds, humanReadable);
        return <React.Fragment>{label}</React.Fragment>;
    }
}
