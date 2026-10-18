import CrucibleTalentNode from "../../const/talent-node.mjs";

/**
 * @import {CrucibleTalentNodeState} from "./talent-tree.mjs";
 */

/**
 * A single mesh which renders every edge of the talent tree as a shaded quad.
 */
export default class CrucibleTalentTreeEdges extends PIXI.Mesh {
  constructor() {
    const edges = CrucibleTalentTreeEdges.#identifyEdges();
    const geometry = CrucibleTalentTreeEdges.#createGeometry(edges);
    const shader = PIXI.Shader.from(CrucibleTalentTreeEdges.#VERTEX_SHADER, CrucibleTalentTreeEdges.#FRAGMENT_SHADER);
    super(geometry, shader);
    this.#edges = edges;
    this.configure();
  }

  /**
   * Appearance of edges: faint unpurchased lines, bordered purchased lines, and shoots toward obtainable nodes.
   * Widths and lengths are in tree units, speeds in tree units per second, and periods in seconds.
   * Shading strengths are fractions toward black or white.
   * @type {{edgeColor: PIXI.ColorSource, edgeAlpha: number, edgeWidth: number, borderColor: PIXI.ColorSource,
   *   borderWidth: number, coreWidth: number, blendCenter: number, blendWidth: number, endDarken: number,
   *   endLength: number, midBrighten: number, wallDarken: number, highlight: number, highlightWidth: number,
   *   waveLength: number, waveSpeed: number, waveStrength: number, waveGlow: number, glowWidth: number,
   *   glowAlpha: number, pulseMin: number, pulsePeriod: number, shootLength: number, shootFade: number,
   *   shootPulse: number, shootTaper: number, filterAnimation: number, animationEase: number}}
   */
  static STYLE = {
    edgeColor: 0x000000,
    edgeAlpha: 0.25,
    edgeWidth: 4,
    borderColor: 0x0E0906,
    borderWidth: 12,
    coreWidth: 6,
    blendCenter: 0.65,
    blendWidth: 0.25,
    endDarken: 0.4,
    endLength: 96,
    midBrighten: 0.15,
    wallDarken: 0.35,
    highlight: 0.35,
    highlightWidth: 0.3,
    waveLength: 200,
    waveSpeed: 120,
    waveStrength: 0.3,
    waveGlow: 0.5,
    glowWidth: 48,
    glowAlpha: 0.35,
    pulseMin: 0.4,
    pulsePeriod: 3,
    shootLength: 0.45,
    shootFade: 0.4,
    shootPulse: 0.15,
    shootTaper: 3,
    filterAnimation: 0.2,
    animationEase: 0.15
  };

  /**
   * Corners of each edge quad: fraction along the edge from its first node to its second, and side of centerline.
   * @type {[number, number][]}
   */
  static #CORNERS = [[0, -1], [1, -1], [1, 1], [0, 1]];

  static #VERTEX_SHADER = `#version 300 es
  precision highp float;

  in vec4 aEndpoints;
  in vec2 aCorner;
  in vec3 aColorA;
  in vec3 aColorB;
  in float aState;

  uniform mat3 projectionMatrix;
  uniform mat3 translationMatrix;
  uniform float uEdgeWidth;
  uniform float uBorderWidth;
  uniform float uGlowWidth;

  out vec2 vEdge;
  out float vLength;
  out vec3 vColorA;
  out vec3 vColorB;
  out float vKind;

  void main() {
    vec2 a = aEndpoints.xy;
    vec2 b = aEndpoints.zw;
    vec2 direction = normalize(b - a);
    vec2 normal = vec2(-direction.y, direction.x);

    // Pad the quad by one screen pixel so antialiasing at the outer edge is not clipped
    float pixel = 1.0 / length(translationMatrix[0].xy);
    float halfWidth = (max(max(uEdgeWidth, uBorderWidth), uGlowWidth) / 2.0) + pixel;

    vec2 position = mix(a, b, aCorner.x) + (normal * aCorner.y * halfWidth);

    // Reverse the edge when it flows from its second node to its first
    bool reversed = aState < 0.0;
    vEdge = vec2(reversed ? 1.0 - aCorner.x : aCorner.x, aCorner.y * halfWidth);
    vLength = distance(a, b);
    vColorA = reversed ? aColorB : aColorA;
    vColorB = reversed ? aColorA : aColorB;
    vKind = abs(aState);
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
  }`;

  static #FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  #define PI 3.14159265

  in vec2 vEdge;
  in float vLength;
  in vec3 vColorA;
  in vec3 vColorB;
  in float vKind;

  uniform vec3 uEdgeColor;
  uniform float uEdgeAlpha;
  uniform float uEdgeWidth;
  uniform vec3 uBorderColor;
  uniform float uBorderWidth;
  uniform float uCoreWidth;
  uniform float uBlendCenter;
  uniform float uBlendWidth;
  uniform float uEndDarken;
  uniform float uEndLength;
  uniform float uMidBrighten;
  uniform float uWallDarken;
  uniform float uHighlight;
  uniform float uHighlightWidth;
  uniform float uTime;
  uniform float uWaveLength;
  uniform float uWaveSpeed;
  uniform float uWaveStrength;
  uniform float uWaveGlow;
  uniform float uGlowWidth;
  uniform float uGlowAlpha;
  uniform float uPulseMin;
  uniform float uPulsePeriod;
  uniform float uShootLength;
  uniform float uShootFade;
  uniform float uShootPulse;
  uniform float uShootTaper;
  uniform float uAnimation;

  out vec4 fragColor;

  float band(float distance, float width, float aa) {
    return 1.0 - smoothstep((width / 2.0) - aa, (width / 2.0) + aa, distance);
  }

  vec3 coreColor(vec3 color, float wave, float ends, float distance) {

    // Along the edge: darken toward each end, brighten toward the middle
    color *= mix(1.0 - uEndDarken, 1.0, ends);
    color = mix(color, vec3(1.0), uMidBrighten * sin(PI * vEdge.x));

    // Traveling wave of alternating darkening and brightening
    color *= 1.0 + (uWaveStrength * min(wave, 0.0));
    color = mix(color, vec3(1.0), uWaveStrength * max(wave, 0.0));

    // Across the core: darken toward the walls, highlight the centerline
    float r = clamp(distance / (uCoreWidth / 2.0), 0.0, 1.0);
    color *= mix(1.0, 1.0 - uWallDarken, r * r);
    return mix(color, vec3(1.0), uHighlight * (1.0 - smoothstep(0.0, uHighlightWidth, r)));
  }

  void main() {
    float distance = abs(vEdge.y);
    float aa = fwidth(vEdge.y) * 0.5;

    // Faint line, which is all that unpurchased edges draw
    float faintAlpha = band(distance, uEdgeWidth, aa) * uEdgeAlpha;
    vec4 faint = vec4(uEdgeColor * faintAlpha, faintAlpha);
    if ( vKind < 0.5 ) {
      fragColor = faint;
      return;
    }

    // Proximity to either end, the wave which travels downstream, and the breathing pulse, scaled by intensity
    float along = vEdge.x * vLength;
    float ends = smoothstep(0.0, uEndLength, min(along, vLength - along));
    float wave = sin(2.0 * PI * (along - (uTime * uWaveSpeed)) / uWaveLength) * uAnimation;
    float pulse = 0.5 + (0.5 * sin(2.0 * PI * uTime / uPulsePeriod) * uAnimation);

    // Shoot from a purchased node toward an obtainable one, tapering and fading as it breathes in and out
    if ( vKind > 1.5 ) {
      float s = vEdge.x / (uShootLength * mix(1.0 - uShootPulse, 1.0, pulse));
      float taper = max(1.0 - pow(s, uShootTaper), 0.0);
      float fade = 1.0 - smoothstep(uShootFade, 1.0, s);
      float alpha = band(distance, uBorderWidth * taper, aa) * fade;
      vec3 core = coreColor(vColorA, wave, ends, distance / max(taper, 0.001));
      vec3 color = mix(uBorderColor, core, band(distance, uCoreWidth * taper, aa));
      fragColor = vec4(color * alpha, alpha) + (faint * (1.0 - alpha));
      return;
    }

    // Bordered core with color blended between nodes
    vec3 base = mix(vColorA, vColorB, smoothstep(uBlendCenter - uBlendWidth, uBlendCenter + uBlendWidth, vEdge.x));
    float alpha = band(distance, uBorderWidth, aa);
    vec3 color = mix(uBorderColor, coreColor(base, wave, ends, distance), band(distance, uCoreWidth, aa));

    // Pulsing glow outside the border carrying the wave, faded near nodes so overlapping edges do not pool
    float glow = 1.0 - smoothstep(uBorderWidth / 2.0, uGlowWidth / 2.0, distance);
    glow = glow * glow * uGlowAlpha * mix(uPulseMin, 1.0, pulse) * ends * (1.0 + (uWaveGlow * wave));
    fragColor = vec4(color * alpha, alpha) + (vec4(base * glow, glow) * (1.0 - alpha));
  }`;

  /* -------------------------------------------- */

  /**
   * The pair of nodes joined by each edge, in geometry order.
   * @type {[CrucibleTalentNode, CrucibleTalentNode][]}
   */
  #edges;

  /**
   * The current intensity of animation, between 0 and 1.
   * @type {number}
   */
  get animation() {
    return this.#animation;
  }

  #animation = 1;

  /**
   * The intensity of animation being eased toward.
   * @type {number}
   */
  #animationTarget = 1;

  /**
   * The time of the previous render, in milliseconds.
   * @type {number}
   */
  #lastRender = performance.now();

  /* -------------------------------------------- */

  /**
   * Apply the configured style to the shader uniforms.
   * @param {Partial<typeof CrucibleTalentTreeEdges.STYLE>} [style]   Style overrides to merge into the configured style
   */
  configure(style={}) {
    const s = Object.assign(CrucibleTalentTreeEdges.STYLE, style);
    Object.assign(this.shader.uniforms, {
      uEdgeColor: Color.from(s.edgeColor).rgb,
      uEdgeAlpha: s.edgeAlpha,
      uEdgeWidth: s.edgeWidth,
      uBorderColor: Color.from(s.borderColor).rgb,
      uBorderWidth: s.borderWidth,
      uCoreWidth: s.coreWidth,
      uBlendCenter: s.blendCenter,
      uBlendWidth: s.blendWidth,
      uEndDarken: s.endDarken,
      uEndLength: s.endLength,
      uMidBrighten: s.midBrighten,
      uWallDarken: s.wallDarken,
      uHighlight: s.highlight,
      uHighlightWidth: s.highlightWidth,
      uWaveLength: s.waveLength,
      uWaveSpeed: s.waveSpeed,
      uWaveStrength: s.waveStrength,
      uWaveGlow: s.waveGlow,
      uGlowWidth: s.glowWidth,
      uGlowAlpha: s.glowAlpha,
      uPulseMin: s.pulseMin,
      uPulsePeriod: s.pulsePeriod,
      uShootLength: s.shootLength,
      uShootFade: s.shootFade,
      uShootPulse: s.shootPulse,
      uShootTaper: s.shootTaper
    });
  }

  /* -------------------------------------------- */

  /**
   * Ease the intensity of animation toward a target value.
   * @param {number} intensity    The target intensity between 0 and 1
   */
  fadeAnimation(intensity) {
    this.#animationTarget = intensity;
  }

  /* -------------------------------------------- */

  /**
   * Update which edges are purchased connections or shoots toward obtainable nodes, and the direction of each.
   * @param {Map<CrucibleTalentNode, CrucibleTalentNodeState>} state   Current node states
   */
  refresh(state) {
    const purchased = CrucibleTalentNode.traverse(n => state.get(n).purchased);
    const flow = new Map(Array.from(purchased, (n, i) => [n, i]));
    const canGrow = s => s.accessible && !s.banned && !s.purchased;
    const buffer = this.geometry.getBuffer("aState");
    for ( const [i, [a, b]] of this.#edges.entries() ) {
      const sa = state.get(a);
      const sb = state.get(b);

      // 0 unpurchased, 1 purchased, 2 shoot; negative when flowing from the second node to the first
      let value = 0;
      if ( sa.purchased && sb.purchased ) value = (flow.get(b) ?? Infinity) < (flow.get(a) ?? Infinity) ? -1 : 1;
      else if ( sa.purchased && canGrow(sb) ) value = 2;
      else if ( sb.purchased && canGrow(sa) ) value = -2;
      buffer.data.fill(value, i * 4, (i + 1) * 4);
    }
    buffer.update();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _render(renderer) {
    const now = performance.now();
    const dt = Math.min(now - this.#lastRender, 100) / 1000;
    this.#lastRender = now;
    const k = 1 - Math.exp(-dt / CrucibleTalentTreeEdges.STYLE.animationEase);
    this.#animation += (this.#animationTarget - this.#animation) * k;
    Object.assign(this.shader.uniforms, {uTime: now / 1000, uAnimation: this.#animation});
    super._render(renderer);
  }

  /* -------------------------------------------- */

  /**
   * The current phase of the breathing pulse shared by edges and nodes, matching the shader.
   * @returns {number}    A value between 0 and 1
   */
  static getPulse() {
    const t = performance.now() / 1000;
    return 0.5 + (0.5 * Math.sin((2 * Math.PI * t) / CrucibleTalentTreeEdges.STYLE.pulsePeriod));
  }

  /* -------------------------------------------- */

  /**
   * Build the edge geometry, with the dynamic state in its own buffer.
   * @param {[CrucibleTalentNode, CrucibleTalentNode][]} edges
   * @returns {PIXI.Geometry}
   */
  static #createGeometry(edges) {
    const n = edges.length;
    const endpoints = new Float32Array(n * 16);
    const corners = new Float32Array(n * 8);
    const colorsA = new Float32Array(n * 12);
    const colorsB = new Float32Array(n * 12);
    const indices = new Uint32Array(n * 6);
    for ( const [i, [a, b]] of edges.entries() ) {
      for ( const [v, corner] of CrucibleTalentTreeEdges.#CORNERS.entries() ) {
        const k = (i * 4) + v;
        endpoints.set([a.point.x, a.point.y, b.point.x, b.point.y], k * 4);
        corners.set(corner, k * 2);
        colorsA.set(a.color.rgb, k * 3);
        colorsB.set(b.color.rgb, k * 3);
      }
      const k = i * 4;
      indices.set([k, k + 1, k + 2, k, k + 2, k + 3], i * 6);
    }
    return new PIXI.Geometry()
      .addAttribute("aEndpoints", endpoints, 4)
      .addAttribute("aCorner", corners, 2)
      .addAttribute("aColorA", colorsA, 3)
      .addAttribute("aColorB", colorsB, 3)
      .addAttribute("aState", new PIXI.Buffer(new Float32Array(n * 4), false, false), 1)
      .addIndex(indices);
  }

  /* -------------------------------------------- */

  /**
   * Identify each pair of connected nodes once, omitting the edges of the origin.
   * @returns {[CrucibleTalentNode, CrucibleTalentNode][]}
   */
  static #identifyEdges() {
    const edges = [];
    const seen = new Set();
    for ( const node of CrucibleTalentNode.nodes.values() ) {
      seen.add(node);
      if ( node.id === "origin" ) continue;
      for ( const c of node.connected ) {
        if ( !seen.has(c) ) edges.push([node, c]);
      }
    }
    return edges;
  }
}
