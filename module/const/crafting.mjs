import {defineEnum} from "./enum.mjs";

/**
 * Training categories which apply to tradecraft.
 * @type {Readonly<Record<string, {id: string, label: string}>>}
 **/
export const TRAINING = defineEnum({
  alchemy: {
    label: "SKILL.LABELS.alchemy",
    tooltip: "SKILL.TOOLTIPS.alchemy"
  },
  cooking: {
    label: "SKILL.LABELS.cooking",
    tooltip: "SKILL.TOOLTIPS.cooking"
  },
  enchanting: {
    label: "SKILL.LABELS.enchanting",
    tooltip: "SKILL.TOOLTIPS.enchanting"
  },
  fletching: {
    label: "SKILL.LABELS.fletching",
    tooltip: "SKILL.TOOLTIPS.fletching"
  },
  jewelcraft: {
    label: "SKILL.LABELS.jewelcraft",
    tooltip: "SKILL.TOOLTIPS.jewelcraft"
  },
  glyphweaving: {
    label: "SKILL.LABELS.glyphweaving",
    tooltip: "SKILL.TOOLTIPS.glyphweaving"
  },
  smithing: {
    label: "SKILL.LABELS.smithing",
    tooltip: "SKILL.TOOLTIPS.smithing"
  },
  tailoring: {
    label: "SKILL.LABELS.tailoring",
    tooltip: "SKILL.TOOLTIPS.tailoring"
  }
});

