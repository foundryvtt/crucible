/**
 * A filter which flattens its target to a two-tone silhouette, in either of two polarities to strobe between.
 * @extends {foundry.canvas.rendering.filters.AbstractBaseFilter}
 */
export default class CrucibleElectrocutionFilter extends foundry.canvas.rendering.filters.AbstractBaseFilter {

  /** @override */
  static _createFragmentShader() {
    return `
    precision ${PIXI.Program.defaultFragmentPrecision} float;
    uniform sampler2D uSampler;
    uniform vec3 light;
    uniform vec3 dark;
    uniform float strength;
    uniform float polarity;
    uniform float threshold;
    uniform float softness;
    varying vec2 vTextureCoord;

    ${this.CONSTANTS}
    ${this.PERCEIVED_BRIGHTNESS}

    void main() {
      vec4 base = texture2D(uSampler, vTextureCoord);
      if ( base.a <= 0.0 ) {
        gl_FragColor = base;
        return;
      }

      // Unmultiply rgb with alpha channel
      vec3 rgb = base.rgb / base.a;

      // Separate the body of the target from its darker linework, then assign each a tone by polarity
      float band = max(softness, 0.001);
      float body = smoothstep(threshold - band, threshold + band, perceivedBrightness(rgb));
      vec3 shocked = mix(dark, light, mix(body, 1.0 - body, polarity));
      gl_FragColor = vec4(mix(rgb, shocked, strength) * base.a, base.a);
    }
    `;
  }

  /**
   * - light: the bright tone.
   * - dark: the dark tone.
   * - strength: how far the target is taken from its own colors toward the two tones, in [0, 1].
   * - polarity: 0 renders a light body with dark linework, 1 a dark body with light linework.
   * - threshold: the perceived brightness which divides linework from body.
   * - softness: half the width of the brightness band blended across that division.
   * @override
   */
  static get defaultUniforms() {
    return {
      uSampler: null,
      light: [1.0, 0.97, 0.82],
      dark: [0.04, 0.05, 0.10],
      strength: 1,
      polarity: 0,
      threshold: 0.3,
      softness: 0.12
    };
  }
}
