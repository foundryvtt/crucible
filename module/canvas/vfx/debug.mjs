import {MELEE_STRIKE_SOUNDS, buildMeleeStrikes, chooseMeleeStrikeSamples} from "./strikes.mjs";

/**
 * VFX debugging tools for the console, exposed as crucible.api.canvas.vfx.debug.
 */

/**
 * @import {MeleeStrikeOptions} from "./strikes.mjs";
 */

/**
 * A synthetic attack outcome against one target of {@link previewAttack}.
 * @typedef AttackPreviewOutcome
 * @property {string} [result="hit"]      A key of AttackRoll.RESULT_TYPES such as "hit", "parry", or "miss"
 * @property {boolean} [critical=false]   A critical success
 * @property {string} [damageType]        The damage type dealt; the weapon's or spell's own by default
 * @property {string} [resource="health"] The resource the attack targets
 * @property {number} [total=10]          The damage total; 0 for an attack resisted to nothing
 * @property {boolean} [healing=false]    The attack restores its resource rather than harming it
 */

/* -------------------------------------------- */

/**
 * Play an action's real VFX from the controlled token at each targeted token with synthetic attack rolls, so outcomes
 * can be viewed without performing the action or the actor knowing its spellcraft. Single-target actions only.
 * @param {string} actionId     A composed spell id like "spell.flame.arrow", or an Action id of the controlled actor
 * @param {AttackPreviewOutcome|AttackPreviewOutcome[]} [outcomes]   Outcomes cycled across the targets in order
 * @returns {Promise<void>}
 * @example crucible.api.canvas.vfx.debug.previewAttack("spell.flame.arrow", [{result: "hit"}, {total: 0}]);
 */
export async function previewAttack(actionId, outcomes={}) {
  const token = canvas.tokens.controlled[0];
  const targets = Array.from(game.user.targets).filter(t => t !== token);
  if ( !token?.actor || !targets.length ) {
    ui.notifications.warn("Control an acting token and target at least one other token.");
    return;
  }

  // A real action for the controlled actor, which need not know or be able to use it
  const actor = token.actor;
  const context = {actor, token: token.document};
  const base = actor.actions[actionId];
  const action = actionId.startsWith("spell.")
    ? crucible.api.models.CrucibleSpellAction.fromId(actionId, context)
    : base?.clone({}, {parent: base.parent, ...context});
  if ( !action ) {
    ui.notifications.warn(`The controlled actor has no Action "${actionId}".`);
    return;
  }

  // One synthetic attack roll per strike against each target
  // TODO bypasses target acquisition: a region for area gestures and movement for knockback are not synthesized
  const {AttackRoll} = crucible.api.dice;
  action.targets = new Map(targets.map(t => [t.actor, {token: t.document, actor: t.actor, uuid: t.actor.uuid,
    name: t.name}]));
  const strikes = action.usage.strikes ?? [];
  const cycle = [outcomes].flat();
  for ( const [i, target] of targets.entries() ) {
    const {result="hit", critical=false, damageType, resource="health", total=10, healing=false} =
      cycle[i % cycle.length];
    for ( let s = 0; s < Math.max(strikes.length, 1); s++ ) {
      const type = damageType ?? strikes[s]?.system.damageType ?? action.damage?.type;
      // Construction drops data keys absent from defaultData, so assign the outcome after it, as the strike tag does
      const roll = new AttackRoll({actorId: actor.id});
      Object.assign(roll.data, {result: AttackRoll.RESULT_TYPES[result.toUpperCase()], resource, restoration: healing,
        strike: s, damage: {total, type, resource, restoration: healing}});
      Object.defineProperty(roll, "isCriticalSuccess", {value: critical}); // Otherwise requires an evaluated roll
      action.recordEvent({type: "strike", target: target.actor, roll});
    }
  }

  // Configure and play exactly as a confirmed action would
  const vfxConfig = action.configureVFXEffect();
  if ( !vfxConfig ) {
    ui.notifications.warn(`Action "${action.id}" configured no VFX for these outcomes.`);
    return;
  }
  const {references, ...config} = vfxConfig;
  await action.playVFXEffect(config, references ?? {});
}

