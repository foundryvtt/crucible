/**
 * @import {VFXEffect} from "@client/canvas/vfx/vfx-effect.mjs"
 */


/**
 * Reusable VFX animation building blocks. Each block is an object with up to three lifecycle hooks
 * mirroring the VFX pipeline: configure (serializable), resolve (compute references), and finalize
 * (inject runtime callbacks). Blocks are composed by gesture configurators to build spell and action
 * VFX from modular visual primitives.
 *
 * @typedef {object} VFXAnimationBlock
 * @property {(params: object) => VFXAnimationResult} configure
 * @property {(vfxEffect: VFXEffect, references: Record<string, any>) => void} [resolve]
 * @property {(vfxEffect: VFXEffect, references: Record<string, any>) => void} [finalize]
 */

/**
 * The result returned by a VFXAnimationBlock's configure method.
 *
 * @typedef {object} VFXAnimationResult
 * @property {object} components
 * @property {object[]} timeline
 * @property {Record<string, any>} references
 */

/* -------------------------------------------- */
/*  Shared Helpers                              */
/* -------------------------------------------- */

/**
 * The fallback texture array used when no rune-specific art is available.
 * @type {string[]}
 */
export const FALLBACK_TEXTURES = ["#crucible.particle.white"];

/**
 * The global particle scale multiplier derived from the canvas grid size.
 * Particle textures are authored at a size appropriate for a 40px microgrid (200px physical grid).
 * On scenes with a different grid size, all particle scales are multiplied by this factor to
 * maintain correct proportions relative to the map.
 * @type {number}
 */
export function getParticleScaleFactor() {
  return (canvas?.dimensions?.size ?? 40) / 40;
}

/**
 * Construct a particleGenerator component definition with defaults applied.
 * If the provided overrides include a non-empty textures array (typically rune-specific art from
 * the VFX spritesheet), those textures are used with normal blending; otherwise, the fallback white
 * particle is applied with additive blending.
 * Particle scale is automatically adjusted for the current grid size via {@link getParticleScaleFactor}.
 * @param {object} overrides   Component fields that override or extend the defaults.
 * @returns {object}
 */
export function particleGenerator(overrides) {
  const textures = overrides.textures?.length ? overrides.textures : FALLBACK_TEXTURES;
  const blend = textures === FALLBACK_TEXTURES ? 1 : 0;
  const gridScale = getParticleScaleFactor();
  const scale = overrides.scale
    ? {min: overrides.scale.min * gridScale, max: overrides.scale.max * gridScale}
    : {min: gridScale, max: gridScale};
  return {
    type: "particleGenerator",
    blend,
    ...overrides,
    textures,
    scale
  };
}

/* -------------------------------------------- */

/**
 * Merge multiple VFXAnimationResult tuples into a single combined result.
 * Components, timeline entries, and references are combined via simple aggregation.
 * Callers are responsible for setting timeline positions on each block's output before merging.
 * @param {...VFXAnimationResult} blocks   The animation block results to merge.
 * @returns {VFXAnimationResult}
 */
export function mergeAnimationBlocks(...blocks) {
  const components = {};
  const timeline = [];
  const references = {};
  for ( const block of blocks ) {
    Object.assign(components, block.components);
    timeline.push(...block.timeline);
    Object.assign(references, block.references);
  }
  return {components, timeline, references};
}

/**
 * Compute scaled particle count and perFrame from coverage area and a unitless density multiplier.
 * Each block defines its own base count and perFrame for a reference area of PI * 300^2.
 * The coverage area scales these proportionally, and the density multiplier allows callers to
 * uniformly increase or decrease particle quantity (1.0 = normal, 2.0 = double, 0.5 = half).
 * @param {object} params
 * @param {number} params.baseCount        The block's base particle count at reference area.
 * @param {number} params.basePerFrame     The block's base perFrame at reference area.
 * @param {number} [params.coverageArea]   Exact coverage area in square pixels (e.g., from region.area).
 * @param {number} [params.radius]         Fallback radius for circular approximation.
 * @param {number} [params.density=1.0]    Unitless multiplier (1.0 = normal for this block).
 * @returns {{count: number, perFrame: number}}
 */
