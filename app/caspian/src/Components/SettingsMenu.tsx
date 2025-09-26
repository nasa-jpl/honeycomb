import React, { Component } from 'react';
import { Tabs, Tab, Button, Typography, Divider, withStyles, Grow } from '@material-ui/core';
import { Settings } from '@material-ui/icons';
import { IconMenu } from './IconMenu';
import { AutoFieldList } from './MaterialAutoField';

import * as styles from './styles/SettingsMenu.css';

const LeftAlignedTab = withStyles({
    wrapper: {
        alignItems: 'flex-start',
    },
})(Tab);

export class SettingsMenu extends Component<any, any> {
    constructor(props) {
        super(props);

        this.state = {
            currentTab: 0,
        };
    }

    handleTabChange = (event, newValue) => {
        this.setState({ currentTab: newValue });
    }

    openGithub = () => {
        window.open('https://github.com/nasa-jpl/honeycomb', '_blank');
    };

    submitBug = () => {
        window.open('https://github.com/nasa-jpl/honeycomb/issues/new?assignees=&labels=bug&template=---bug-report.md&title=', '_blank');
    }

    render() {
        const {
            container,
            settings,
        } = this.props;

        const {
            currentTab,
        } = this.state;

        const settingsKeys = Object.keys(settings);
        const tabs = settingsKeys.map((val, index) => {
            return (
                <LeftAlignedTab label={val} key={index} />
            );
        });

        const submenus = settingsKeys.map((key, index) => {
            return (
                <div hidden={currentTab !== index} key={index}>
                    <div className={styles.submenu}>
                        <AutoFieldList
                            container={container}
                            className={styles.submenuItem}
                            items={settings[key]}
                        />
                    </div>
                </div>
            );
        });

        if (!('Help' in settings)) {
            tabs.push((
                <LeftAlignedTab label="Help" key={tabs.length} />
            ));

            submenus.push((
                <div hidden={currentTab !== submenus.length} key={submenus.length}>
                    <div className={styles.submenu}>
                        <Button
                            className={styles.submenuItem}
                            variant="outlined"
                            fullWidth
                            onClick={this.openGithub}>
                            Github
                        </Button>
                        <Button
                            className={styles.submenuItem}
                            variant="outlined"
                            fullWidth
                            onClick={this.submitBug}>
                            Submit Bug
                        </Button>
                        {window.env?.version ?
                            <Typography
                                variant="caption"
                                className={`${styles.submenuItem} ${styles.gitHash}`}
                            >
                                <span>Rev</span>
                                <span>{window.env.version}</span>
                            </Typography> :
                            null}
                    </div>
                </div>
            ));
        }

        return (
            <IconMenu
                icon={<Settings />}
                title="Settings"
                container={container}
            >
                <div className={styles.root}>
                    <div className={styles.leftColumn}>
                        <Typography>Settings</Typography>
                        <Divider />
                        {/* Need <Grow> to correctly resize tab indicator */}
                        <Grow in={true}>
                            <Tabs
                                orientation="vertical"
                                variant="scrollable"
                                scrollButtons="auto"
                                value={currentTab}
                                onChange={this.handleTabChange}
                            >
                                {tabs}
                            </Tabs>
                        </Grow>
                    </div>
                    <div className={styles.midColumn}>
                        <Divider orientation="vertical" />
                    </div>
                    <div className={styles.rightColumn}>
                        {submenus}
                    </div>
                </div>
            </IconMenu>
        );
    }
}
