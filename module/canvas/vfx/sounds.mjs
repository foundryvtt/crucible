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
    prefix: "systems/crucible/assets/sounds/projectiles",
    draw: ["BowDraw1.ogg", "BowDraw2.ogg", "BowDraw3.ogg"]
  },
  projectile: {
    prefix: "systems/crucible/assets/sounds/projectiles",
    flight: ["ArrowLoose1.ogg", "ArrowLoose2.ogg", "ArrowLoose3.ogg"],
    block: ["ArrowBlock1.ogg", "ArrowBlock2.ogg", "ArrowBlock3.ogg"],
    hitCreature: ["ArrowHitCreature1.ogg", "ArrowHitCreature2.ogg"],
    hitObject: ["ArrowHitObject1.ogg", "ArrowHitObject2.ogg"],
    miss: ["ArrowMiss1.ogg", "ArrowMiss2.ogg", "ArrowMiss3.ogg"]
  }
};
