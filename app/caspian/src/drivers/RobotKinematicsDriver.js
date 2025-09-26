import { Driver } from '@gov.nasa.jpl.honeycomb/core';
import { MathUtils } from 'three';

function pad(str, size) {
    if (str.length < size) {
        return pad(str + ' ', size);
    } else {
        return str;
    }
}

function cleanNumbers(v) {
    let str = v.toFixed(2);
    return v < 0 ? str : ' ' + str;
}

function quat2rpyt(q) {
    const rpy = {};
    rpy.roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
    rpy.pitch = Math.asin(2 * (q.w * q.y - q.z * q.x));
    rpy.yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
    rpy.tilt = Math.abs(2 * Math.acos(Math.cos(rpy.roll / 2) * Math.cos(rpy.pitch / 2)));
    return rpy;
}

export class RobotKinematicsDriver extends Driver {
    initialize() {
        const { viewer } = this;

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.bottom = '0';
        container.style.left = '0';
        container.style.margin = '10px';
        container.style.padding = '10px';
        container.style.background = 'rgba(0, 0, 0, 0.5)';
        container.style.fontFamily = 'monospace';
        container.style.whiteSpace = 'pre';

        viewer.domElement.appendChild(container);

        viewer.tags.addTag(value => {
            container.style.display = value ? 'block' : 'none';
        }, 'kinematics-display');

        this.container = container;
    }

    update(state, diff) {
        const { options, viewer, container } = this;

        const robot = viewer.getRobot(options.robot);
        if (robot) {
            const { joints } = options;
            let rpyt = quat2rpyt(robot.quaternion);
            let str = '';
            str += `${pad('X', 20)}: ${cleanNumbers(robot.position.x)} m\n`;
            str += `${pad('Y', 20)}: ${cleanNumbers(robot.position.y)} m\n`;
            str += `${pad('Z', 20)}: ${cleanNumbers(robot.position.z)} m\n`;
            str += '\n';
            str += `${pad('ROLL', 20)}: ${cleanNumbers(rpyt.roll * MathUtils.RAD2DEG)} deg\n`;
            str += `${pad('PITCH', 20)}: ${cleanNumbers(rpyt.pitch * MathUtils.RAD2DEG)} deg\n`;
            str += `${pad('YAW', 20)}: ${cleanNumbers(rpyt.yaw * MathUtils.RAD2DEG)} deg\n`;
            str += '\n';

            for (const key of joints) {
                const joint = robot.joints[key];
                if (joint) {
                    str += `${pad(key, 20)}: ${cleanNumbers(joint.angle * MathUtils.RAD2DEG)} deg\n`;
                } else {
                    str += '\n';
                }
            }

            container.innerText = str;
            container.style.visibility = 'visible';
        } else {
            container.style.visibility = 'hidden';
        }
    }

}
