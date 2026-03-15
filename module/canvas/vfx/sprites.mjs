/**
 * Choose a random sprite to use from a provided list of options.
 * Prefix the returned path with a specific path prefix
 * @param {string} domain     The outer domain in VFX_SPRITES
 * @param {string} key        The inner key that provides a list of sprite textures
 * @returns {string}
 */
export function getRandomSprite(domain, key) {
  const d = VFX_SPRITES[domain];
  const list = d[key];
  const src = list[Math.floor(Math.random() * list.length)];
  return `${d.prefix}/${src}`;
}

/* -------------------------------------------- */

/**
 * A library of available VFX sounds to be used in animation.
 * TODO separate files now for testing, but will be replaced by a single spritesheet with inner atlas
 * @type {Record<string, Record<string, string[]|string>>}
 */
export const VFX_SPRITES = {
  impacts: {
    prefix: "systems/crucible/assets/sprites/impacts",
    blood: ["BloodSplatter1.webp", "BloodSplatter2.webp", "BloodSplatter3.webp", "BloodSplatter4.webp"]
  },
  projectiles: {
    prefix: "systems/crucible/assets/sprites/projectiles",
    arrow: ["ArrowStandard1.webp"]
  }
};
