import React from 'react';
import { LinearProgress, Typography } from '@material-ui/core';
import ErrorSnackbar from './ErrorSnackbar';
import * as styles from './styles/index.css';
import * as displayStyles from './styles/display.css';

// Displays a loading bar until everything is loaded then displays the viewer
export default function(props) {
    const { title, loadPercent, errors, onClearErrors, children } = props;
    const ratio = loadPercent || 0;
    const fullyLoaded = ratio >= 1.0;
    const loadWrapperClasses = styles.loadWrapper + ' ' + (fullyLoaded ? displayStyles.hidden : '');

    if (fullyLoaded) {
        return (
            <React.Fragment>
                <ErrorSnackbar numErrors={errors.length} clearErrors={onClearErrors} />
                {children}
            </React.Fragment>
        );
    } else {
        return (
            <div className={loadWrapperClasses}>
                <ErrorSnackbar numErrors={errors.length} clearErrors={onClearErrors} />
                <LinearProgress
                    className={styles.loadProg}
                    variant="determinate"
                    classes={{
                        colorPrimary: styles.loadProgBackground,
                        bar1Determinate: styles.loadProgBar1Determinate,
                    }}
                    value={ratio * 100}
                />
                <div className={styles.loadTitleWrapper}>
                    <Typography variant="h4" className={styles.loadTitle}>
                        {title || ''}
                    </Typography>
                </div>
            </div>
        );
    }
}
