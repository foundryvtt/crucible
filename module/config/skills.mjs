
/**
 * The thematic categories of skills. Each skill belongs to one of these categories.
 * @type {Record<string, {label: string, hint: string, defaultIcon: string, color: Color}>}
 */
export const CATEGORIES = {
  "exp": {
    label: "SKILL.CATEGORY.EXPLORATION.label",
    hint: "SKILL.CATEGORY.EXPLORATION.hint",
    defaultIcon: "icons/skills/no-exp.jpg",
    color: Color.from("#81cc44")
  },
  "kno": {
    label: "SKILL.CATEGORY.KNOWLEDGE.label",
    hint: "SKILL.CATEGORY.KNOWLEDGE.hint",
    defaultIcon: "icons/skills/no-kno.jpg",
    color: Color.from("#6c6cff")
  },
  "soc": {
    label: "SKILL.CATEGORY.SOCIAL.label",
    hint: "SKILL.CATEGORY.SOCIAL.hint",
    defaultIcon: "icons/skills/no-soc.jpg",
    color: Color.from("#ab3fe8")
  }
};

/**
 * @typedef CrucibleSkillConfig
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {[string, string]} abilities
 */

/**
 * The skills configured for the system.
 * @type {Record<string, CrucibleSkillConfig>}
 */
export const SKILLS = Object.freeze({

  // Exploration Skills
  athletics: {
    id: "athletics",
    label: "SKILL.LABELS.athletics",
    icon: "systems/crucible/icons/skills/athletics.jpg",
    category: "exp",
    abilities: ["strength", "dexterity"]
  },
  awareness: {
    id: "awareness",
    label: "SKILL.LABELS.awareness",
    icon: "systems/crucible/icons/skills/awareness.jpg",
    category: "exp",
    abilities: ["intellect", "wisdom"]
  },
  stealth: {
    id: "stealth",
    label: "SKILL.LABELS.stealth",
    icon: "systems/crucible/icons/skills/stealth.jpg",
    category: "exp",
    abilities: ["dexterity", "intellect"]
  },
  wilderness: {
    id: "wilderness",
    label: "SKILL.LABELS.wilderness",
    icon: "systems/crucible/icons/skills/wilderness.jpg",
    category: "exp",
    abilities: ["toughness", "wisdom"]
  },

  // Knowledge Skills
  arcana: {
    id: "arcana",
    label: "SKILL.LABELS.arcana",
    icon: "systems/crucible/icons/skills/arcana.jpg",
    category: "kno",
    abilities: ["presence", "intellect"]
  },
  medicine: {
    id: "medicine",
    label: "SKILL.LABELS.medicine",
    icon: "systems/crucible/icons/skills/medicine.jpg",
    category: "kno",
    abilities: ["wisdom", "toughness"]
  },
  science: {
    id: "science",
    label: "SKILL.LABELS.science",
    icon: "systems/crucible/icons/skills/science.jpg",
    category: "kno",
    abilities: ["intellect", "wisdom"]
  },
  society: {
    id: "society",
    label: "SKILL.LABELS.society",
    icon: "systems/crucible/icons/skills/society.jpg",
    category: "kno",
    abilities: ["wisdom", "presence"]
  },

  // Social Skills
  deception: {
    id: "deception",
    label: "SKILL.LABELS.deception",
    icon: "systems/crucible/icons/skills/deception.jpg",
    category: "soc",
    abilities: ["intellect", "presence"]
  },
  diplomacy: {
    id: "diplomacy",
    label: "SKILL.LABELS.diplomacy",
    icon: "systems/crucible/icons/skills/diplomacy.jpg",
    category: "soc",
    abilities: ["wisdom", "presence"]
  },
  intimidation: {
    id: "intimidation",
    label: "SKILL.LABELS.intimidation",
    icon: "systems/crucible/icons/skills/intimidation.jpg",
    category: "soc",
    abilities: ["presence", "toughness"]
  },
  performance: {
    id: "performance",
    label: "SKILL.LABELS.performance",
    icon: "systems/crucible/icons/skills/performance.jpg",
    category: "soc",
    abilities: ["presence", "dexterity"]
  }
});

/**
 * The UUID of the journal entry which provides skill definitions to the system.
 * @type {string}
 */
export let JOURNAL_ID = "Compendium.crucible.rules.JournalEntry.CrucibleSkills00";
