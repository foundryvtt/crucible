import {buildMeleeStrikes} from "./strikes.mjs";

export * as animations from "./animations/_module.mjs";
export * as blocks from "./blocks.mjs";
export * as equipment from "./equipment.mjs";
export * as landing from "./landing.mjs";
export * as sounds from "./sounds.mjs";
export * as spells from "./spells.mjs";
export * as sprites from "./sprites.mjs";
export * as strikes from "./strikes.mjs";
export {default as CrucibleFlipbookMesh} from "./flipbook-mesh.mjs";

/**
 * @import {MeleeStrikeOptions} from "./strikes.mjs";
 */

/**
 * Set the VFX playback rate for debugging. Controls both the animejs engine speed and the
 * canvas ticker speed so animations play in synchronized slow motion.
 * @param {number} rate    Playback rate multiplier (e.g., 0.25 for quarter speed, 1.0 for normal)
 * @example crucible.api.canvas.vfx.setPlaybackRate(0.25);
 */
export function setPlaybackRate(rate) {
  globalThis.animejs.engine.speed = rate;
  if ( globalThis.canvas?.app?.ticker ) globalThis.canvas.app.ticker.speed = rate;
}

/* -------------------------------------------- */

/**
 * Play melee strikes from the controlled token at each targeted token, outside of any Action, for calibration.
 * The per-strike `result`, `hand`, and `mirror` may be arrays, cycled across the targets in order.
 * @param {MeleeStrikeOptions & {concurrency?: number, result?: string|string[], critical?: boolean,
 *   hand?: string|string[], mirror?: boolean|boolean[]}} [options]   The attack style, plus result keys of
 *   AttackRoll.RESULT_TYPES such as "hit" or "parry"
 * @returns {Promise<void>}
 * @example crucible.api.canvas.vfx.previewStrike({lunge: true, result: ["hit", "parry"], hand: ["right", "left"]});
 */
export async function previewStrike({result="hit", critical=false, hand="right", mirror=false,
  damageType="piercing", size="medium", ...options}={}) {
  const token = canvas.tokens.controlled[0];
  const targets = Array.from(game.user.targets).filter(t => t !== token);
  if ( !token || !targets.length ) {
    ui.notifications.warn("Control an attacking token and target at least one other token.");
    return;
  }

  // One strike per target, cycling through the requested patterns
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const cycle = (value, i) => [value].flat()[i % [value].flat().length];
  const references = {tokenMesh: token.mesh};
  const strikes = targets.map((target, i) => {
    const meshRef = `target_${i + 1}_tokenMesh`;
    references[meshRef] = target.mesh;
    return {target: target.document, meshRef, result: T[cycle(result, i).toUpperCase()], critical,
      hand: cycle(hand, i), mirror: cycle(mirror, i)};
  });

  const built = buildMeleeStrikes(token.document, strikes, {damageType, size, ...options});
  if ( !built ) {
    ui.notifications.warn(`No melee strike preset for "${damageType}" "${size}".`);
    return;
  }
  const {components, timeline} = built;
  const effect = new foundry.canvas.vfx.VFXEffect({name: "previewStrike", components, timeline});
  await effect.play(references);
}
