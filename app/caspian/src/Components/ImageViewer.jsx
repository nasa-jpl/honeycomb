import React, { Component } from 'react';
import { CircularProgress, Typography } from '@material-ui/core';

export class ImageViewer extends Component {

    render() {
        const { props } = this;
        const { animator } = props;

        if (animator) {
            const imgAnnotations = animator.state.annotations;
            if (imgAnnotations) {
                return (
                    <div>
                        {imgAnnotations.map((val, idx) => {
                            if (val.cacheImgURL) {
                                return (
                                    <div key={idx} style={{ marginBottom: '8px' }}>
                                        <Typography>{val.name}</Typography>
                                        <img
                                            style={{ maxWidth: '100%' }}
                                            src={val.cacheImgURL}
                                        />
                                    </div>
                                );
                            } else {
                                return <CircularProgress key={idx} />;
                            }
                        })}
                    </div>
                );
            }
        }
        return null;
    }
}
