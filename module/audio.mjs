/**
 * The set of sound files used for UI clicks.
 * @type {string[]}
 */
export const CLICK_SOUNDS = [
  "systems/crucible/audio/click1.wav",
  "systems/crucible/audio/click2.wav",
  "systems/crucible/audio/click3.wav",
  "systems/crucible/audio/click4.wav",
  "systems/crucible/audio/click5.wav"
];

/**
 * Play a random UI click sound at the specified volume.
 * @param {number} volume
 */
export async function playClick(volume=0.5) {
  const src = CLICK_SOUNDS[Math.floor(Math.random() * CLICK_SOUNDS.length)];
  await game.audio.play(src, {volume, loop: false, context: game.audio.interface});
}
