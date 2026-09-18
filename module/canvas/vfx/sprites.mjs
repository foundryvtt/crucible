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
 * For example, `VFX_TEXTURES.frost.spray` contains `["#crucible.vfx.frost/SprayShardA", ...]`.
 *
 * Categories correspond to the particle type prefixes in the atlas frame names:
 * Air, Aura, Disc, Falling, Ground, Impact, Orb, Projectile, Root, Spray, Streak.
 * - Projectile: side-view directional sprites for x/y travel (e.g., arrow shafts).
 * - Falling: sprites drawn as power arriving from overhead (e.g., hail, debris, lightning strikes).
 * - Orb: small round motes with no inherent direction.
 * - Root: ground-laid directional sprites that grow outward from an origin (e.g., roots, fissures).
 * - Streak: mid-air directional sprites that trail behind a moving front (e.g., beam particles).
 *
 * A trailing letter marks interchangeable variants (`SprayShardA`), each filed as its own path.
 * A trailing number marks the ordered frames of a flipbook (`ProjectileBolt1`), filed once under its unnumbered name.
 * @type {Record<string, Record<string, string[]>>}
 */
export const VFX_TEXTURES = {};

/* -------------------------------------------- */

/**
 * Ordered frame textures of each flipbook sequence declared by a VFX atlas, keyed by scene texture key.
 * For example, `VFX_FLIPBOOKS["crucible.vfx.storm/ProjectileBolt"]` contains its four frames in play order.
 * @type {Record<string, PIXI.Texture[]>}
 */
export const VFX_FLIPBOOKS = {};

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

  // Clear the registries from a prior scene
  for ( const key of Object.keys(VFX_TEXTURES) ) delete VFX_TEXTURES[key];
  for ( const key of Object.keys(VFX_FLIPBOOKS) ) delete VFX_FLIPBOOKS[key];

  // Unpack each atlas
  for ( const atlas of VFX_ATLASES ) {
    const path = `${VFX_ATLAS_PATH}/${atlas}`;
    const mainSheet = foundry.canvas.getTexture(path);
    if ( !mainSheet ) continue;
    for ( const sheet of [mainSheet, ...(mainSheet.linkedSheets || [])] ) {

      // Flipbook sequences are filed once under their unnumbered name rather than frame by frame
      const flipbookFrames = new Set();
      for ( const [name, frames] of Object.entries(sheet.animations ?? {}) ) {
        VFX_FLIPBOOKS[`crucible.vfx.${name}`] = frames;
        for ( const frame of frames ) flipbookFrames.add(frame);
        _fileTexturePath(name);
      }

      // Register every frame as a scene texture for # prefix resolution
      for ( const [frameName, texture] of Object.entries(sheet.textures) ) {
        canvas.sceneTextures[`crucible.vfx.${frameName}`] = texture;
        if ( !flipbookFrames.has(texture) ) _fileTexturePath(frameName);
      }
    }
  }
}

/* -------------------------------------------- */

/**
 * File the scene texture path of an atlas name into {@link VFX_TEXTURES} by its rune and category.
 * @param {string} name   An atlas frame or flipbook name, e.g. "frost/ImpactBlast".
 */
function _fileTexturePath(name) {
  const slashIndex = name.indexOf("/");
  if ( slashIndex === -1 ) return;
  const rune = name.slice(0, slashIndex).toLowerCase();
  const category = _parseCategory(name.slice(slashIndex + 1));
  if ( !category ) return;
  ((VFX_TEXTURES[rune] ??= {})[category] ??= []).push(`#crucible.vfx.${name}`);
}

/* -------------------------------------------- */

/**
 * Parse the particle category from a frame name suffix like "SprayShardA" -> "spray".
 * @param {string} suffix   The portion of the frame name after the rune prefix and slash.
 * @returns {string|null}   Lowercase category key, or null if no known category prefix matches.
 */
function _parseCategory(suffix) {
  for ( const prefix of _parseCategory.CATEGORIES ) {
    if ( suffix.startsWith(prefix) ) return prefix.toLowerCase();
  }
  return null;
}
_parseCategory.CATEGORIES = ["Air", "Aura", "Disc", "Falling", "Ground", "Impact", "Orb", "Projectile", "Root",
  "Spray", "Streak"];

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
 * Get the ordered frame textures of a flipbook from its #-prefixed scene texture path.
 * @param {string} path             A scene texture reference like "#crucible.vfx.storm/ProjectileBolt"
 * @returns {PIXI.Texture[]|null}   The flipbook frames, or null if the path does not name a flipbook.
 */
export function getVFXFlipbook(path) {
  if ( path?.[0] !== "#" ) return null;
  return VFX_FLIPBOOKS[path.slice(1)] ?? null;
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
