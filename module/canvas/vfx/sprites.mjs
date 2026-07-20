/**
 * The base path for VFX spritesheet atlas JSON files.
 * @type {string}
 */
const VFX_ATLAS_PATH = "systems/crucible/assets/vfx";

/**
 * An array of spritesheet atlas JSON filenames to load.
 * Each entry is loaded as a PIXI.Spritesheet during the canvas texture load phase.
 * @type {string[]}
 */
const VFX_ATLASES = [
  "CrucibleVFX0.json"
];

/* -------------------------------------------- */

/**
 * A registry of #-prefixed scene texture path strings from loaded VFX spritesheets, organized by
 * rune and particle category. Populated at canvasReady by {@link registerVFXSprites}.
 *
 * Structure: `VFX_TEXTURES[rune][category]` yields an array of path strings.
 * For example, `VFX_TEXTURES.frost.spray` contains `["#crucible.vfx.frost/SprayShard1", ...]`.
 *
 * Categories correspond to the particle type prefixes in the atlas frame names:
 * Air, Aura, Disc, Falling, Ground, Impact, Projectile, Root, Spray, Streak.
 * - Projectile: side-view directional sprites for x/y travel (e.g., arrow shafts).
 * - Falling: top-down descending sprites for elevation drops (e.g., hail, debris from above).
 * - Root: ground-laid directional sprites that grow outward from an origin (e.g., roots, fissures).
 * - Streak: mid-air directional sprites that trail behind a moving front (e.g., beam particles).
 * @type {Record<string, Record<string, string[]>>}
 */
export const VFX_TEXTURES = {};

/* -------------------------------------------- */

/**
 * Register VFX spritesheet atlas JSON paths into canvas.sceneTextures so they are loaded as part
 * of the centralized scene texture load. Call this during the canvasInit hook.
 */
export function loadVFXSpritesheets() {
  for ( const atlas of VFX_ATLASES ) {
    const path = `${VFX_ATLAS_PATH}/${atlas}`;
    canvas.sceneTextures[path] = path;
  }
}

/* -------------------------------------------- */

/**
 * Unpack loaded VFX spritesheets into the {@link VFX_TEXTURES} registry and register individual
 * frame textures as canvas scene textures for use by VFXEffect components via the # prefix.
 * Call this during the canvasReady hook, after textures have been loaded.
 */
export function registerVFXSprites() {

  // Clear the registry from a prior scene
  for ( const key of Object.keys(VFX_TEXTURES) ) delete VFX_TEXTURES[key];

  // Unpack each atlas
  for ( const atlas of VFX_ATLASES ) {
    const path = `${VFX_ATLAS_PATH}/${atlas}`;
    const mainSheet = foundry.canvas.getTexture(path);
    if ( !mainSheet ) continue;
    for ( const sheet of [mainSheet, ...(mainSheet.linkedSheets || [])] ) {
      for ( const [frameName, texture] of Object.entries(sheet.textures) ) {

        // Register as a scene texture for # prefix resolution
        const sceneTextureKey = `crucible.vfx.${frameName}`;
        canvas.sceneTextures[sceneTextureKey] = texture;
        const texturePath = `#${sceneTextureKey}`;

        // Organize into VFX_TEXTURES by rune and category
        const slashIndex = frameName.indexOf("/");
        if ( slashIndex === -1 ) continue;
        const rune = frameName.slice(0, slashIndex).toLowerCase();
        const suffix = frameName.slice(slashIndex + 1);
        const category = _parseCategory(suffix);
        if ( !category ) continue;
        (VFX_TEXTURES[rune] ??= {})[category] ??= [];
        VFX_TEXTURES[rune][category].push(texturePath);
      }
    }
  }
}

/* -------------------------------------------- */

/**
 * Parse the particle category from a frame name suffix like "SprayShard1" -> "spray".
 * @param {string} suffix   The portion of the frame name after the rune prefix and slash.
 * @returns {string|null}   Lowercase category key, or null if no known category prefix matches.
 */
function _parseCategory(suffix) {
  for ( const prefix of _parseCategory.CATEGORIES ) {
    if ( suffix.startsWith(prefix) ) return prefix.toLowerCase();
  }
  return null;
}
_parseCategory.CATEGORIES = ["Air", "Aura", "Disc", "Falling", "Ground", "Impact", "Projectile", "Root", "Spray",
  "Streak"];

/* -------------------------------------------- */

/**
 * Get the #-prefixed scene texture path for a specific spritesheet frame.
 * @param {string} frameName   The frame name as it appears in the atlas, e.g. "frost/ImpactBlast"
 * @returns {string}           A scene texture reference like "#crucible.vfx.frost/ImpactBlast"
 */
export function getVFXTexturePath(frameName) {
  return `#crucible.vfx.${frameName}`;
}

/* -------------------------------------------- */

/**
 * Get an array of #-prefixed scene texture paths for all textures in a given rune and category.
 * @param {string} rune       The rune identifier, e.g. "frost"
 * @param {string} category   The particle category, e.g. "spray", "impact", "streak"
 * @returns {string[]}        An array of scene texture reference strings, or an empty array if
 *                             no textures are registered for this rune/category combination.
 */
export function getVFXTexturePaths(rune, category) {
  return VFX_TEXTURES[rune]?.[category] ?? [];
}

/* -------------------------------------------- */

/**
 * Get the rune's texture paths whose frame name begins with any of the given prefixes, for selecting a
 * specific sub-set of a category (e.g. "SprayLeaf"/"SprayBubble" without "SprayWispy").
 * @param {string} rune        The rune identifier, e.g. "life"
 * @param {...string} prefixes Frame-name prefixes (the part after "rune/"), e.g. "SprayLeaf"
 * @returns {string[]}
 */
export function getVFXFrames(rune, ...prefixes) {
  const byCategory = VFX_TEXTURES[rune];
  if ( !byCategory ) return [];
  return Object.values(byCategory).flat().filter(path => {
    const frame = path.split("/").pop();
    return prefixes.some(p => frame.startsWith(p));
  });
}

/* -------------------------------------------- */

/**
 * Choose a random sprite to use from a provided list of options.
 * Prefix the returned path with a specific path prefix.
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
 * A library of individual (non-atlas) VFX sprite assets used for strike and projectile effects.
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
