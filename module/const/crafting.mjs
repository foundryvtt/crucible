import {defineEnum} from "./enum.mjs";

/**
 * Training categories which apply to tradecraft.
 * Icons are inherited from the talent which grants each training.
 * @type {Readonly<Record<string, {id: string, label: string, icon: string}>>}
 **/
export const TRAINING = defineEnum({
  alchemy: {label: "SKILL.LABELS.alchemy", icon: "icons/consumables/potions/flask-corked-blue-glow.webp"},
  cooking: {label: "SKILL.LABELS.cooking", icon: "icons/tools/cooking/pot-camping-iron-black.webp"},
  enchanting: {label: "SKILL.LABELS.enchanting", icon: "icons/magic/symbols/runes-triangle-blue.webp"},
  fletching: {label: "SKILL.LABELS.fletching", icon: "icons/weapons/ammunition/arrows-fletching.webp"},
  jewelcraft: {label: "SKILL.LABELS.jewelcraft", icon: "icons/commodities/gems/gem-faceted-teardrop-blue.webp"},
  glyphweaving: {label: "SKILL.LABELS.glyphweaving", icon: "icons/magic/symbols/rune-sigil-black-pink.webp"},
  smithing: {label: "SKILL.LABELS.smithing", icon: "icons/skills/trades/smithing-anvil-silver-red.webp"},
  tailoring: {label: "SKILL.LABELS.tailoring", icon: "icons/commodities/cloth/thread-spindle-white.webp"}
});

