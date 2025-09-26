import React, { PureComponent } from 'react';
import { PureTypography } from './Common';
import * as styles from './styles/PlayerTimeStamp.css';

export class PlayerTimeStamp extends PureComponent<any, any> {
    constructor(props) {
        super(props);
        this.state = {
            editingTime: false,
            timeValue: '',
        };
    }

    handleChange = e => {
        this.setState({ timeValue: e.target.value });
    };

    handleOnFocus = e => {
        const { absCurrTime } = this.props;
        this.setState({ editingTime: true, timeValue: absCurrTime });
    };

    handleOnBlur = e => {
        const { setTime } = this.props;

        const updatedTime = parseFloat(this.state.timeValue);
        if (!isNaN(updatedTime)) {
            setTime(updatedTime);
        }
        this.setState({ editingTime: false });
    };

    handleOnKeyDown = e => {
        e.stopPropagation();
        // Enter was pressed
        if (e.keyCode === 13) {
            const { setTime } = this.props;

            const updatedTime = parseFloat(this.state.timeValue);
            if (!isNaN(updatedTime)) {
                setTime(updatedTime);
            }
            this.setState({ editingTime: false });
            e.target.blur();
        }
    };

    render() {
        const {
            prefix,
            relCurrTime,
            relDuration,
            absCurrTime,
            currTimeFormat = '',
            baseTimeFormat = '',
        } = this.props;

        const prefixEl = prefix ? (
            <React.Fragment>
                <PureTypography variant="body2" className={styles.prefix} label={prefix} />
                <span className={styles.prefixTimeSep}>·</span>
            </React.Fragment>
        ) : (
            <React.Fragment />
        );

        const timeDisplay = this.state.editingTime ? this.state.timeValue : absCurrTime;
        let absTimeComponents = null;
        if (timeDisplay || timeDisplay === '') {
            absTimeComponents = <><input
                type="text"
                size={timeDisplay.length + 2}
                className={styles.absTime}
                value={timeDisplay}
                disabled={currTimeFormat !== baseTimeFormat}
                onChange={this.handleChange}
                onFocus={this.handleOnFocus}
                onBlur={this.handleOnBlur}
                onKeyDown={this.handleOnKeyDown}
            />
                <PureTypography
                    variant="body2"
                    className={styles.absTimeFormat}
                    label={currTimeFormat}
                /></>;
        }

        return (
            <div className={styles.root}>
                {prefixEl}
                {absTimeComponents}
                <PureTypography
                    variant="body2"
                    className={styles.relCurrTime}
                    label={relCurrTime}
                />
                <span className={styles.playTimeSep}>/</span>
                <PureTypography
                    variant="body2"
                    className={styles.relDuration}
                    label={relDuration}
                />
            </div>
        );
    }
}
