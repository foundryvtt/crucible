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
  // TODO needs to not assume microgrid.
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
 * A tight forward particle beam along a directional axis. Particles fly at high speed from an
 * origin point along a narrow angular spread, creating a concentrated beam effect.
 * Configure-only, no finalize hook needed.
 * @type {VFXAnimationBlock}
 */
export const rayBeam = {
  configure({prefix, origin, rotation, length, textures,
    speed = 2500, duration = 3500, spawnRadius = 8,
    alpha = {min: 0.5, max: 0.9}, scale = {min: 0.5, max: 1.1},
    count = null, initial = 0.0, perFrame = 20, blend = PIXI.BLEND_MODES.NORMAL,
    elevation = 0, sort = 1, pointSourceMask, position = 0} = {}) {
    const gridScale = getParticleScaleFactor();
    const beamSpeed = speed * gridScale;
    const lifetime = Math.max(300, Math.round(length / beamSpeed * 1000));
    // Spawn along a line perpendicular to the beam direction for a rectangular beam profile
    const perpRad = Math.toRadians(rotation + 90);
    const halfWidth = Math.max(8, spawnRadius);
    const spawnLine = {
      from: {x: origin.x + Math.cos(perpRad) * halfWidth, y: origin.y + Math.sin(perpRad) * halfWidth},
      to: {x: origin.x - Math.cos(perpRad) * halfWidth, y: origin.y - Math.sin(perpRad) * halfWidth}
    };
    const component = particleGenerator({
      textures,
      area: spawnLine,
      count,
      duration,
      lifetime: {min: Math.round(lifetime * 0.85), max: lifetime},
      fade: {in: 30, out: 150},
      alpha,
      scale,
      initial,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      blend,
      rotation: {alignVelocity: true, spread: 0.05},
      config: {
        velocity: {speed: [beamSpeed * 0.9, beamSpeed * 1.1], angle: [rotation - 0.5, rotation + 0.5]}
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
 * A wider halo of particles that cascades off the edges of a directional beam.
 * Slower, more spread out, and shorter-lived than the beam itself.
 * Configure-only, no finalize hook needed.
 * @type {VFXAnimationBlock}
 */
export const castoffFlare = {
  configure({prefix, origin, rotation, length, textures,
    speed = 2500, duration = 3500, spawnRadius = 8,
    lifetime = {min: 200, max: 400},
    alpha = {min: 0.75, max: 1.0}, scale = {min: 0.6, max: 1.2},
    count = null, initial = 0.0, perFrame = 4, blend = PIXI.BLEND_MODES.NORMAL,
    elevation = 0, sort = 0, pointSourceMask, position = 0} = {}) {
    const gridScale = getParticleScaleFactor();
    const beamSpeed = speed * gridScale;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: Math.max(8, spawnRadius)},
      count,
      duration,
      lifetime,
      fade: {in: 0, out: 150},
      alpha,
      scale,
      initial,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      blend,
      rotation: {alignVelocity: true, spread: 0.3},
      config: {
        velocity: {speed: [beamSpeed * 0.05, beamSpeed * 0.15], angle: [rotation - 60, rotation + 60]}
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

/* -------------------------------------------- */

/**
 * Discrete ground impact marks that pop in abruptly, simulating individual objects striking
 * the ground. Each impact appears instantly at full opacity, holds briefly, then fades out.
 * Spawned continuously over a duration to create a staccato pattern of hits.
 * Uses NORMAL blend by default for solid, opaque marks.
 * @type {VFXAnimationBlock}
 */
export const groundImpacts = {
  configure({prefix, origin, radius, textures, coverageArea, density = 1.0,
    count, duration = 2500, lifetime = {min: 4000, max: 6000},
    alpha = {min: 0.6, max: 0.9}, scale = {min: 0.6, max: 1.2},
    perFrame, blend = PIXI.BLEND_MODES.NORMAL,
    elevation = 0, sort = 0, pointSourceMask, position = 0} = {}) {
    const scaled = _scaledParticleCounts({baseCount: 60, basePerFrame: 2, coverageArea, radius, density});
    count ??= scaled.count;
    perFrame ??= scaled.perFrame;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius},
      count,
      duration,
      lifetime,
      fade: {in: 0, out: Math.round((lifetime.max || lifetime) * 0.5)},
      alpha,
      scale,
      initial: 0.0,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      blend,
      rotation: {spread: Math.PI},
      config: {
        velocity: {speed: [0, 0], angle: [0, 360]}
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
 * Debris particles that fall from overhead toward the ground in a top-down perspective.
 * Each particle spawns large (close to camera) and shrinks as it falls, with a gradual
 * darkening tint to reinforce depth. Upon landing, particles freeze in place and linger
 * briefly before fading out. Suitable for hail, falling rocks, shattered crystal, etc.
 * Has both `configure` (builds the generator) and `finalize` (injects scale/tint animation).
 * @type {VFXAnimationBlock}
 */
export const fallingDebris = {
  configure({prefix, origin, radius, textures, coverageArea, density = 1.0,
    count, duration = 2500, fallDuration = 350, stickDuration = 800,
    startScale = 4.0, endScale = 1.0, darkening = 0.4,
    alpha = {min: 0.7, max: 1.0}, scale = {min: 0.3, max: 0.6},
    perFrame, elevation = 0, sort = 1, pointSourceMask, position = 0} = {}) {
    const gridScale = getParticleScaleFactor();
    const FADE_OUT = 600;
    const scaled = _scaledParticleCounts({baseCount: 200, basePerFrame: 2, coverageArea, radius, density});
    perFrame ??= Math.max(1, scaled.perFrame);
    const particleLifetime = duration + FADE_OUT;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius},
      count: null,
      duration,
      lifetime: {min: particleLifetime - 100, max: particleLifetime + 100},
      fade: {in: 30, out: FADE_OUT},
      alpha,
      scale,
      initial: 0.0,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      rotation: {spread: Math.PI},
      config: {
        fallingDebris: {fallDuration, startScale, endScale, darkening},
        velocity: {speed: [10 * gridScale, 30 * gridScale], angle: [0, 360]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  },

  finalize(vfxEffect, references) {
    for ( const component of Object.values(vfxEffect.components) ) {
      if ( component.type !== "particleGenerator" ) continue;
      if ( component.config?.fallingDebris ) _finalizeFallingDebris(component);
    }
  }
};

/* -------------------------------------------- */

/**
 * Inject onSpawn and onUpdate callbacks for falling debris particles.
 * @param {object} component
 */
function _finalizeFallingDebris(component) {
  const {fallDuration, startScale, endScale, darkening} = component.config.fallingDebris;

  component.config.onSpawn = (p) => {
    p._baseScale = p.scale.x;
    p.scale.set(p._baseScale * startScale, p._baseScale * startScale);
    p.tint = 0xFFFFFF;
    p._landed = false;
  };

  component.config.onUpdate = (p) => {
    if ( p._landed ) return;
    if ( p.elapsedTime >= fallDuration ) {
      p._landed = true;
      p.movementSpeed.x = 0;
      p.movementSpeed.y = 0;
      p.scale.set(p._baseScale * endScale, p._baseScale * endScale);
      const b = Math.round(255 * (1.0 - darkening));
      p.tint = (b << 16) | (b << 8) | b;
      return;
    }
    const t = Math.clamp(p.elapsedTime / fallDuration, 0, 1);
    const s = p._baseScale * (startScale + (t * (endScale - startScale)));
    p.scale.set(s, s);
    const b = Math.round(255 * (1.0 - (t * darkening)));
    p.tint = (b << 16) | (b << 8) | b;
  };
}

/* -------------------------------------------- */

/**
 * A sweeping arm emitter that rotates across a cone arc over time. Particles spawn in a ring
 * around the cone origin and are relocated to a narrow arc around the current sweep angle.
 * Velocity is overridden to fly radially outward. The sweep direction is randomized each cast.
 * Cone-specific: the sweep arm and cone reflection are inherent to the behavior.
 * Has both `configure` (builds the generator) and `finalize` (injects sweep callbacks).
 * @type {VFXAnimationBlock}
 */
export const coneSweepEmitter = {
  configure({prefix, origin, radius, angle, rotation, textures,
    duration = 400, radialSpeed = 800, innerRadius, outerRadius,
    alpha = {min: 0.7, max: 1.0}, scale = {min: 0.375, max: 0.6},
    perFrame = 6, elevation = 0, sort = 1, pointSourceMask, position = 0} = {}) {
    const gridScale = getParticleScaleFactor();
    const speed = radialSpeed * gridScale;
    innerRadius ??= Math.round(radius * 0.15);
    outerRadius ??= Math.round(innerRadius * 1.3);
    const rotationRad = Math.toRadians(rotation);
    const halfAngleRad = Math.toRadians(angle / 2);
    const sweepCW = Math.random() > 0.5;
    const startAngleRad = Math.toRadians(rotation + (sweepCW ? -(angle / 2) : (angle / 2)));
    const endAngleRad = Math.toRadians(rotation + (sweepCW ? (angle / 2) : -(angle / 2)));
    const lifetime = Math.round(radius / speed * 1000 * 1.2);
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: [innerRadius, outerRadius]},
      count: null,
      duration,
      lifetime: {min: Math.round(lifetime * 0.5), max: lifetime},
      fade: {in: 30, out: Math.round(lifetime * 0.4)},
      alpha,
      scale,
      initial: 0.0,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      rotation: {alignVelocity: true, spread: 0.1},
      config: {
        coneSweep: {originX: origin.x, originY: origin.y, startAngleRad, endAngleRad,
          halfAngleRad, rotationRad, duration, radialSpeed: speed},
        velocity: {speed: [speed * 0.7, speed * 1.3], angle: [rotation - 5, rotation + 5]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  },

  finalize(vfxEffect, references) {
    for ( const component of Object.values(vfxEffect.components) ) {
      if ( component.type !== "particleGenerator" ) continue;
      if ( component.config?.coneSweep ) _finalizeConeSweep(component);
    }
  }
};

/* -------------------------------------------- */

/**
 * Inject onTick and onSpawn callbacks for the cone sweep emitter.
 * @param {object} component
 */
function _finalizeConeSweep(component) {
  const {originX, originY, startAngleRad, endAngleRad, halfAngleRad, rotationRad,
    duration, radialSpeed} = component.config.coneSweep;
  let elapsed = 0;
  let currentAngleRad = startAngleRad;

  component.config.onTick = (dt, generator) => {
    elapsed += dt;
    const t = Math.clamp(elapsed / duration, 0, 1);
    currentAngleRad = startAngleRad + (t * (endAngleRad - startAngleRad));
    if ( CONFIG.debug.vfx && (Math.round(elapsed) % 100 < dt) ) {
      console.debug("coneSweep", {t: t.toFixed(2), angle: Math.toDegrees(currentAngleRad).toFixed(1), alive: generator.particles.length});
    }
  };

  const ARM_SPREAD = 0.15;
  component.config.onSpawn = (p, {generator}) => {
    const sceneX = p.x + generator.bounds.x;
    const sceneY = p.y + generator.bounds.y;
    const dist = Math.hypot(sceneX - originX, sceneY - originY);
    const particleAngle = currentAngleRad + ((Math.random() * 2 - 1) * ARM_SPREAD);
    p.x = originX + (Math.cos(particleAngle) * dist) - generator.bounds.x;
    p.y = originY + (Math.sin(particleAngle) * dist) - generator.bounds.y;
    const speed = radialSpeed * (0.7 + (Math.random() * 0.6));
    p.movementSpeed.x = Math.cos(particleAngle) * speed;
    p.movementSpeed.y = Math.sin(particleAngle) * speed;
    p.rotation = particleAngle + ((Math.random() - 0.5) * 0.2);
  };
}

/* -------------------------------------------- */

/**
 * An expanding cascade that spawns particles in a ring that grows outward from the origin.
 * When cone constraint parameters are provided, out-of-cone particles are reflected back in.
 * Without cone parameters, the cascade expands as a full circle.
 * Has both `configure` (builds the generator) and `finalize` (injects expanding ring callbacks).
 * @type {VFXAnimationBlock}
 */
export const expandingCascade = {
  configure({prefix, origin, radius, textures, coverageArea, density = 1.0,
    duration = 1000, coneAngle, coneRotation,
    alpha = {min: 0.5, max: 0.8}, scale = {min: 0.8, max: 1.2},
    perFrame, elevation = 0, sort = 0, pointSourceMask, position = 0} = {}) {
    const rotationRad = coneRotation !== undefined ? Math.toRadians(coneRotation) : 0;
    const halfAngleRad = coneAngle !== undefined ? Math.toRadians(coneAngle / 2) : Math.PI;
    const maxRadius = Math.round(radius * 0.85);
    const scaled = _scaledParticleCounts({baseCount: 200, basePerFrame: 4, coverageArea, radius, density});
    perFrame ??= scaled.perFrame;
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: [0, Math.round(radius * 0.17)]},
      count: null,
      duration,
      lifetime: {min: 400, max: 700},
      fade: {in: 20, out: 400},
      alpha,
      scale,
      initial: 0.0,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      rotation: {initial: rotationRad, spread: 0.2},
      config: {
        expandingCascade: {originX: origin.x, originY: origin.y, rotationRad, halfAngleRad,
          maxRadius, duration},
        velocity: {speed: [2, 5], angle: [coneRotation ?? 0 - 1, coneRotation ?? 0 + 1]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  },

  finalize(vfxEffect, references) {
    for ( const component of Object.values(vfxEffect.components) ) {
      if ( component.type !== "particleGenerator" ) continue;
      if ( component.config?.expandingCascade ) _finalizeExpandingCascade(component);
    }
  }
};

/* -------------------------------------------- */

/**
 * Inject onTick and onSpawn callbacks for the expanding cascade.
 * onTick animates the spawn ring outward. onSpawn reflects out-of-cone particles when constrained.
 * @param {object} component
 */
function _finalizeExpandingCascade(component) {
  const {originX, originY, rotationRad, halfAngleRad, maxRadius, duration} = component.config.expandingCascade;
  const isCone = halfAngleRad < Math.PI;
  let elapsed = 0;

  component.config.onTick = (dt, generator) => {
    elapsed += dt;
    const t = Math.clamp(elapsed / duration, 0, 1);
    const ringWidth = maxRadius * 0.2;
    const centerRadius = t * maxRadius;
    const inner = Math.max(0, centerRadius - (ringWidth / 2));
    const outer = centerRadius + (ringWidth / 2);
    const area = generator.spawnArea;
    area.x = originX;
    area.y = originY;
    area.radius = [inner, outer];
    if ( CONFIG.debug.vfx && (Math.round(elapsed) % 100 < dt) ) {
      console.debug("expandingCascade", {t: t.toFixed(2), alive: generator.particles.length, inner: Math.round(inner), outer: Math.round(outer)});
    }
  };

  component.config.onSpawn = (p, {generator}) => {
    if ( !isCone ) return;
    const sceneX = p.x + generator.bounds.x;
    const sceneY = p.y + generator.bounds.y;
    const dist = Math.hypot(sceneX - originX, sceneY - originY);
    let particleAngle = Math.atan2(sceneY - originY, sceneX - originX);
    let delta = particleAngle - rotationRad;
    while ( delta > Math.PI ) delta -= Math.PI * 2;
    while ( delta < -Math.PI ) delta += Math.PI * 2;
    if ( Math.abs(delta) > halfAngleRad ) {
      particleAngle = rotationRad + ((Math.random() * 2 - 1) * halfAngleRad);
      p.x = originX + (Math.cos(particleAngle) * dist) - generator.bounds.x;
      p.y = originY + (Math.sin(particleAngle) * dist) - generator.bounds.y;
    }
    p.rotation = particleAngle + ((Math.random() - 0.5) * 0.3);
  };
}

/* -------------------------------------------- */

/**
 * A linear cascade of impact particles that marches outward from an origin point along a
 * directional axis. Particles spawn at an advancing front that progresses from origin to the
 * endpoint over the duration, creating a "chunk chunk chunk" effect of impacts growing along
 * the ground. Particles are stationary once spawned.
 * Has both `configure` (builds the generator) and `finalize` (injects marching spawn callbacks).
 * @type {VFXAnimationBlock}
 */
export const linearCascade = {
  configure({prefix, origin, rotation, length, width, textures,
    duration = 2000, spacing = 20,
    alpha = {min: 0.6, max: 0.9}, scale = {min: 0.6, max: 1.0},
    perFrame, elevation = 0, sort = 0, pointSourceMask, position = 0} = {}) {
    const gridScale = getParticleScaleFactor();
    const rotationRad = Math.toRadians(rotation);
    const halfWidth = (width ?? 20) * gridScale;
    const totalParticles = Math.ceil(length / (spacing * gridScale));
    perFrame ??= Math.max(1, Math.round(totalParticles / (duration / 1000 * 60)));
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: 4},
      count: null,
      duration,
      lifetime: {min: duration + 1000, max: duration + 2000},
      fade: {in: 0, out: 800},
      alpha,
      scale,
      initial: 0.0,
      perFrame,
      elevation,
      sort,
      pointSourceMask,
      rotation: {initial: rotationRad, spread: 0.3},
      config: {
        linearCascade: {originX: origin.x, originY: origin.y, rotationRad, length, halfWidth, duration},
        velocity: {speed: [0, 0], angle: [0, 360]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  },

  finalize(vfxEffect, references) {
    for ( const component of Object.values(vfxEffect.components) ) {
      if ( component.type !== "particleGenerator" ) continue;
      if ( component.config?.linearCascade ) _finalizeLinearCascade(component);
    }
  }
};

/* -------------------------------------------- */

/**
 * Inject onTick and onSpawn callbacks for the linear cascade.
 * onTick tracks the advancing front distance. onSpawn places each particle at the current
 * front position with random lateral offset.
 * @param {object} component
 */
function _finalizeLinearCascade(component) {
  const {originX, originY, rotationRad, length, halfWidth, duration} = component.config.linearCascade;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const perpCos = Math.cos(rotationRad + Math.PI / 2);
  const perpSin = Math.sin(rotationRad + Math.PI / 2);
  let elapsed = 0;
  let frontDist = 0;

  component.config.onTick = (dt, generator) => {
    elapsed += dt;
    const t = Math.clamp(elapsed / duration, 0, 1);
    frontDist = t * length;
    if ( CONFIG.debug.vfx && (Math.round(elapsed) % 200 < dt) ) {
      console.debug("linearCascade", {t: t.toFixed(2), frontDist: Math.round(frontDist), alive: generator.particles.length});
    }
  };

  component.config.onSpawn = (p, {generator}) => {
    // Place particle at the current front position with lateral jitter
    const dist = frontDist * (0.85 + (Math.random() * 0.15));
    const lateral = (Math.random() * 2 - 1) * halfWidth;
    const sceneX = originX + (cosR * dist) + (perpCos * lateral);
    const sceneY = originY + (sinR * dist) + (perpSin * lateral);
    p.x = sceneX - generator.bounds.x;
    p.y = sceneY - generator.bounds.y;
    p.movementSpeed.x = 0;
    p.movementSpeed.y = 0;
  };
}

/* -------------------------------------------- */

/**
 * A three-phase implosion-explosion effect using a single particle generator.
 * Phase 1 (Implode): particles spawn in a ring and converge inward toward a crystal ring.
 * Phase 2 (Hold): particles rest in the crystal ring while the container shakes with building energy.
 * Phase 3 (Explode): particles reverse direction and blast outward to fill the effect radius.
 * The same particles are reused across all three phases via per-particle velocity manipulation.
 * Has both `configure` (builds the generator) and `finalize` (injects runtime callbacks).
 * @type {VFXAnimationBlock}
 */
export const implodeExplode = {
  configure({prefix, origin, radius, textures, coverageArea, density = 1.0,
    count, spawnRadius, innerRadius = 50,
    implodeDuration = 500, holdDuration = 800, explodeDuration = 800,
    explodeSpeed,
    alpha = {min: 0.6, max: 1.0}, scale,
    elevation = 0, sort = 0, pointSourceMask,
    shakeDuration = 350, shakeIntensity = 6,
    position = 0} = {}) {
    spawnRadius ??= Math.round(radius * 0.4);
    explodeSpeed ??= 800 * getParticleScaleFactor();
    const radiusScale = Math.clamp(radius / 300, 0.5, 1.5);
    scale ??= {min: 0.3 * radiusScale, max: 0.8 * radiusScale};
    const totalDuration = implodeDuration + holdDuration + explodeDuration;
    const scaled = _scaledParticleCounts({baseCount: 300, basePerFrame: 25, coverageArea, radius, density});
    count ??= Math.max(200, scaled.count);
    const component = particleGenerator({
      textures,
      area: {x: origin.x, y: origin.y, radius: [Math.round(spawnRadius * 0.7), spawnRadius]},
      count,
      duration: totalDuration + 5000,
      lifetime: {min: totalDuration + 500, max: totalDuration + 1000},
      fade: {in: 50, out: explodeDuration},
      alpha,
      scale,
      initial: 1.0,
      perFrame: scaled.perFrame,
      elevation,
      sort,
      pointSourceMask,
      rotation: {alignVelocity: true, spread: 0.2},
      config: {
        implodeExplode: {
          originX: origin.x, originY: origin.y, innerRadius, radius,
          implodeDuration, holdDuration, explodeDuration, explodeSpeed,
          shakeDuration, shakeIntensity
        },
        velocity: {speed: [50, 200], angle: [0, 360]}
      }
    });
    return {
      components: {[prefix]: component},
      timeline: [{component: prefix, position}],
      references: {}
    };
  },

  finalize(vfxEffect, references) {
    for ( const component of Object.values(vfxEffect.components) ) {
      if ( component.type !== "particleGenerator" ) continue;
      if ( component.config?.implodeExplode ) _finalizeImplodeExplode(component);
    }
  }
};

/* -------------------------------------------- */

/**
 * Inject onSpawn, onUpdate, and onTick callbacks for the implode-explode effect.
 * onSpawn computes distance-based inward velocity so all particles arrive at the crystal ring
 * at roughly the same time. onUpdate modulates velocity across three phases. onTick triggers
 * the shake effect during the hold phase.
 * @param {object} component
 */
function _finalizeImplodeExplode(component) {
  const {originX, originY, innerRadius, radius, implodeDuration, holdDuration, explodeDuration,
    explodeSpeed, shakeDuration, shakeIntensity} = component.config.implodeExplode;
  const holdStart = implodeDuration;
  const explodeStart = implodeDuration + holdDuration;
  const FADE_OUT_MS = 200;
  const implodeSec = implodeDuration / 1000;
  let elapsed = 0;

  // Compute distance-based inward velocity and store radial angle per particle.
  // Each particle's speed is calibrated so it reaches the crystal ring by the end of the implode phase.
  component.config.onSpawn = (p, {generator}) => {
    const sceneX = p.x + generator.bounds.x;
    const sceneY = p.y + generator.bounds.y;
    const dist = Math.hypot(sceneX - originX, sceneY - originY);
    const angle = Math.atan2(sceneY - originY, sceneX - originX);
    const targetRadius = innerRadius * (0.5 + (Math.random() * 0.5));
    const travelDist = Math.max(0, dist - targetRadius);
    const speed = travelDist / implodeSec;
    p._radialAngle = angle;
    p._targetRadius = targetRadius;
    p._explodeSpeed = explodeSpeed * (0.7 + (Math.random() * 0.6));
    p._arrived = false;
    p.movementSpeed.x = -Math.cos(angle) * speed;
    p.movementSpeed.y = -Math.sin(angle) * speed;
    p.rotation = angle + Math.PI;
  };

  // Track elapsed time, stop spawning after initial burst, and trigger shake during hold
  let lastPhase = 0;
  let spawningStopped = false;
  let shakeStarted = false;
  component.config.onTick = (dt, generator) => {
    elapsed += dt;
    if ( !spawningStopped && (elapsed > 100) ) {
      spawningStopped = true;
      generator.manualSpawning = true;
    }
    const shakeDelay = holdStart + (holdDuration * 0.3);
    if ( !shakeStarted && (elapsed >= shakeDelay) && (shakeIntensity > 0) && generator.particlesContainer ) {
      shakeStarted = true;
      const remainingHold = explodeStart - elapsed;
      const shake = new foundry.canvas.animation.CanvasShakeEffect({
        target: generator.particlesContainer,
        duration: remainingHold + explodeDuration,
        maxDisplacement: shakeIntensity,
        smoothness: 0.3,
        returnSpeed: 0.3
      });
      shake.play();
    }
    if ( CONFIG.debug.vfx ) {
      const phase = (elapsed < holdStart) ? 1 : (elapsed < explodeStart) ? 2 : 3;
      if ( phase !== lastPhase ) {
        lastPhase = phase;
        console.debug("implodeExplode", {phase, elapsed: Math.round(elapsed), alive: generator.particles.length});
      }
    }
  };

  // Per-particle velocity modulation based on the current phase
  component.config.onUpdate = (p, {generator}) => {
    if ( p._radialAngle === undefined ) return;
    const angle = p._radialAngle;

    if ( elapsed < holdStart ) {
      // Phase 1 - Implode: check if particle reached the inner ring, clamp if so
      if ( !p._arrived ) {
        const sceneX = p.x + generator.bounds.x;
        const sceneY = p.y + generator.bounds.y;
        const dist = Math.hypot(sceneX - originX, sceneY - originY);
        if ( dist <= p._targetRadius ) {
          p._arrived = true;
          // Snap to target position on the inner ring to prevent overshoot
          const angle = p._radialAngle;
          p.x = originX + (Math.cos(angle) * p._targetRadius) - generator.bounds.x;
          p.y = originY + (Math.sin(angle) * p._targetRadius) - generator.bounds.y;
          p.movementSpeed.x = 0;
          p.movementSpeed.y = 0;
        }
      } else {
        p.movementSpeed.x = 0;
        p.movementSpeed.y = 0;
      }
    } else if ( elapsed < explodeStart ) {
      // Phase 2 - Hold: zero velocity
      p.movementSpeed.x = 0;
      p.movementSpeed.y = 0;
    } else {
      // Phase 3 - Explode: constant outward velocity, fade when exceeding blast radius
      const sceneX = p.x + generator.bounds.x;
      const sceneY = p.y + generator.bounds.y;
      const dist = Math.hypot(sceneX - originX, sceneY - originY);
      if ( dist > radius ) {
        p.movementSpeed.x = 0;
        p.movementSpeed.y = 0;
        if ( p.lifetime - p.elapsedTime > FADE_OUT_MS ) p.elapsedTime = p.lifetime - FADE_OUT_MS;
      } else {
        const speed = p._explodeSpeed;
        p.movementSpeed.x = Math.cos(angle) * speed;
        p.movementSpeed.y = Math.sin(angle) * speed;
      }
      p.rotation = angle;
    }
  };
}
