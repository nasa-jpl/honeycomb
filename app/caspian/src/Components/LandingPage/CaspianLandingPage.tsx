import { Component } from 'react';
import { Typography, Snackbar, SnackbarContent } from '@material-ui/core';
import { Error } from '@material-ui/icons';

import { GettingStarted } from './GettingStarted';
import { SelectedFilesList } from './SelectedFilesList';

import { appVersion } from '../version';
import { buildAndLoadConfigFromSelectFiles } from '../../index';

import * as landingStyles from './landing.css';

const LOCAL_STORAGE_KEY = 'honeycomb-settings';

export class CaspianLandingPage extends Component<any, any> {
    constructor(props) {
        super(props);

        const prevSavedSettingsString = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        let metaKernel = null;
        if (prevSavedSettingsString) {
            const savedSettings = JSON.parse(prevSavedSettingsString);
        }

        this.state = {
            selectedFiles: metaKernel ? [metaKernel] : [],
        };
    }

    removeTelemFile = (filename) => {
        const index = this.state.selectedFiles.findIndex(val => {
            return val.full_name === filename;
        });
        if (index !== -1) {
            const prevFiles = Array.from(this.state.selectedFiles);
            prevFiles.splice(index, 1);
            this.setState({ selectedFiles: prevFiles });
        }
    };

    selectTelemFile = (val) => {
        const { selectedFiles } = this.state;
        if (!selectedFiles.includes(val)) {
            const prevFiles = Array.from(selectedFiles);
            prevFiles.push(val);

            this.setState({ selectedFiles: prevFiles });
        }
    };

    handleGoClicked = () => {
        const { selectedFiles } = this.state;

        let permalink = window.location.origin + '?';
        for (let i = 0; i < selectedFiles.length; i++) {
            permalink = permalink + `selectedFiles=${selectedFiles[i].dataset_id}&`;
        }
        history.pushState(null, '', permalink);
        buildAndLoadConfigFromSelectFiles(selectedFiles);
    };

    render() {
        const { malformedURL } = this.props;
        const { selectedFiles } = this.state;

        return (
            <div className={landingStyles.root}>
                <div className={landingStyles.main}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '8px' }}>
                        <div style={{ flexGrow: 0, padding: '8px' }}>
                            <div>
                                <Typography variant="h1" color="textPrimary">
                                    Caspian - Powered by Honeycomb
                                </Typography>
                            </div>
                            <div>
                                <Typography variant="subtitle1" color="textSecondary">
                                    {(window as any).env?.version || appVersion}
                                </Typography>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1, padding: '8px' }}>
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', maxWidth: '50%', padding: '8px' }}>
                                <div style={{ height: '50%', padding: '8px' }}>
                                    <SelectedFilesList
                                        selectedFiles={selectedFiles}
                                        removeTelemFile={this.removeTelemFile}
                                        handleGoClicked={this.handleGoClicked}
                                    />
                                </div>
                                <div style={{ height: '50%', padding: '8px' }}>
                                </div>
                            </div>
                            <div style={{ flexGrow: 1, maxWidth: '50%', padding: '8px' }}>
                                <GettingStarted />
                            </div>
                        </div>
                    </div>
                </div>
                <Snackbar
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    open={malformedURL}
                >
                    <SnackbarContent
                        className={landingStyles.snackbarError}
                        message={
                            <span className={landingStyles.snackbarContent}>
                                <Error className={landingStyles.snackbarIcon} />
                                <span className={landingStyles.snackbarText}>
                                    Could not load URL configuration!<br />
                                    Please check if you've copied the original link correctly
                                    or manually search for files.
                                </span>
                            </span>
                        }
                    />
                </Snackbar>
            </div>
        );
    }
}
