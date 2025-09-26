import React, { Component } from 'react';
import { Typography } from '@material-ui/core';
import { Help } from '@material-ui/icons';

import * as landingStyles from './landing.css';
import { BugIcon } from '../CustomIcons';

export class GettingStarted extends Component {
    render() {
        const bugHyperlink = (
            <a
                className={landingStyles.link}
                href="https://github.com/nasa-jpl/honeycomb/issues/new?assignees=&labels=bug&template=---bug-report.md&title="
                target="_blank"
            >
                File a bug
            </a>
        );

        const githubHyperlink = (
            <a
                className={landingStyles.link}
                href="https://github.com/nasa-jpl/honeycomb"
                target="_blank"
            >
                visit our github
            </a>
        );

        return (
            <div style={{ padding: '8px' }}>
                <div style={{ padding: '8px' }}>
                    <Typography variant="h2" color="textPrimary">
                        Getting started with Honeycomb
                    </Typography>
                </div>
                <div style={{ display: 'flex', padding: '8px' }}>
                    <Help className={landingStyles.helpIcon} />
                    <Typography variant="body1" color="textSecondary">
                            We're #honeycomb-support -- {githubHyperlink}!
                    </Typography>
                </div>
                <div style={{ display: 'flex', padding: '8px' }}>
                    <div>
                        <BugIcon className={landingStyles.bugIcon} />
                    </div>
                    <div>
                        <Typography variant="body1" color="textSecondary">
                            {bugHyperlink} or {githubHyperlink} repo.
                        </Typography>
                    </div>
                </div>
            </div>
        );
    }
}
