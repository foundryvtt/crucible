import {defineEnum} from "./enum.mjs";

/**
 * Training categories which apply to tradecraft.
 * Icons are inherited from the talent which grants each training.
 * @type {Readonly<Record<string, {id: string, label: string, icon: string, abilities: string[]}>>}
 **/
export const TRAINING = defineEnum({
  alchemy: {label: "TRAINING.LABELS.alchemy", icon: "icons/consumables/potions/flask-corked-blue-glow.webp",
    abilities: ["intellect", "toughness"]},
  cooking: {label: "TRAINING.LABELS.cooking", icon: "icons/tools/cooking/pot-camping-iron-black.webp",
    abilities: ["wisdom", "toughness"]},
  enchanting: {label: "TRAINING.LABELS.enchanting", icon: "icons/magic/symbols/runes-triangle-blue.webp",
    abilities: ["intellect", "presence"]},
  fletching: {label: "TRAINING.LABELS.fletching", icon: "icons/weapons/ammunition/arrows-fletching.webp",
    abilities: ["strength", "wisdom"]},
  jewelcraft: {label: "TRAINING.LABELS.jewelcraft", icon: "icons/commodities/gems/gem-faceted-teardrop-blue.webp",
    abilities: ["wisdom", "strength"]},
  glyphweaving: {label: "TRAINING.LABELS.glyphweaving", icon: "icons/magic/symbols/rune-sigil-black-pink.webp",
    abilities: ["presence", "dexterity"]},
  smithing: {label: "TRAINING.LABELS.smithing", icon: "icons/skills/trades/smithing-anvil-silver-red.webp",
    abilities: ["strength", "intellect"]},
  tailoring: {label: "TRAINING.LABELS.tailoring", icon: "icons/commodities/cloth/thread-spindle-white.webp",
    abilities: ["dexterity", "presence"]}
});