/* -------------------------------------------- */

/**
 * Play melee strikes from the controlled token at each targeted token, outside of any Action, for calibration.
 * The per-strike `result`, `hand`, and `mirror` may be arrays, cycled across the targets in order.
 * @param {MeleeStrikeOptions & {concurrency?: number, result?: string|string[], critical?: boolean,
 *   hand?: string|string[], mirror?: boolean|boolean[]}} [options]   The attack style, plus result keys of
 *   AttackRoll.RESULT_TYPES such as "hit" or "parry"
 * @returns {Promise<void>}
 * @example crucible.api.canvas.vfx.debug.previewMeleeStrike({damageType: "slashing", result: ["hit", "parry"]});
 */
export async function previewMeleeStrike({result="hit", critical=false, hand, mirror=false,
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
  const effect = new foundry.canvas.vfx.VFXEffect({name: "previewMeleeStrike", components, timeline});
  await effect.play(references);
}

/* -------------------------------------------- */

/**
 * Hear the sound layers of a melee strike result at the controlled token, without animation, for tuning.
 * With `compare`, the same samples play again after a gap with those layer overrides merged in.
 * @param {object} [options]
 * @param {string} [options.result="glance"]        A key of AttackRoll.RESULT_TYPES
 * @param {string} [options.damageType="slashing"]  The physical damage type which provides the swing
 * @param {string} [options.armor="heavy"]          The target's armor category
 * @param {object} [options.layers]                 Layer overrides merged into the MELEE_STRIKE_SOUNDS entry
 * @param {object} [options.compare]                Layer overrides for a second playback of the same samples
 * @param {number} [options.gap=1500]               Milliseconds between the two playbacks
 * @returns {Promise<void>}
 * @example
 * crucible.api.canvas.vfx.debug.previewMeleeSound({compare: {contact: {effect: {type: "lowpass", intensity: 1}}}});
 */
export async function previewMeleeSound({result="glance", damageType="slashing", armor="heavy", layers, compare,
  gap=1500}={}) {
  const origin = canvas.tokens.controlled[0]?.center;
  const base = MELEE_STRIKE_SOUNDS[result.toUpperCase()];
  if ( !origin || !base ) {
    ui.notifications.warn("Control a token, and name a result with melee strike sounds.");
    return;
  }

  // Choose the samples once so both playbacks compare the same files
  const merge = (target, overrides) => foundry.utils.mergeObject(foundry.utils.deepClone(target), overrides ?? {});
  const variants = [merge(base, layers)];
  if ( compare ) variants.push(merge(variants[0], compare));
  const samples = chooseMeleeStrikeSamples(variants[0], {damageType, armor});
  const lead = Math.max(samples.swing?.contact ?? 0, samples.contact?.contact ?? 0);
  console.log(`previewMeleeSound samples ${JSON.stringify(samples)}`);

  // Each layer plays from a fresh Sound, since playAtPosition accumulates its effects on the instance
  for ( const [i, variant] of variants.entries() ) {
    console.log(`previewMeleeSound playback ${i + 1} ${JSON.stringify(variant)}`);
    for ( const key of ["swing", "contact"] ) {
      const layer = variant[key];
      const sample = samples[key];
      if ( !layer || !sample ) continue;
      const sound = new foundry.audio.Sound(sample.src, {context: game.audio.environment});
      await sound.load();
      const at = (i * gap) + lead - sample.contact;
      setTimeout(() => sound.playAtPosition(origin, 30, {volume: layer.volume ?? 1, gmAlways: true,
        baseEffect: layer.effect ?? undefined}), at);
    }
  }
}

/* -------------------------------------------- */

/**
 * Set the VFX playback rate, slowing the animejs engine and the canvas ticker together for synchronized slow motion.
 * @param {number} rate    Playback rate multiplier (e.g., 0.25 for quarter speed, 1.0 for normal)
 * @example crucible.api.canvas.vfx.debug.setPlaybackRate(0.25);
 */
export function setPlaybackRate(rate) {
  globalThis.animejs.engine.speed = rate;
  if ( globalThis.canvas?.app?.ticker ) globalThis.canvas.app.ticker.speed = rate;
}
