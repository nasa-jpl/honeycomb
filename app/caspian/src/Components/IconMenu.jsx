import React, { PureComponent } from 'react';
import { Popover, IconButton, Tooltip } from '@material-ui/core';
import * as styles from './styles/IconMenu.css';
import * as btnStyles from './styles/common/buttons.css';

export class IconMenu extends PureComponent {
    constructor(...args) {
        super(...args);

        this.state = {
            anchorEl: null,
        };
    }

    /* Events */
    handleClick = event => {
        this.setState({ anchorEl: event.currentTarget });
    };

    handleClose = () => {
        this.setState({ anchorEl: null });
    };

    /* Life Cycle Functions */
    render() {
        const { anchorEl } = this.state;
        const { popoverClassName, icon, children, ariaOwnsLabel, title, container, noPadding } = this.props;

        return (
            <div className={styles.root}>
                <Tooltip title={title} placement="top">
                    <IconButton
                        aria-owns={anchorEl ? ariaOwnsLabel : undefined}
                        aria-haspopup="true"
                        className={btnStyles.iconSmall}
                        onClick={this.handleClick}
                    >
                        {icon}
                    </IconButton>
                </Tooltip>
                <Popover
                    open={Boolean(anchorEl)}
                    container={container}
                    anchorEl={anchorEl}
                    anchorReference="anchorEl"
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    onClose={this.handleClose}
                    PaperProps={{
                        classes: {
                            root: `${styles.popover} ${noPadding ? styles.noPadding : ''} ${popoverClassName || ''}`,
                        },
                    }}
                    disableScrollLock={true}
                >
                    {children}
                </Popover>
            </div>
        );
    }
}
