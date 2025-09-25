import React, { Component } from 'react';
import { formatDistanceToNow } from 'date-fns';
import * as styles from './styles/LiveConnection.css';

export class ConnectionIndicator extends Component {
    constructor(...args) {
        super(...args);
        this.state = {
            displayTime: '',
        };
        this._rafHandle = - 1;
    }

    componentDidMount() {
        const _do = () => {
            this._rafHandle = requestAnimationFrame(_do);

            const { connectionChangeTime = null } = this.props;
            if (connectionChangeTime === null ) {
                return;
            }

            const time = formatDistanceToNow(connectionChangeTime);
            this.setState({
                displayTime: time,
            });
        };
        requestAnimationFrame(_do);
    }

    componentWillUnmount() {
        cancelAnimationFrame(this._rafHandle);
    }

    render() {
        const {
            connected = false,
            connectionChangeTime = null,
            hostName = '',
        } = this.props;
        let {
            displayTime,
        } = this.state;

        if (connectionChangeTime === null) {
            displayTime = '';
        }

        let className = styles.connectedIndicator;
        let displayText = 'Disconnected';
        if (hostName) {
            displayText += ` from ${hostName} `;
        }

        if (connected) {
            className += ` ${styles.connected}`;
            displayText = 'Connected';
            if (hostName) {
                displayText += ` to ${hostName} `;
            }
        } else if(displayTime) {
            displayText += ` ${displayTime} ago`;
        }

        return <div className={className}>{displayText}</div>;
    }
}
