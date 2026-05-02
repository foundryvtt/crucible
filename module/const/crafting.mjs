import {defineEnum} from "./enum.mjs";

/**
 * Training categories which apply to tradecraft.
 * @type {Readonly<Record<string, {id: string, label: string}>>}
 **/
export const TRAINING = defineEnum({
  alchemy: {label: "SKILL.LABELS.alchemy"},
  cooking: {label: "SKILL.LABELS.cooking"},
  enchanting: {label: "SKILL.LABELS.enchanting"},
  fletching: {label: "SKILL.LABELS.fletching"},
  jewelcraft: {label: "SKILL.LABELS.jewelcraft"},
  glyphweaving: {label: "SKILL.LABELS.glyphweaving"},
  smithing: {label: "SKILL.LABELS.smithing"},
  tailoring: {label: "SKILL.LABELS.tailoring"}
});

