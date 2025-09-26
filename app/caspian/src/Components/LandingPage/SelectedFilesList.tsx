import { Component } from 'react';
import {
    Button,
    Typography,
} from '@material-ui/core';

import { TelemFile } from '../WelcomeScreen/TelemFile';
import * as landingStyles from './landing.css';

export class SelectedFilesList extends Component<any, any> {
    render() {
        const { selectedFiles, removeTelemFile, handleGoClicked } = this.props;

        const selectedList = selectedFiles.length > 0 ? selectedFiles.map((elem, index) => {
            return (
                <TelemFile
                    key={index}
                    fileName={elem.name}
                    fullName={elem.full_name}
                    removeTelemFile={removeTelemFile}
                />
            );
        }) : null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flexGrow: 0, padding: '8px' }}>
                    <Typography variant="h2" color="textPrimary">
                        Add your telemetry data
                    </Typography>
                </div>
                <div className={landingStyles.selectedFilesList}>
                    {selectedList}
                </div>
                <div style={{ flexGrow: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                        <Button
                            disabled={selectedFiles.length === 0}
                            color="secondary"
                            variant="contained"
                            onClick={handleGoClicked}
                        >
                            GO
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
