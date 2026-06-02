/**
 * Tint particles so that they look like earthy dust.
 * @type {number[]}
 */
const DUST_TINTS = [0x6B5238, 0x4A3826, 0x2A1E14];

/* -------------------------------------------- */

/**
 * Configure the VFXEffect data for a token landing after a plummet.
 * @param {CrucibleAction} action  The fall action being animated.
 * @returns {object|null}          The vfxConfig object, or null if the action has no fall to animate.
 */
export function configureLandingVFXEffect(action) {
  const distance = action.usage.fall?.distance;
  if ( !distance || (distance <= 0) ) return null;
  const { token } = action;
  if ( !token ) return null;

  const center = token.getCenterPoint();
  const gridSize = canvas.grid?.size ?? 100;
  const sceneUnitPx = gridSize / (canvas.dimensions?.distance || 5);
  const distancePx = distance * sceneUnitPx;
  const tokenSize = Math.max(token.width, token.height) * gridSize;

  const radius = Math.clamp((tokenSize * .5) + (distancePx * .05), 40, 200);
  const count = Math.clamp(2_500 + Math.floor(distance * 60), 2_500, 10_000);
  const shake = {
    amp: Math.clamp(distance * .4, 0, 18),
    ms: Math.clamp(180 + (distance * 4), 180, 600)
  };

  const components = {
    dust: {
      count,
      area: { reference: "burst" },
      config: {
        alpha: [.95, 1],
        manual: false,
        rotation: [0, 360],
        velocity: { angle: [0, 360], speed: [10, 50] }
      },
      duration: 200,
      fade: { in: 50, out: 400 },
      initial: 1,
      lifetime: { min: 450, max: 950 },
      mode: "effect",
      // PIXI.Texture.WHITE is 16x16, so rendered size = scale * 16. This range yields ~1-2px grains.
      scale: { min: .1, max: .15 },
      // Required to satisfy VFXParticleGeneratorComponent's 'no valid textures' guard. The actual texture used at
      // render time is set per-particle to PIXI.Texture.WHITE in config.onSpawn (see finalizeLandingVFXEffect).
      textures: ["ui/particles/snow.png"],
      type: "particleGenerator"
    }
  };

  if ( shake.amp > 1 ) components.shake = {
    duration: shake.ms,
    maxDisplacement: shake.amp,
    smoothness: .5,
    target: "stage",
    type: "shake"
  };

  const timeline = [{ component: "dust", position: 0 }];
  if ( shake.amp > 1 ) timeline.push({ component: "shake", position: 0 });

  let vfxConfig;
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({ components, timeline, name: "crucible.landingDust" });
    vfxConfig = effect.toObject();
  } catch ( cause ) {
    console.error(new Error(`Landing VFX configuration failed for Action "${action.id}"`, { cause }));
    return null;
  }
  vfxConfig.references = { burst: { x: center.x, y: center.y, radius } };
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Tints each dust particle with a randomized earth tone over a PIXI.Texture.WHITE source.
 * @param {CrucibleAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} _references
 */
export function finalizeLandingVFXEffect(action, vfxEffect, _references) {
  const dust = vfxEffect.components?.dust;
  if ( !dust ) return;
  dust.config.onSpawn = p => {
    p.texture = PIXI.Texture.WHITE;
    p.tint = DUST_TINTS[(Math.random() * DUST_TINTS.length) | 0];
  };
}
