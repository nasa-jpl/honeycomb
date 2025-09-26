import React, { Component } from 'react';
import { Typography } from '@material-ui/core';
import { ArrowRight, ArrowDropDown } from '@material-ui/icons';
import { AutoFieldList } from './MaterialAutoField';
import * as styles from './styles/SceneHierarchy.css';

class HierarchyNode extends Component<any, any> {
    handleExpandClick = () => {
        const props = this.props;
        props.onExpandClick(props.info);
    };

    handleMouseEnter = () => {
        const props = this.props;
        const onMouseEnter = props.onMouseEnter;
        if (onMouseEnter) {
            onMouseEnter(props.info);
        }
    };

    handleMouseLeave = () => {
        const props = this.props;
        const onMouseLeave = props.onMouseLeave;
        if (onMouseLeave) {
            onMouseLeave(props.info);
        }
    };

    handleClick = () => {
        const props = this.props;
        const onClick = props.onClick;
        if (onClick) {
            onClick(props.info);
        }
    };

    render() {
        const info = this.props.info;
        const hiddenStyle = info.isLeaf ? styles.hidden : '';
        return (
            <Typography
                style={{ paddingLeft: `${info.depth * 10}px` }}
                className={styles.item}
                key={info.key}
                onMouseEnter={this.handleMouseEnter}
                onMouseLeave={this.handleMouseLeave}
            >
                {info.expanded ? (
                    <ArrowDropDown
                        className={`${styles.arrow} ${hiddenStyle}`}
                        onClick={this.handleExpandClick}
                    />
                ) : (
                    <ArrowRight
                        className={`${styles.arrow} ${hiddenStyle}`}
                        onClick={this.handleExpandClick}
                    />
                )}
                <span onClick={this.handleClick}>{info.name}</span>
            </Typography>
        );
    }
}

export class SceneHierarchyComponent extends Component<any, any> {
    selected: boolean = false;

    onExpandClick = info => {
        const hierarchy = this.props.hierarchy;
        hierarchy.setExpanded(info.object, !info.expanded);
        this.forceUpdate();
    };

    render() {
        const { hierarchy, onMouseEnter, onMouseLeave } = this.props;
        const selected = this.selected;

        hierarchy.update();

        let detailedInfo = null;
        let detailedList = null;
        if (selected) {
            const info = hierarchy.getInfo(selected);
            detailedInfo = hierarchy.getDetails(selected);
            detailedList = (
                <div style={{ flex: 1, padding: '10px', overflow: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                    <Typography>{info.name}</Typography>
                    <AutoFieldList
                        items={detailedInfo}
                        style={{ display: 'block', margin: '10px', width: '100%' }}
                    ></AutoFieldList>
                </div>
            );
        }

        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
                    {hierarchy.displayList.map(info => (
                        <HierarchyNode
                            info={info}
                            onExpandClick={this.onExpandClick}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            onClick={info => {
                                this.selected = info.object;
                                this.forceUpdate();
                            }}
                            key={info.key}
                        />
                    ))}
                </div>
                {detailedList}
            </div>
        );
    }
}
