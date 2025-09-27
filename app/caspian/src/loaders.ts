import { Loaders } from '@gov.nasa.jpl.honeycomb/core';

import { loadRKSML } from './telemetry/loadRKSML';
import { loadARKSML } from './telemetry/loadARKSML';
import { loadM20EnavArksml } from './telemetry/loadM20EnavArksml';
import { loadM20EnavImgs } from './telemetry/loadM20EnavImgs';

export function registerCaspianLoaders() {
    Loaders.registerDriver('EnavArksmlDriver', async (options, manager) => {
        const { EnavArksmlDriver } = await import('./drivers/EnavArksmlDriver');
        return new EnavArksmlDriver(options, manager);
    });

    Loaders.registerTelemetryAnimatorLoader('m20-enav-arksml', loadM20EnavArksml);

    Loaders.registerTelemetryAnimatorLoader('m20-enav-imgs', loadM20EnavImgs);

    Loaders.registerDriver('RksmlDriver', async (options, manager) => {
        const { RksmlDriver } = await import('./drivers/RksmlDriver');
        return new RksmlDriver(options, manager);
    });

    Loaders.registerDriver('RobotKinematicsDriver', async (options, manager) => {
        const { RobotKinematicsDriver } = await import('./drivers/RobotKinematicsDriver');
        return new RobotKinematicsDriver(manager, options);
    });

    Loaders.registerDriver('ArksmlDriver', async (options, manager) => {
        const { ArksmlDriver } = await import('./drivers/ArksmlDriver');
        return new ArksmlDriver(options, manager);
    });

    Loaders.registerDriver('MarsSkyDriver', async (options, manager) => {
        const { MarsSkyDriver } = await import('./drivers/MarsSkyDriver');
        return new MarsSkyDriver(options, manager);
    });

    Loaders.registerTelemetryAnimatorLoader('rksml', loadRKSML);
    Loaders.registerTelemetryAnimatorLoader('arksml', loadARKSML);
}
