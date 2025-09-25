import React, { PureComponent } from 'react';
import { Snackbar, SnackbarContent, IconButton } from '@material-ui/core';
import { Error, Close } from '@material-ui/icons';

import * as snackbarStyles from './styles/snackbar.css';

export default class extends PureComponent {
    render() {
        const { numErrors, clearErrors } = this.props;

        return (
            <Snackbar
                open={numErrors !== 0}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                className={snackbarStyles.root}
            >
                <SnackbarContent
                    className={snackbarStyles.error}
                    message={
                        <span className={snackbarStyles.content}>
                            <Error className={snackbarStyles.icon} />
                            <span
                                className={snackbarStyles.text}
                            >{`${numErrors} errors occured! Open the console for more details.`}</span>
                        </span>
                    }
                    action={[
                        <IconButton
                            key="close"
                            aria-label="close"
                            color="inherit"
                            onClick={clearErrors}
                        >
                            <Close className={snackbarStyles.icon} />
                        </IconButton>,
                    ]}
                />
            </Snackbar>
        );
    }
}
