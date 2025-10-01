import { CircleArc } from '../src/math/CircleArc';
import { Vector2 } from 'three';

describe('CircleArc', () => {
    it('should be converted to the shorter arc when calling toShortestArc', () => {
        const arc = new CircleArc();
        arc.startPoint.set(0, 0);
        arc.endPoint.set(0, 2);
        arc.deltaHeading = (3 * Math.PI) / 2;

        arc.toShortestArc();
        expect(arc.deltaHeading).toEqual(-Math.PI / 2);

        arc.toShortestArc();
        expect(arc.deltaHeading).toEqual(-Math.PI / 2);
    });

    it('should copy correctly.', () => {
        const arc1 = new CircleArc();
        const arc2 = new CircleArc();

        arc1.startPoint.set(1, 2);
        arc1.endPoint.set(2, 1);
        arc1.deltaHeading = 5;
        arc1.startHeading = 2;

        arc2.copy(arc1);
        expect(arc2).toEqual(arc1);
    });

    it('should clone correctly.', () => {
        const arc1 = new CircleArc();

        arc1.startPoint.set(1, 2);
        arc1.endPoint.set(2, 1);
        arc1.deltaHeading = 5;
        arc1.startHeading = 2;

        const arc2 = arc1.clone();
        expect(arc2).toEqual(arc1);
    });

    it('should always return a positive radius.', () => {
        const arc = new CircleArc();
        arc.startPoint.set(0, 0);
        arc.endPoint.set(0, 2);
        arc.deltaHeading = Math.PI;

        expect(arc.getCircleRadius()).toEqual(1);

        arc.deltaHeading = -Math.PI;
        expect(arc.getCircleRadius()).toEqual(1);
    });

    it('getCenter should retrieve the center of the circle.', () => {
        const target = new Vector2();
        const arc = new CircleArc();
        arc.startPoint.set(1, 0);
        arc.endPoint.set(0, 1);

        arc.deltaHeading = Math.PI / 2;
        arc.getCircleCenter(target);
        expect(Math.abs(target.x - 0)).toBeLessThan(1e-10);
        expect(Math.abs(target.y - 0)).toBeLessThan(1e-10);

        arc.deltaHeading = -Math.PI / 2;
        arc.getCircleCenter(target);
        expect(Math.abs(target.x - 1)).toBeLessThan(1e-10);
        expect(Math.abs(target.y - 1)).toBeLessThan(1e-10);
    });

    it('getRadius should return the correct length.', () => {
        const arc = new CircleArc();
        arc.startPoint.set(1, 0);
        arc.endPoint.set(0, 1);

        let radius;
        arc.deltaHeading = Math.PI / 2;
        radius = arc.getCircleRadius();
        expect(Math.abs(1.0 - radius)).toBeLessThan(1e-10);

        arc.deltaHeading = -Math.PI / 2;
        radius = arc.getCircleRadius();
        expect(Math.abs(1.0 - radius)).toBeLessThan(1e-10);

        arc.startPoint.set(0, 1);
        arc.endPoint.set(1, 0);

        arc.deltaHeading = Math.PI / 2;
        radius = arc.getCircleRadius();
        expect(Math.abs(1.0 - radius)).toBeLessThan(1e-10);

        arc.deltaHeading = -Math.PI / 2;
        radius = arc.getCircleRadius();
        expect(Math.abs(1.0 - radius)).toBeLessThan(1e-10);
    });

    describe('forEach', () => {
        it('should give correct values even if there is no movement.', () => {
            const arc = new CircleArc();
            arc.startPoint.set(1, 2);
            arc.endPoint.set(1, 2);
            arc.deltaHeading = 0;
            arc.startHeading = Math.PI / 4;

            const positions = [];
            const tangents = [];
            arc.forEachPoint(1, (pt, tn) => {
                positions.push(pt.x, pt.y);
                tangents.push(tn.x, tn.y);
            });

            const sinPi4 = Math.sin(Math.PI / 4);
            expect(positions).toEqual([1, 2, 1, 2]);

            const resultTangents = [sinPi4, sinPi4, sinPi4, sinPi4];
            for (let i = 0; i < resultTangents.length; i++) {
                expect(Math.abs(tangents[i] - resultTangents[i])).toBeLessThan(1e-10);
            }
        });

        it('should yield the correct amount of points.', () => {
            const arc = new CircleArc();
            arc.startPoint.set(5, 5);
            arc.endPoint.set(4, 6);
            arc.deltaHeading = Math.PI / 2;

            let count = 0;
            arc.forEachPoint(15, () => {
                count++;
            });

            expect(count).toEqual(16);
        });

        it('should yield a line if the delta heading is zero.', () => {
            const arc = new CircleArc();
            arc.startPoint.set(1, 0);
            arc.endPoint.set(0, 1);
            arc.deltaHeading = 0;

            const sinPi4 = Math.sin(Math.PI / 4);
            const positions = [];
            const tangents = [];
            arc.forEachPoint(2, (pt, tn) => {
                positions.push(pt.x, pt.y);
                tangents.push(tn.x, tn.y);
            });

            expect(positions).toEqual([1, 0, 0.5, 0.5, 0, 1]);
            expect(tangents).toEqual([-sinPi4, sinPi4, -sinPi4, sinPi4, -sinPi4, sinPi4]);
        });

        it('should yield a point with changing tangent if the position change is zero.', () => {
            const arc = new CircleArc();
            arc.startPoint.set(0, 0);
            arc.endPoint.set(0, 0);
            arc.deltaHeading = Math.PI / 2;
            arc.startHeading = Math.PI / 2;

            const sinPi4 = Math.sin(Math.PI / 4);
            const positions = [];
            const tangents = [];
            arc.forEachPoint(2, (pt, tn) => {
                positions.push(pt.x, pt.y);
                tangents.push(tn.x, tn.y);
            });

            expect(positions).toEqual([0, 0, 0, 0, 0, 0]);

            const resultTangents = [0, 1, -sinPi4, sinPi4, -1, 0];
            for (let i = 0; i < resultTangents.length; i++) {
                expect(Math.abs(tangents[i] - resultTangents[i])).toBeLessThan(1e-10);
            }
        });

        it('should give points along the arc.', () => {
            const arc = new CircleArc();
            arc.startPoint.set(1, 0);
            arc.endPoint.set(0, 1);
            arc.deltaHeading = Math.PI / 2;

            const sinPi4 = Math.sin(Math.PI / 4);
            let positions, tangents, indices;
            let resultPositions, resultTangents;

            positions = [];
            tangents = [];
            indices = [];
            arc.forEachPoint(2, (pt, tn, i) => {
                positions.push(pt.x, pt.y);
                tangents.push(tn.x, tn.y);
                indices.push(i);
            });

            resultPositions = [1, 0, sinPi4, sinPi4, 0, 1];
            resultTangents = [0, 1, -sinPi4, sinPi4, -1, 0];
            expect(indices).toEqual([0, 1, 2]);
            for (let i = 0; i < resultPositions.length; i++) {
                expect(Math.abs(positions[i] - resultPositions[i])).toBeLessThan(1e-10);
                expect(Math.abs(tangents[i] - resultTangents[i])).toBeLessThan(1e-10);
            }

            // reverse
            arc.deltaHeading = -Math.PI / 2;

            positions = [];
            tangents = [];
            indices = [];
            arc.forEachPoint(2, (pt, tn, i) => {
                positions.push(pt.x, pt.y);
                tangents.push(tn.x, tn.y);
                indices.push(i);
            });

            resultPositions = [1, 0, 1 - sinPi4, 1 - sinPi4, 0, 1];
            resultTangents = [-1, 0, -sinPi4, sinPi4, 0, 1];
            expect(indices).toEqual([0, 1, 2]);
            for (let i = 0; i < resultPositions.length; i++) {
                expect(Math.abs(positions[i] - resultPositions[i])).toBeLessThan(1e-10);
                expect(Math.abs(tangents[i] - resultTangents[i])).toBeLessThan(1e-10);
            }
        });

        describe('closestPointToPoint()', () => {
            it('should correctly return the closest point on the arc when the arc wedge is < Math.PI', () => {
                const arc = new CircleArc();
                arc.startPoint.set(1, 0);
                arc.endPoint.set(0, 1);
                arc.deltaHeading = Math.PI / 2;

                const point = new Vector2();
                const target = new Vector2();

                point.set(1, 1);
                arc.closestPointToPoint(point, target);
                expect(Math.abs(target.x - Math.sqrt(2) / 2)).toBeLessThan(1e-10);
                expect(Math.abs(target.y - Math.sqrt(2) / 2)).toBeLessThan(1e-10);

                point.set(0.1, 0.1);
                arc.closestPointToPoint(point, target);
                expect(Math.abs(target.x - Math.sqrt(2) / 2)).toBeLessThan(1e-10);
                expect(Math.abs(target.y - Math.sqrt(2) / 2)).toBeLessThan(1e-10);

                point.set(2, 0);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(1);
                expect(target.y).toEqual(0);

                point.set(.1, 0);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(1);
                expect(target.y).toEqual(0);

                point.set(.1, -.25);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(1);
                expect(target.y).toEqual(0);
            });

            it('should correctly return the closest point on the arc when the arc wedge is > Math.PI', () => {
                const arc = new CircleArc();
                arc.startPoint.set(1, 0);
                arc.endPoint.set(0, -1);
                arc.deltaHeading = 3 * Math.PI / 2;

                const point = new Vector2();
                const target = new Vector2();

                point.set(1, 1);
                arc.closestPointToPoint(point, target);
                expect(Math.abs(target.x - Math.sqrt(2) / 2)).toBeLessThan(1e-10);
                expect(Math.abs(target.y - Math.sqrt(2) / 2)).toBeLessThan(1e-10);

                point.set(-1, -1);
                arc.closestPointToPoint(point, target);
                expect(Math.abs(target.x + Math.sqrt(2) / 2)).toBeLessThan(1e-10);
                expect(Math.abs(target.y + Math.sqrt(2) / 2)).toBeLessThan(1e-10);

                point.set(.1, -1);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(0);
                expect(target.y).toEqual(-1);
            });

            it('should correctly return the closest point on an arc with 0 delta heading.', () => {
                const arc = new CircleArc();
                arc.startPoint.set(0, 1);
                arc.endPoint.set(0, -1);
                arc.deltaHeading = 0;

                const point = new Vector2();
                const target = new Vector2();

                point.set(1, 0);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(0);
                expect(target.y).toEqual(0);

                point.set(1, 2);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(0);
                expect(target.y).toEqual(1);

                point.set(1, -2);
                arc.closestPointToPoint(point, target);
                expect(target.x).toEqual(0);
                expect(target.y).toEqual(-1);
            });
        });
    });
});
