// Originally from
// https://github.com/Fyrestar/THREE.InfiniteGridHelper

import { Mesh, PlaneGeometry, Color, ShaderMaterial, DoubleSide, Vector3 } from 'three';

/**
 * Mesh to render an infinite grid in size with grid lines every 10m and 1m by default
 * and thicker lines at 0.
 * @extends Mesh
 */
export class InfiniteGrid extends Mesh {
    /**
     * Parameters for setting the grid line stride, color, and distance the grid
     * will fade out at.
     * @param {Number} [size1=1]
     * @param {Number} [size2=10]
     * @param {Color} [color=0xffffff]
     * @param {Number} [distance=2000]
     */
    constructor(size1: number = 1, size2: number = 10, color: Color = new Color(0xffffff), distance: number = 2000) {
        const geometry = new PlaneGeometry(2, 2, 1, 1);
        const material = new ShaderMaterial({
            side: DoubleSide,

            defines: {
                FADE_TO_POINT: 0,
            },

            uniforms: {
                uSize1: {
                    value: size1,
                },
                uSize2: {
                    value: size2,
                },
                uColor: {
                    value: color,
                },
                uDistance: {
                    value: distance,
                },
                opacity: {
                    value: 1.0,
                },
                fadePosition: {
                    value: new Vector3(),
                },
                fadeDistance: {
                    value: 10,
                },
            },
            transparent: true,
            depthWrite: false,
            vertexShader: /* glsl */ `

                varying vec3 worldPosition;

                uniform float uDistance;

                void main() {

                    vec3 pos = position.xzy * uDistance;
                    pos.xz += cameraPosition.xz;

                    worldPosition = pos;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );

                }
            `,

            fragmentShader: /* glsl */ `

                varying vec3 worldPosition;

                uniform float uSize1;
                uniform float uSize2;
                uniform vec3 uColor;
                uniform float uDistance;
                uniform float opacity;

                #if FADE_TO_POINT
                uniform float fadeDistance;
                uniform vec3 fadePosition;
                #endif

                float getGrid( float size ) {

                    // distance to along xz to given size
                    vec2 r = worldPosition.xz / size;

                    float scaledWidth = fract(r.s);
                    float scaledHeight = fract(r.t);
                    scaledWidth = abs(scaledWidth - floor(scaledWidth + 0.5));
                    scaledHeight = abs(scaledHeight - floor(scaledHeight + 0.5));

                    // Fuzz Factor - Controls blurriness of lines and accomplishes antialiasing
                    const float fuzz = 2.; // needs to be at least 2
                    vec2 dF = fwidth(r);
                    float line = min(
                        smoothstep(0.0, dF.s * fuzz, scaledWidth),
                        smoothstep(0.0, dF.t * fuzz, scaledHeight)
                    );

                    return 0.5 * (1.0 - line);

                }

                void main() {

                    // fade the center line out
                    float globalFade = 1.0 - min( distance( cameraPosition.xz, worldPosition.xz ) / uDistance, 1.0 );

                    // fade grids 1 and 2 out
                    float grid1Fade = 1.0 - min( distance( cameraPosition.xz, worldPosition.xz ) / ( uDistance / 3.0 ), 1.0 );
                    float grid2Fade = 1.0 - min( distance( cameraPosition.xz, worldPosition.xz ) / ( uDistance / 1.5 ), 1.0 );

                    float g1 = getGrid( uSize1 ) * pow( grid1Fade, 3.0 );
                    float g2 = getGrid( uSize2 ) * pow( grid2Fade, 3.0 );
                    float g3 = getGrid( uDistance );

                    float intensity1 = mix( g2, g1, g1 );
                    float intensity2 = mix( g3, intensity1, intensity1 );

                    gl_FragColor = vec4( uColor.rgb, intensity2 * pow( globalFade, 3.0 ) );
                    gl_FragColor.a = mix( 0.5 * gl_FragColor.a, gl_FragColor.a, g2 );
                    gl_FragColor.a = mix( 0.5 * gl_FragColor.a, gl_FragColor.a, g3 );
                    gl_FragColor.a *= opacity;

                    #if FADE_TO_POINT
                    float positionFade = 1.0 - min( distance( worldPosition.xz, fadePosition.xz ) / fadeDistance, 1.0 );
                    gl_FragColor.a *= pow( positionFade, 2.0 );
                    #endif

                    if ( gl_FragColor.a <= 0.0 ) {

                        discard;

                    }

                }
            `,

            extensions: {
                // @ts-ignore
                derivatives: true,
            },
        });

        super(geometry, material);

        this.frustumCulled = false;
    }

    set color(color: Color) {
        (this.material as ShaderMaterial).uniforms.uColor.value = color;
    }
}
