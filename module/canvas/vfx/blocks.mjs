/**
 * A global particle scale multiplier derived from the canvas grid size.
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
 * Per-performance-mode density multipliers applied to every particle layer's `spawnRate`, `count`,
 * `initial`, and any animated `spawnRateEnd`. Lower values reduce particle quantity at lower
 * performance modes without changing visual fidelity (size, lifetime, blend). Resolved once at
 * ready-time onto `canvas.performance.particleDensity` by {@link configurePerformanceMode}.
 * @type {Record<number, number>}
 */
const PARTICLE_DENSITY_FACTORS = {
  [CONST.CANVAS_PERFORMANCE_MODES.LOW]: 0.25,
  [CONST.CANVAS_PERFORMANCE_MODES.MED]: 0.5,
  [CONST.CANVAS_PERFORMANCE_MODES.HIGH]: 1.0,
  [CONST.CANVAS_PERFORMANCE_MODES.MAX]: 1.0
};

/**
 * The quantity at or below which a particle layer is treated as "hero" and exempted from density
 * thinning. A layer of a few deliberately placed particles (the six yo-yo discs of a fan, a burst of
 * ground bones) cannot be scaled down without changing what the effect *is*, whereas a layer of
 * hundreds thins invisibly. Density therefore never reduces a quantity below this value, and never
 * touches one that started at or below it.
 * @type {number}
 */
export const PARTICLE_DENSITY_FLOOR = 10;

/**
 * Apply performance density to a single particle quantity, honoring {@link PARTICLE_DENSITY_FLOOR}.
 * At HIGH/MAX (density 1.0) this is the identity for every input.
 * @param {number} value     The configured quantity (`count`, `initial`, or `spawnRate`).
 * @param {number} density   The active `canvas.performance.particleDensity`.
 * @returns {number}
 */
export function applyParticleDensity(value, density) {
  if ( !(value > PARTICLE_DENSITY_FLOOR) ) return value;
  return Math.max(PARTICLE_DENSITY_FLOOR, value * density);
}

/**
 * Cache performance-mode-derived values onto `canvas.performance` for direct read access by
 * Crucible consumers. Called once during the ready hook; changing performance mode at runtime
 * requires a session reload to take effect, so a one-shot computation is sufficient.
 * Writes `canvas.performance.particleDensity` using {@link PARTICLE_DENSITY_FACTORS}.
 * Photosensitivity Mode forces the effective performance mode to LOW.
 */
export function configurePerformanceMode() {
  if ( !canvas?.performance ) return;
  const mode = canvas.photosensitiveMode ? CONST.CANVAS_PERFORMANCE_MODES.LOW : canvas.performance.mode;
  canvas.performance.particleDensity = PARTICLE_DENSITY_FACTORS[mode] ?? 1.0;
}
