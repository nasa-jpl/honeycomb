import React from 'react';
import { IconButton, Typography } from '@material-ui/core';
import { PlayArrow } from '@material-ui/icons';
import * as styles from './styles/index.css';

export default function(props) {
    const { title, onClickPlay } = props;
    const loadWrapperClasses = styles.loadWrapper;
    return (
        <div className={loadWrapperClasses}>
            <IconButton className={styles.loadPlayBtn} onClick={onClickPlay}>
                <PlayArrow className={styles.loadPlayBtnIcon} />
            </IconButton>
            <div className={styles.loadTitleWrapper}>
                <Typography variant="h4" className={styles.loadTitle}>
                    {title || ''}
                </Typography>
            </div>
        </div>
    );
}
