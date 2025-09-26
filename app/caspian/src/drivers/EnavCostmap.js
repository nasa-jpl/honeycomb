import { DataTexture, RGBAFormat, UnsignedByteType, Group } from 'three';
import { tempVec3, tempScale, tempQuat, tempMat4 } from './utils.js';
import { costIndexToColor } from './constants.js';

export class EnavCostmap extends DataTexture {
    constructor() {
        super();

        this.format = RGBAFormat;
        this.type = UnsignedByteType;

        this.locked = false;

        this._lastInfo = null;

        this.mapFrame = new Group();
    }

    clearCostmap() {
        if (this.locked) return;
        const imageData = this.image.data;
        if (imageData) {
            imageData.fill(0);
            this.needsUpdate = true;
        }
        this._lastInfo = null;
    }

    update(annotation) {
        if (this.locked) return;
        if (annotation.cellCostType && this._lastInfo !== annotation.file) {
            // Set the position of the costmap
            // TODO: This needs to be positioned relative to the rover at
            // a certain time. Here the map is position where the rover happens
            // to be.
            const driver = this.driver;
            const viewer = driver.viewer;
            const options = driver.options;
            const robot = viewer.getRobot(options.robot);
            const { enavDpGrid } = annotation;
            const { position, numCells, resolution, radius } = enavDpGrid;
            tempScale.set(numCells * resolution, numCells * resolution, 1);
            tempVec3.set(
                position.x + radius,
                position.y + radius,
                robot.position.z - 2,
            );
            tempQuat.set(0, 0, 0, 1);
            tempMat4.compose(tempVec3, tempQuat, tempScale);
            driver.applyFrameGroundTruthOffset(tempMat4);

            if (annotation.mapFrame) {
                const { x, y, yaw } = annotation.mapFrame;
                this.mapFrame.position.set(x, y, 0);
                this.mapFrame.rotation.set(0, 0, yaw);
            }

            const totalNumCells = numCells * numCells;

            const image = this.image;
            if (!image.data || image.data.length !== 4 * totalNumCells) {
                image.data = new Uint8Array(4 * totalNumCells);
                image.width = numCells;
                image.height = numCells;
            }

            const costmapData = image.data;
            for (let x = 0; x < numCells; x++) {
                for (let y = 0; y < numCells; y++) {
                    // need to transpose the data in order for
                    // costmap to be properly rendered in viewer
                    const i = y * numCells + x;
                    const transposed = x * numCells + y;
                    // don't draw if there were "NO_ISSUES"
                    if (annotation.cellCostType[i] === 0) {
                        costmapData[transposed * 4 + 0] = 0;
                        costmapData[transposed * 4 + 1] = 0;
                        costmapData[transposed * 4 + 2] = 0;
                        costmapData[transposed * 4 + 3] = 0;
                    } else {
                        // convert hex to rgb
                        const color = costIndexToColor[annotation.cellCostType[i]];
                        costmapData[transposed * 4 + 0] = (color >> 16) & 255;
                        costmapData[transposed * 4 + 1] = (color >> 8) & 255;
                        costmapData[transposed * 4 + 2] = color & 255;
                        costmapData[transposed * 4 + 3] = 255;
                    }
                }
            }
            this.needsUpdate = true;
            this._lastInfo = annotation.file;

            // Update the stamped cost map
            const heightmap = driver.heightmap;
            const mat = heightmap.heightmap.mesh.material;
            const extendedMat = heightmap.extendedHeightmap.mesh.material;
            const mapFrame = this.mapFrame;
            mapFrame.updateWorldMatrix(true);
            tempMat4.premultiply(mapFrame.matrixWorld);
            mat.textureStampFrameInverse_costmap.copy(tempMat4).invert();
            extendedMat.textureStampFrameInverse_costmap.copy(mat.textureStampFrameInverse_costmap);

            mat.gridStampFrameInverse_costmap.copy(mat.textureStampFrameInverse_costmap);
            extendedMat.gridStampFrameInverse_costmap.copy(mat.textureStampFrameInverse_costmap);
            mat.gridResolution_costmap.set(numCells, numCells);
            extendedMat.gridResolution_costmap.set(numCells, numCells);
        }
    }
}
