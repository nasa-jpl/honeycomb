import { ArksmlLoader, parsePosition, parseRMCSite } from '@gov.nasa.jpl.honeycomb/arksml-loader';

function parseEnavDpRoverPose(node) {
    return {
        position: parsePosition(node.querySelector('Position')),
        heading: parseFloat(node.querySelector('Heading').innerHTML),
        tilt: parseFloat(node.querySelector('Tilt').innerHTML),
        distancePredictedPosition: parseFloat(
            node.querySelector('DistancePredictedPosition').innerHTML,
        ),
        distancePredictedHeading: parseFloat(
            node.querySelector('DistancePredictedHeading').innerHTML,
        ),
        globalPositionError: parseFloat(node.querySelector('GlobalPositionError').innerHTML),
    };
}

function parseEnavDpGrid(node) {
    return {
        position: parsePosition(node.querySelector('Position')),
        resolution: parseFloat(node.querySelector('Resolution').innerHTML),
        radius: parseFloat(node.querySelector('Radius').innerHTML),
        numCells: parseInt(node.querySelector('NumCells').innerHTML),
    };
}

function parseEnavAnalyzeTerrainInput(node) {
    return {
        position: parsePosition(node.querySelector('Position')),
        heading: parseFloat(node.querySelector('Heading').innerHTML),
        globalPositionError: parseFloat(node.querySelector('GlobalPositionError').innerHTML),
        navlibPathMode: node.querySelector('NavlibPathMode').innerHTML,
        isUsingVO: node.querySelector('IsUsingVO').innerHTML === 'TRUE',
        source: node.getAttribute('Source'),
    };
}

function parseEnavHeightmap(node) {
    const siteDrive = parseRMCSite(node);
    return {
        ...siteDrive,
        enavDpGrid: parseEnavDpGrid(node.querySelector('EnavDpGrid')),
        file: node.querySelector('File').getAttribute('Path'),
        source: node.getAttribute('Source'),
    };
}

function parseEnavCostmap(node) {
    return {
        enavDpGrid: parseEnavDpGrid(node.querySelector('EnavDpGrid')),
        file: node.querySelector('File').getAttribute('Path'),
        source: node.getAttribute('Source'),
    };
}


export class EnavArksmlLoader extends ArksmlLoader {
    constructor(parsers = {}) {
        parsers = Object.assign(
            {
                EnavDpRoverPose: parseEnavDpRoverPose,
                EnavAnalyzeTerrainInput: parseEnavAnalyzeTerrainInput,
                EnavHeightmap: parseEnavHeightmap,
                EnavCostmap: parseEnavCostmap,
            },
            parsers,
        );

        super(parsers);
    }

    preprocessFrames(rawSpans, rawEvents, name) {
        // extract all of the EnavDp2DPose from rawSpans
        // and remove them from rawSpans
        const allEnavDp2DPose = [];
        for (let i = 0, l = rawSpans.length; i < l; i++) {
            const { startTime, endTime, annotations } = rawSpans[i];
            const dpIndex = annotations.findIndex(elem => {
                return elem.type === 'EnavDp2DPose';
            });

            if (dpIndex >= 0) {
                const enavDp2DPose = {
                    startTime: startTime,
                    endTime: endTime,
                    pose: annotations[dpIndex],
                };
                annotations.splice(dpIndex, 1);

                allEnavDp2DPose.push(enavDp2DPose);
            }
        }

        // prune out rawSpans with annotations.length === 0
        let index = 0;
        while(index < rawSpans.length) {
            if (rawSpans[index].annotations.length === 0) {
                rawSpans.splice(index, 1);
            } else {
                index++;
            }
        }

        if (allEnavDp2DPose.length > 0) {

            // probably already sorted but just in case make sure times are sorted by startTime
            allEnavDp2DPose.sort((a, b) => {
                return a.startTime - b.startTime;
            });

            // there's probably a lot of duplicates, remove dupes
            const duplicates = [];
            let currIndex = 0;
            for (let i = 1, l = allEnavDp2DPose.length; i < l; i++) {
                const prev = allEnavDp2DPose[currIndex];
                const curr = allEnavDp2DPose[i];

                if (prev.pose.x !== curr.pose.x ||
                prev.pose.y !== curr.pose.y ||
                prev.pose.yaw !== curr.pose.yaw) {
                    duplicates.push([currIndex, i - 1]);
                    currIndex = i;
                }
            }
            duplicates.push([currIndex, allEnavDp2DPose.length - 1]);

            const uniqueEnavDp2DPose = [];
            for (let i = 0, l = duplicates.length; i < l; i++) {
                const dupe = duplicates[i];
                uniqueEnavDp2DPose.push({
                    startTime: allEnavDp2DPose[dupe[0]].startTime,
                    endTime: allEnavDp2DPose[dupe[1]].endTime,
                    pose: allEnavDp2DPose[dupe[0]].pose,
                });
            }

            for (let i = 0, l = rawSpans.length; i < l; i++) {
            // find corresponding enavDp2DPose
                const { startTime, annotations } = rawSpans[i];
                let foundIndex = -1;
                for (let j = 0, ll = uniqueEnavDp2DPose.length; j < ll; j++) {
                    const currPose = uniqueEnavDp2DPose[j];
                    if (startTime >= currPose.startTime && startTime <= currPose.endTime) {
                        foundIndex = j;
                    }
                }

                if (foundIndex >= 0) {
                // add EnavDp2DPose to each of the relevant annotations
                    const foundPose = uniqueEnavDp2DPose[foundIndex];
                    annotations.forEach(val => {
                        val.mapFrame = foundPose.pose;
                    });
                } else {
                    if (startTime <= uniqueEnavDp2DPose[0].startTime) {
                        annotations.forEach(val => {
                            val.mapFrame = uniqueEnavDp2DPose[0].pose;
                        });
                    } else {
                        console.error('Could not find matching EnavDp2DPose');
                    }
                }
            }
        }
    }
}
