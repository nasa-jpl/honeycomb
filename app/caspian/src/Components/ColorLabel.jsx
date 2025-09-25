import { Typography } from '@material-ui/core';

export function ColorLabel(props) {
    const { color, label } = props;

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ background: color, width: 25, height: 25, margin: 5 }}> </div>
            <Typography style={{ marginLeft: 5, marginRight: 5 }}>{label}</Typography>
        </div>
    );
}
