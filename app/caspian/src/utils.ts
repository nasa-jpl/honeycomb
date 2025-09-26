

function getDefaultConfig(): any {
    return {
        title: 'Caspian',
        robots: [],
        telemetry: [],
        terrain: [],
        drivers: [
            {
                type: 'RksmlDriver',
                options: {
                    robot: 'm2020',
                    telemetry: 'rksml',
                    paths: ['RF_DRIVE', 'LF_DRIVE'],
                    positionMap: {
                        x: 'ROVER_X',
                        y: 'ROVER_Y',
                        z: 'ROVER_Z',
                        qx: 'QUAT_X',
                        qy: 'QUAT_Y',
                        qz: 'QUAT_Z',
                        qw: 'QUAT_C',
                    },
                },
            },
            {
                type: 'RobotKinematicsDriver',
                options: {
                    robot: 'm2020',
                    joints: [
                        'LF_STEER',
                        'LR_STEER',
                        'LEFT_BOGIE',
                        'LEFT_DIFFERENTIAL',
                        '',
                        'RF_STEER',
                        'RR_STEER',
                        'RIGHT_BOGIE',
                        'RIGHT_DIFFERENTIAL',
                    ],
                },
            },
        ],
        options: {
            up: '-Z',
            lightDirection: [1, -1, 1],
            renderer: {
                antialias: false,
            },
            note: 'uplink',
            playbackSpeed: 1,
            showColorLegend: true,
            displayAbsoluteTime: true,
            editTimeWindow: true,
            baseTimeFormat: 'SCLK',
            settings: {
                'View': [
                    {
                        'label': 'Rover',
                        'tag': 'robot',
                        'default': true,
                        'shortcut': 'R',
                    },
                    {
                        'label': 'Display Kinematics',
                        'tag': 'kinematics-display',
                        'default': true,
                    },
                    {
                        'label': 'Drive Tracks',
                        'tag': 'drive-tracks',
                        'default': true,
                    },
                ],
                'ENav': [
                    {
                        'label': 'Cost Map',
                        'tag': 'costmap',
                        'default': true,
                        'shortcut': 'C',
                        'lockable': true,
                    },
                    {
                        'label': 'Cost Map Grid',
                        'tag': 'costmap-grid',
                        'default': false,
                    },
                    {
                        'label': 'Cell Global Pos Error',
                        'tag': 'cell-global-pos-error',
                        'default': false,
                        'shortcut': 'E',
                    },
                    {
                        'label': 'Is Dilated',
                        'tag': 'is-dilated',
                        'default': false,
                        'shortcut': 'D',
                    },
                    {
                        'label': 'Heightmap',
                        'tag': 'heightmap',
                        'default': true,
                        'shortcut': 'H',
                        'lockable': true,
                    },
                    {
                        'label': 'Heightmap Grid',
                        'tag': 'heightmap-grid',
                        'default': false,
                        'shortcut': 'G',
                    },
                ],
                'Rendering': [
                    {
                        'label': 'Topographic Lines',
                        'tag': 'topo-lines',
                        'default': true,
                    },
                    {
                        'label': 'Steepness Highlight',
                        'tag': 'steepness-color',
                        'default': true,
                    },
                ],
            },
        },
    };
}

export { getDefaultConfig };
