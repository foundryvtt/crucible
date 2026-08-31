import {defineEnum} from "./enum.mjs";

/**
 * Training categories which apply to tradecraft.
 * Icons are inherited from the talent which grants each training.
 * @type {Readonly<Record<string, {id: string, label: string, icon: string, abilities: string[]}>>}
 **/
export const TRAINING = defineEnum({
  alchemy: {label: "SKILL.LABELS.alchemy", icon: "icons/consumables/potions/flask-corked-blue-glow.webp",
    abilities: ["intellect", "toughness"]},
  cooking: {label: "SKILL.LABELS.cooking", icon: "icons/tools/cooking/pot-camping-iron-black.webp",
    abilities: ["wisdom", "toughness"]},
  enchanting: {label: "SKILL.LABELS.enchanting", icon: "icons/magic/symbols/runes-triangle-blue.webp",
    abilities: ["intellect", "presence"]},
  fletching: {label: "SKILL.LABELS.fletching", icon: "icons/weapons/ammunition/arrows-fletching.webp",
    abilities: ["strength", "wisdom"]},
  jewelcraft: {label: "SKILL.LABELS.jewelcraft", icon: "icons/commodities/gems/gem-faceted-teardrop-blue.webp",
    abilities: ["wisdom", "strength"]},
  glyphweaving: {label: "SKILL.LABELS.glyphweaving", icon: "icons/magic/symbols/rune-sigil-black-pink.webp",
    abilities: ["presence", "dexterity"]},
  smithing: {label: "SKILL.LABELS.smithing", icon: "icons/skills/trades/smithing-anvil-silver-red.webp",
    abilities: ["strength", "intellect"]},
  tailoring: {label: "SKILL.LABELS.tailoring", icon: "icons/commodities/cloth/thread-spindle-white.webp",
    abilities: ["dexterity", "presence"]}
});

