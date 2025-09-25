import React from 'react';
import PropTypes from 'prop-types';
import {
    Select,
    Input,
    MenuItem,
    Slider,
    Switch,
    FormControlLabel,
    FormControl,
    InputLabel,
    Typography,
    Checkbox,
} from '@material-ui/core';
import { Lock, LockOpen } from '@material-ui/icons';

function AutoField(props) {
    const {
        value,
        min,
        max,
        step,
        options,
        onChange,
        onBlur,
        container,
        label,
        style,
        name,
        className,
        readOnly,
        shortcut,
        lockable,
        lockValue,
        lockOnChange,
        disabled,
    } = props;

    if (value === undefined) {
        throw new Error(`AutoField: Property 'value' for '${label}' must be defined`);
    }

    let type = 'input';
    let control;
    if (options !== undefined) {
        if (Array.isArray(options)) {
            control = (
                <Select
                    value={value}
                    onChange={onChange}
                    MenuProps={{ container }}
                    inputProps={{ name }}
                    readOnly={readOnly}
                >
                    {options.map(opt => (
                        <MenuItem key={opt} value={opt}>
                            {opt}
                        </MenuItem>
                    ))}
                </Select>
            );
        } else {
            control = (
                <Select
                    value={value}
                    onChange={onChange}
                    MenuProps={{ container }}
                    inputProps={{ name }}
                    readOnly={readOnly}
                >
                    {Object.keys(options).map(key => (
                        <MenuItem key={key} value={options[key]}>
                            {key}
                        </MenuItem>
                    ))}
                </Select>
            );
        }
    } else if (typeof value === 'boolean') {
        type = 'controlLabel';
        control = (
            <Switch checked={value} onChange={onChange} inputProps={{ name }} 
                readOnly={readOnly} disabled={disabled} />
        );
    } else if (typeof value === 'number') {
        if (min !== undefined && max !== undefined) {
            type = 'slider';
            control = (
                <Slider
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={onChange}
                    style={{ margin: '15px 0' }}
                    readOnly={readOnly}

                    // TOOD: Figure out how to propagate the name
                    // onto the slider element so it can be tracked
                    // in the event
                    // inputProps={{ name }}
                />
            );
        } else {
            control = (
                <Input
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    type="number"
                    // step={step}
                    inputProps={{ name, style: { height: 'auto' } }}
                    readOnly={readOnly}
                />
            );
        }
    } else {
        control = (
            <Input
                value={value}
                onChange={onChange}
                // step={step}
                inputProps={{ name }}
                readOnly={readOnly}
            />
        );
    }

    // TODO: If there's not label provided then don't wrap the element?
    switch (type) {
        case 'input':
            return (
                <FormControl key={label} style={style} className={className}>
                    <InputLabel shrink>{label}</InputLabel>
                    {control}
                </FormControl>
            );
        case 'controlLabel':
            return (
                <div style={ { display: 'flex', justifyContent: 'space-between' } }>
                    <FormControlLabel
                        key={label}
                        label={label}
                        control={control}
                        style={style}
                        className={className}
                    />
                    {lockable ?
                        <Checkbox
                            checked={lockValue}
                            icon={<LockOpen />}
                            checkedIcon={<Lock />}
                            onChange={lockOnChange}
                        />
                        : null
                    }
                    {shortcut ? <Typography style={{ marginTop: 'auto', marginBottom: 'auto' }}>{shortcut}</Typography> : null}
                </div>
            );
        case 'slider':
            return (
                <FormControl key={label} style={style} className={className}>
                    <Typography>{label}</Typography>
                    {control}
                </FormControl>
            );
        default:
            return null;
    }
}

function AutoFieldList(props) {
    const { items, container, style, className } = props;

    return (
        <React.Fragment>
            {items.map(item => (
                <AutoField
                    {...item}
                    container={container}
                    key={item.label}
                    style={style}
                    className={className}
                />
            ))}
        </React.Fragment>
    );
}

const itemProps = {
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.bool]),
    label: PropTypes.string.isRequired,
    options: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.number,
    onChange: PropTypes.func,
    name: PropTypes.string,
    readOnly: PropTypes.bool,
};

AutoField.propTypes = {
    ...itemProps,
    container: PropTypes.object,
    style: PropTypes.object,
    className: PropTypes.string,
};

AutoFieldList.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape(itemProps)).isRequired,
    container: PropTypes.object,
    style: PropTypes.object,
    className: PropTypes.string,
};

export { AutoField, AutoFieldList };
