/**
 * Choose a random sound to play from a provided list of options.
 * Prefix the returned path with a specific path prefix
 * @param {string} domain     The outer domain in VFX_SOUNDS
 * @param {string} key        The inner key that provides a list of sound files
 * @returns {string}
 */
export function getRandomSound(domain, key) {
  const d = VFX_SOUNDS[domain];
  const list = d[key];
  const src = list[Math.floor(Math.random() * list.length)];
  return `${d.prefix}/${src}`;
}

/* -------------------------------------------- */

/**
 * A library of available VFX sounds to be used in animation.
 * @type {Record<string, Record<string, string[]|string>>}
 */
export const VFX_SOUNDS = {
  bow: {
    prefix: "systems/crucible/assets/sfx/projectile",
    draw: ["BowDraw1.ogg", "BowDraw2.ogg", "BowDraw3.ogg"]
  },
  projectile: {
    prefix: "systems/crucible/assets/sfx/projectile",
    flight: ["ArrowLoose1.ogg", "ArrowLoose2.ogg", "ArrowLoose3.ogg"],
    block: ["ArrowBlock1.ogg", "ArrowBlock2.ogg", "ArrowBlock3.ogg"],
    hitCreature: ["ArrowHitCreature1.ogg", "ArrowHitCreature2.ogg"],
    hitObject: ["ArrowHitObject1.ogg", "ArrowHitObject2.ogg"],
    miss: ["ArrowMiss1.ogg", "ArrowMiss2.ogg", "ArrowMiss3.ogg"]
  }
};

/* -------------------------------------------- */
/*  Spell Sound Library                         */
/* -------------------------------------------- */

/**
 * @typedef VFXSoundEntry
 * @property {string} src         Filename within the rune's prefix directory.
 * @property {boolean} [loop]     Whether the sample is a looping segment (S2 passive, S3 damage).
 * @property {number} [duration]  Measured playback duration in seconds (S1 charge, S4 impact).
 */

/**
 * @typedef VFXSoundDescriptor
 * @property {string} src             Full path to the chosen sound file.
 * @property {boolean} loop           Whether the sample loops.
 * @property {number|null} duration   Known duration in seconds, or null if unknown.
 */

/**
 * Per-rune spell sound library, the audio analog of the per-rune texture library (VFX_TEXTURES):
 * static reference data describing which sound files exist for each rune and their
 * playback metadata. Sound types follow the S1-S4 taxonomy: `charge` (S1 one-shot), `passive`
 * (S2 loop), `damage` (S3 loop), `impact` (S4 one-shot), plus `miss` (one-shot, played when a spell
 * is resisted or misses). The pseudo-rune `generic` holds rune-agnostic sounds such as the
 * projectile `whoosh`.
 * @type {Record<string, {prefix: string} & Record<string, VFXSoundEntry[]>>}
 */
export const RUNE_SOUNDS = {
  frost: {
    prefix: "systems/crucible/assets/sfx/frost",
    charge: [{src: "FrostChargeUpMedium.ogg", duration: 1.409}],
    passive: [{src: "FrostLoopPassive.ogg", loop: true}],
    damage: [{src: "FrostLoopDamage.ogg", loop: true}],
    impact: [
      {src: "FrostImpact1.ogg", duration: 2.022},
      {src: "FrostImpact2.ogg", duration: 2.861},
      {src: "FrostImpact3.ogg", duration: 3.111}
    ],
    miss: [
      {src: "FrostMiss1.ogg", duration: 0.988},
      {src: "FrostMiss2.ogg", duration: 1.018}
    ]
  },
  flame: {
    prefix: "systems/crucible/assets/sfx/flame",
    // FlameChargeUpLarge.ogg (1.669s) is reserved for larger gestures; the arrow uses the medium charge.
    charge: [{src: "FlameChargeUpMedium.ogg", duration: 1.562}],
    passive: [{src: "FlameLoopPassive.ogg", loop: true}],
    damage: [{src: "FlameLoopDamage.ogg", loop: true}],
    impact: [
      {src: "FlameImpact1.ogg", duration: 1.915},
      {src: "FlameImpact2.ogg", duration: 2.013}
    ],
    impactHeavy: [
      {src: "FlameImpactHeavy1.ogg", duration: 1.850},
      {src: "FlameImpactHeavy2.ogg", duration: 1.915},
      {src: "FlameImpactHeavy3.ogg", duration: 2.013}
    ],
    miss: [
      {src: "FlameMiss1.ogg", duration: 1.092},
      {src: "FlameMiss2.ogg", duration: 1.395}
    ]
  },
  life: {
    prefix: "systems/crucible/assets/sfx/life",
    charge: [{src: "LifeChargeUp.ogg", duration: 1.456}],
    passive: [{src: "LifeLoopPassive.ogg", loop: true}],
    damage: [{src: "LifeActiveLoop.ogg", loop: true}],
    impact: [
      {src: "LifeImpact1.ogg", duration: 1.683},
      {src: "LifeImpact2.ogg", duration: 1.765}
    ],
    miss: [
      {src: "LifeMiss1.ogg", duration: 1.241},
      {src: "LifeMiss2.ogg", duration: 1.215}
    ]
  },
  generic: {
    prefix: "systems/crucible/assets/sfx/generic",
    charge: [{src: "MagicChargeUp.ogg", duration: 1.819}],
    whooshFast: [{src: "WhooshFast.ogg", duration: 0.200}],
    whooshMedium: [{src: "WhooshMedium.ogg", duration: 0.500}]
  }
};

/* -------------------------------------------- */

/**
 * Resolve a sound of a given type for a rune, choosing a random variant. Returns a fully-resolved
 * descriptor, or null if the rune has no such sound. Variant selection happens here so the choice is
 * made once on the originating client and baked into the serialized component config.
 * @param {string} rune    Rune id, or "generic" for rune-agnostic sounds.
 * @param {string} type    Sound type: "charge" | "passive" | "damage" | "impact" | "impactHeavy" | "miss" | "whoosh".
 * @returns {VFXSoundDescriptor|null}
 */
export function getVFXSound(rune, type) {
  const lib = RUNE_SOUNDS[rune];
  const entries = lib?.[type];
  if ( !entries?.length ) return null;
  const entry = entries[Math.floor(Math.random() * entries.length)];
  return {src: `${lib.prefix}/${entry.src}`, loop: entry.loop ?? false, duration: entry.duration ?? null};
}

/* -------------------------------------------- */

/**
 * Resolve the full set of src paths for a rune/type, for building preload manifests when a gesture
 * triggers sounds procedurally (and so cannot enumerate exact cues ahead of time).
 * @param {string} rune    Rune id, or "generic".
 * @param {string} type    Sound type.
 * @returns {string[]}     All srcs of that type for the rune (empty if none).
 */
export function getVFXSoundSet(rune, type) {
  const lib = RUNE_SOUNDS[rune];
  const entries = lib?.[type];
  if ( !entries?.length ) return [];
  return entries.map(e => `${lib.prefix}/${e.src}`);
}
