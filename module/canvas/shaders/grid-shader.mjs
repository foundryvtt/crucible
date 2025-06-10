/**
 * Selective grid shader for Crucible:
 * Renders the grid only around up to MAX_POSITIONS controlled tokens with a smooth fall‑off. When the number of
 * controlled tokens exceeds MAX_POSITIONS the shader renders the entire grid.
 */
export default class CrucibleSelectiveGridShader extends foundry.canvas.rendering.shaders.GridShader {

  /**
   * Maximum number of tokens considered for selective rendering.
   * @type {number}
   */
  static MAX_CONTROLLED = 6;

  /**
   * Maximum number of positions: two points (center + preview) per token.
   * @type {number}
   */
  static MAX_POSITIONS = this.MAX_CONTROLLED * 2;

  /**
   * Stride fallback (in grid units) for tokens without an actor.
   * @type {number}
   */
  static #FALLBACK_STRIDE = 4;

  /** @override */
  static defaultUniforms = {
    ...super.defaultUniforms,
    positions: new Float32Array(this.MAX_POSITIONS * 2).fill(0), // vec2 per position
    strides: new Float32Array(this.MAX_POSITIONS).fill(0),       // one float per position
    numPositions: 0,
    numControlled: 0,
    falloff: 4
  };

  /* -------------------------------------------- */

  /** @override */
  static _fragmentShader = `
    uniform lowp int style;

    const int MAX_CONTROLLED = ${this.MAX_CONTROLLED};
    const int MAX_POSITIONS = ${this.MAX_POSITIONS};

    uniform int numPositions;
    uniform int numControlled;
    uniform float falloff;
    uniform vec2 positions[MAX_POSITIONS];
    uniform float strides[MAX_POSITIONS];

    ${this.DRAW_GRID_FUNCTION}

    vec4 _main() {
      // No controlled tokens: hide the grid entirely
      if ( numControlled == 0 ) return vec4(0.0);

      vec4 gridColor = drawGrid(vGridCoord, style, thickness, color);

      // Too many tokens: render the full grid
      if ( numControlled > MAX_CONTROLLED ) return gridColor;

      // Blend contribution from each position using its own stride
      float alpha = 0.0;
      for ( int i = 0; i < MAX_POSITIONS; ++i ) {
        if ( i >= numPositions ) break;
        float d = distance(vGridCoord, positions[i]);
        float r = strides[i];
        float a = 1.0 - smoothstep(max(r - falloff, 1.0), r + falloff, d);
        alpha = max(alpha, a);
      }
      return gridColor * alpha;
    }
  `;

  /* -------------------------------------------- */

  /**
   * Push token center positions and individual strides into shader uniforms.
   */
  updatePositions() {
    const tokens = canvas.tokens.controlled;
    const gs = canvas.grid.size;
    const u = this.uniforms;

    u.numControlled = tokens.length;

    let posCount = 0;

    for ( const t of tokens ) {
      if ( posCount >= this.constructor.MAX_POSITIONS ) break;

      // Stride in grid units
      const aSize = t.actor?.system.movement.size ?? 0;
      const aStride = t.actor?.system.movement.stride;
      const stride = Math.max((aSize / 2) + aStride, CrucibleSelectiveGridShader.#FALLBACK_STRIDE);

      // Controlled token center
      u.positions[posCount * 2] = t.center.x / gs;
      u.positions[posCount * 2 + 1] = t.center.y / gs;
      u.strides[posCount] = stride;
      posCount++;

      // Preview center, if any
      if ( t.hasPreview && t._preview && (posCount < this.constructor.MAX_POSITIONS) ) {
        u.positions[posCount * 2] = t._preview.center.x / gs;
        u.positions[posCount * 2 + 1] = t._preview.center.y / gs;
        u.strides[posCount] = stride;
        posCount++;
      }
    }

    u.numPositions = posCount;
  }

  /* -------------------------------------------- */

  /** @override */
  _preRender(mesh, renderer) {
    super._preRender(mesh, renderer);
    this.updatePositions();
  }
}
