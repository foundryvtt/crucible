/**
 * @typedef CrucibleFootfallSound
 * @property {string|null} material            The material this sound plays on, or null for any material
 * @property {string} mover                     The kind of mover which makes this sound, such as "footsteps"
 * @property {"footfalls"|"loop"} playback      Play a random clip per footfall, or a continuous loop (unsupported)
 * @property {string[]} src                     The audio files to choose from
 */

/**
 * The materials which a surface can be made of.
 * @type {Record<string, {label: string}>}
 */
export const MATERIALS = Object.freeze({
  grass: {label: "FOOTFALLS.MATERIALS.Grass"},
  metal: {label: "FOOTFALLS.MATERIALS.Metal"},
  stone: {label: "FOOTFALLS.MATERIALS.Stone"},
  water: {label: "FOOTFALLS.MATERIALS.Water"},
  wood: {label: "FOOTFALLS.MATERIALS.Wood"}
});

/**
 * Get the audio files for one footstep sound.
 * @param {string} folder   The folder within the system's movement audio
 * @param {string} name     The file name before its number
 * @returns {string[]}
 */
function footstepFiles(folder, name) {
  return Array.fromRange(6, 1).map(i => `systems/crucible/assets/sfx/movement/${folder}/${name}-${i}.ogg`);
}

/**
 * The sounds which movers make on materials, keyed by sound id.
 * @type {Record<string, CrucibleFootfallSound>}
 */
export const SOUNDS = Object.freeze({
  grassFootsteps: {material: "grass", mover: "footsteps", playback: "footfalls",
    src: footstepFiles("grass", "footstep-grass")},
  metalFootsteps: {material: "metal", mover: "footsteps", playback: "footfalls",
    src: footstepFiles("metal", "footstep-metal")},
  stoneFootsteps: {material: "stone", mover: "footsteps", playback: "footfalls",
    src: footstepFiles("stone", "footstep-stone")},
  waterFootsteps: {material: "water", mover: "footsteps", playback: "footfalls",
    src: footstepFiles("water", "footstep-mud-water")},
  woodFootsteps: {material: "wood", mover: "footsteps", playback: "footfalls",
    src: footstepFiles("wood", "footstep-wood")}
});

/**
 * The movement actions which produce footfalls.
 * @type {Set<string>}
 */
export const MOVEMENT_ACTIONS = new Set(["walk", "step"]);

/**
 * How far away footfalls are heard: the radius in feet for a mover of the reference size in feet.
 * Larger movers are heard farther away, scaled by the square root of their size.
 * @type {{radius: number, size: number}}
 */
export const HEARING = Object.freeze({radius: 40, size: 4});
