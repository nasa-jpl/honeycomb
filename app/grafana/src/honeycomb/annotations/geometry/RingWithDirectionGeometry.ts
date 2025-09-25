// based on https://github.com/mrdoob/three.js/blob/master/src/geometries/RingGeometry.js
// modified so that there's a small triangle pointing in the +X direction...
import { BufferGeometry, Float32BufferAttribute, Vector2, Vector3 } from 'three';

class RingWithDirectionGeometry extends BufferGeometry {

    type = 'RingWithDirectionGeometry';
    parameters: {};

	// CHANGE TO THREE.JS's RingGeometry -- add extra parameter
	constructor( innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2, radiusMultiplierForDirection = 1.75 ) {

		super();


		this.parameters = {
			innerRadius: innerRadius,
			outerRadius: outerRadius,
			thetaSegments: thetaSegments,
			phiSegments: phiSegments,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		thetaSegments = Math.max( 3, thetaSegments );
		phiSegments = Math.max( 1, phiSegments );

		// buffers

		const indices: number[] = [];
		const vertices: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];

		// some helper variables

		let radius = innerRadius;
		const radiusStep = ( ( outerRadius - innerRadius ) / phiSegments );
		const vertex = new Vector3();
		const uv = new Vector2();

		// generate vertices, normals and uvs

		for ( let j = 0; j <= phiSegments; j ++ ) {

			for ( let i = 0; i <= thetaSegments; i ++ ) {

				// values are generate from the inside of the ring to the outside

				const segment = thetaStart + i / thetaSegments * thetaLength;

				// vertex

				// MAIN CHANGE TO THREE.JS's RingGeometry IS HERE:
				if (j === phiSegments && (i === 0 || i === thetaSegments)) {
					vertex.x = (radius * radiusMultiplierForDirection) * Math.cos( segment );
					vertex.y = (radius * radiusMultiplierForDirection) * Math.sin( segment );
				} else if (j === phiSegments && (i === 1 || i === thetaSegments - 1)) {
					vertex.x = (radius * radiusMultiplierForDirection * 0.5) * Math.cos( segment );
					vertex.y = (radius * radiusMultiplierForDirection * 0.5) * Math.sin( segment );
				} else {
					vertex.x = radius * Math.cos( segment );
					vertex.y = radius * Math.sin( segment );
				}

				vertices.push( vertex.x, vertex.y, vertex.z );

				// normal

				normals.push( 0, 0, 1 );

				// uv

				uv.x = ( vertex.x / outerRadius + 1 ) / 2;
				uv.y = ( vertex.y / outerRadius + 1 ) / 2;

				uvs.push( uv.x, uv.y );

			}

			// increase the radius for next row of vertices

			radius += radiusStep;

		}

		// indices

		for ( let j = 0; j < phiSegments; j ++ ) {

			const thetaSegmentLevel = j * ( thetaSegments + 1 );

			for ( let i = 0; i < thetaSegments; i ++ ) {

				const segment = i + thetaSegmentLevel;

				const a = segment;
				const b = segment + thetaSegments + 1;
				const c = segment + thetaSegments + 2;
				const d = segment + 1;

				// faces

				indices.push( a, b, d );
				indices.push( b, c, d );

			}

		}

		// build geometry

		this.setIndex( indices );
		this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
		this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
		this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

	}

	copy( source: RingWithDirectionGeometry ) {

		super.copy( source );

		this.parameters = Object.assign( {}, source.parameters );

		return this;

	}

	static fromJSON( data: any ) {

		return new RingWithDirectionGeometry( data.innerRadius, data.outerRadius, data.thetaSegments, data.phiSegments, data.thetaStart, data.thetaLength );

	}

}

export { RingWithDirectionGeometry };