function _scaledParticleCounts({baseCount, basePerFrame, coverageArea, radius, density = 1.0}) {
  const REF_AREA = Math.PI * 300 * 300;
  const area = coverageArea ?? (Math.PI * (radius ?? 300) * (radius ?? 300));
  const scale = Math.max(0.25, area / REF_AREA) * density;
  return {
    count: Math.round(baseCount * scale),
    perFrame: Math.max(1, Math.round(basePerFrame * scale))
  };
}

/* -------------------------------------------- */
/*  Animation Blocks                            */
/* -------------------------------------------- */

/**
 * A radial particle burst that expands outward from a point.
 * Suitable for blast waves, flash bursts, and pulse effects. Shape-agnostic: works with any
 * geometry that needs an expanding ring of particles from an origin point.
 * @type {VFXAnimationBlock}
 */
export const radialBurst = {
  configure({prefix, origin, count, speed, duration, lifetime, visibleFraction = 0.5,
    textures, colors, scale = {min: 0.4, max: 1.0}, alpha = {min: 0.5, max: 1.0},
    initial = 1.0, perFrame = 25, spawnRadius = 6, elevation = 0, sort = 1,
    pointSourceMask, drift, position = 0} = {}) {
    const fadeOut = Math.round(lifetime * (1 - visibleFraction));
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: spawnRadius},
      count,
      duration,
      lifetime: {min: Math.round(lifetime * 0.85), max: lifetime},
      fade: {in: 20, out: fadeOut},
      alpha,
      scale,
      initial,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      config: {
        velocity: {speed: [speed * 0.88, speed * 1.12], angle: [0, 360]},
        ...(drift ? {drift} : {}),
        ...(colors ? {debug: {tint: {mode: "palette", palette: colors}}} : {})
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  }
};

/* -------------------------------------------- */

/**
 * Drifting aerial residue that lingers above the effect area.
 * Models wisps of smoke, haze, magical fog, or airborne debris. Particles drift slowly with
 * gentle random motion. The visual flavor (frost mist, fire smoke, etc.) is determined by the
 * textures passed in. Renders above tokens by default.
 * @type {VFXAnimationBlock}
 */
export const airResidue = {
  configure({prefix, origin, radius, textures, colors, coverageArea, density = 1.0,
    count, duration = 200, lifetime = {min: 2000, max: 2800},
    alpha = {min: 0.05, max: 0.18}, scale = {min: 1.0, max: 2.0},
    speed = {min: 12, max: 55}, initial = 0.3, perFrame,
    elevation = 0, sort = 0, pointSourceMask, blend=PIXI.BLEND_MODES.ADD, position = 0} = {}) {
    const scaled = _scaledParticleCounts({baseCount: 100, basePerFrame: 6, coverageArea, radius, density});
    count ??= scaled.count;
    perFrame ??= scaled.perFrame;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius},
      count,
      duration,
      lifetime,
      fade: {in: 150, out: Math.round((lifetime.max || lifetime) * 0.65)},
      alpha,
      scale,
      initial,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      blend,
      config: {
        velocity: {speed: [speed.min, speed.max], angle: [0, 360]},
        drift: {enabled: true, intensity: 0.5},
        ...(colors ? {debug: {tint: {mode: "palette", palette: colors}}} : {})
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  }
};

/* -------------------------------------------- */

/**
 * Persistent ground residue that lingers underfoot.
 * Models impact scarring, frost patches, lava pools, acid burns, or any lingering ground effect.
 * Near-zero velocity and long lifetime create a semi-permanent mark. The visual flavor is
 * determined by the textures passed in. Renders below tokens by default.
 * @type {VFXAnimationBlock}
 */
export const groundResidue = {
  configure({prefix, origin, radius, textures, coverageArea, density = 1.0,
    count, duration = 150, lifetime = {min: 6000, max: 8000},
    alpha = {min: 0.3, max: 0.6}, scale = {min: 1.0, max: 1.5},
    initial = 0.3, perFrame, blend = PIXI.BLEND_MODES.ADD,
    elevation = 0, sort = 0, pointSourceMask, position = 0} = {}) {
    const scaled = _scaledParticleCounts({baseCount: 80, basePerFrame: 4, coverageArea, radius, density});
    count ??= scaled.count;
    perFrame ??= scaled.perFrame;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius},
      count,
      duration,
      lifetime,
      fade: {in: 200, out: Math.round((lifetime.max || lifetime) * 0.6)},
      alpha,
      scale,
      initial,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      blend,
      config: {
        velocity: {speed: [0, 3], angle: [0, 360]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  }
};
