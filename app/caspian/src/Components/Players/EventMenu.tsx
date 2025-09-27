import React, { useState } from 'react';
import { Event, Search, Clear } from '@material-ui/icons';
import {
    List,
    ListItem,
    ListItemText,
    TextField,
    InputAdornment,
    IconButton,
} from '@material-ui/core';

import { IconMenu } from '../IconMenu';
import { DisplayTime } from '../Common';
import { useEventMarkerSet } from '../EventMarker';
import * as styles from './styles/index.css';

export default function EventMenu(props) {
    const [filter, setFilter] = useState('');
    const { events, setTime, container } = props;

    const handleInputUpdate = evt => {
        setFilter(evt.target.value);
    };
    const clearFilter = evt => {
        setFilter('');
    };

    const evtList = events.reduce((acc, evtBlock) => {
        let newList = evtBlock.state.events;
        if (filter) {
            newList = newList.filter(evt => {
                return evt.name.toLowerCase().includes(filter.toLowerCase());
            });
        }

        return acc.concat(newList);
    }, []);

    return (
        <IconMenu
            noPadding={true}
            icon={<Event />}
            ariaOwnsLabel="EventsMenu"
            popoverClassName={styles.evtMenuPopover}
            title="Sequence Events"
            container={container}
        >
            <div className={styles.evtFilterWrap}>
                <TextField
                    id="evt-filter"
                    placeholder="Filter"
                    value={filter}
                    variant="outlined"
                    className={styles.evtFilter}
                    margin="dense"
                    onChange={handleInputUpdate}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="Clear"
                                    className={styles.inputClearBtn}
                                    onClick={clearFilter}
                                >
                                    <Clear fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </div>
            <List component="nav" className={styles.evtMenuList}>
                {evtList.map((evt, i) => (
                    <ListItem
                        key={`evt_item_${i}`}
                        button={true}
                        onClick={() => setTime(evt.startTime)}
                        onMouseOver={() => useEventMarkerSet(evt.startTime)}
                        onMouseOut={() => useEventMarkerSet(null)}
                    >
                        <ListItemText
                            primary={evt.name}
                            secondary={
                                <React.Fragment>
                                    <DisplayTime
                                        seconds={evt.endTime - evt.startTime}
                                        humanReadable={true}
                                    />
                                </React.Fragment>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        </IconMenu>
    );
}
