import {defineEnum} from "./enum.mjs";

/**
 * The thematic categories of skills. Each skill belongs to one of these categories.
 * @type {Readonly<Record<string, {id: string, label: string, hint: string, defaultIcon: string, color: Color}>>}
 */
export const CATEGORIES = defineEnum({
  exp: {
    label: "SKILL.CATEGORY.EXPLORATION.label",
    hint: "SKILL.CATEGORY.EXPLORATION.hint",
    defaultIcon: "icons/skills/no-exp.jpg",
    color: Color.from("#81cc44")
  },
  kno: {
    label: "SKILL.CATEGORY.KNOWLEDGE.label",
    hint: "SKILL.CATEGORY.KNOWLEDGE.hint",
    defaultIcon: "icons/skills/no-kno.jpg",
    color: Color.from("#6c6cff")
  },
  soc: {
    label: "SKILL.CATEGORY.SOCIAL.label",
    hint: "SKILL.CATEGORY.SOCIAL.hint",
    defaultIcon: "icons/skills/no-soc.jpg",
    color: Color.from("#ab3fe8")
  }
});

/**
 * @typedef CrucibleSkillConfig
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {[string, string]} abilities
 */

/**
 * The skills configured for the system.
 * @type {Readonly<Record<string, CrucibleSkillConfig>>}
 */
export const SKILLS = defineEnum({

  // Exploration Skills
  athletics: {
    label: "TRAINING.LABELS.athletics",
    icon: "systems/crucible/icons/skills/athletics.jpg",
    category: "exp",
    abilities: ["strength", "dexterity"]
  },
  awareness: {
    label: "TRAINING.LABELS.awareness",
    icon: "systems/crucible/icons/skills/awareness.jpg",
    category: "exp",
    abilities: ["intellect", "wisdom"]
  },
  stealth: {
    label: "TRAINING.LABELS.stealth",
    icon: "systems/crucible/icons/skills/stealth.jpg",
    category: "exp",
    abilities: ["dexterity", "intellect"]
  },
  wilderness: {
    label: "TRAINING.LABELS.wilderness",
    icon: "systems/crucible/icons/skills/wilderness.jpg",
    category: "exp",
    abilities: ["toughness", "wisdom"]
  },

  // Knowledge Skills
  arcana: {
    label: "TRAINING.LABELS.arcana",
    icon: "systems/crucible/icons/skills/arcana.jpg",
    category: "kno",
    abilities: ["presence", "intellect"]
  },
  medicine: {
    label: "TRAINING.LABELS.medicine",
    icon: "systems/crucible/icons/skills/medicine.jpg",
    category: "kno",
    abilities: ["wisdom", "intellect"]
  },
  science: {
    label: "TRAINING.LABELS.science",
    icon: "systems/crucible/icons/skills/science.jpg",
    category: "kno",
    abilities: ["intellect", "wisdom"]
  },
  society: {
    label: "TRAINING.LABELS.society",
    icon: "systems/crucible/icons/skills/society.jpg",
    category: "kno",
    abilities: ["wisdom", "presence"]
  },

  // Social Skills
  deception: {
    label: "TRAINING.LABELS.deception",
    icon: "systems/crucible/icons/skills/deception.jpg",
    category: "soc",
    abilities: ["intellect", "presence"]
  },
  diplomacy: {
    label: "TRAINING.LABELS.diplomacy",
    icon: "systems/crucible/icons/skills/diplomacy.jpg",
    category: "soc",
    abilities: ["wisdom", "presence"]
  },
  intimidation: {
    label: "TRAINING.LABELS.intimidation",
    icon: "systems/crucible/icons/skills/intimidation.jpg",
    category: "soc",
    abilities: ["presence", "toughness"]
  },
  performance: {
    label: "TRAINING.LABELS.performance",
    icon: "systems/crucible/icons/skills/performance.jpg",
    category: "soc",
    abilities: ["presence", "dexterity"]
  }
});

/**
 * The UUID of the journal entry which provides skill definitions to the system.
 * @type {string}
 */
export const JOURNAL_ID = "Compendium.crucible.rules.JournalEntry.CrucibleSkills00";

/**
 * @typedef CrucibleKnowledgeConfig
 * @property {string} id
 * @property {string} label
 * @property {string} skill
 */

/**
 * The knowledge topics configured for the system.
 * @type {Record<string, CrucibleKnowledgeConfig>}
 */
export const DEFAULT_KNOWLEDGE = Object.freeze({
  alchemy: {label: "KNOWLEDGE.Alchemy", skill: "arcana"},
  ancients: {label: "KNOWLEDGE.Ancients", skill: "society"},
  artifacts: {label: "KNOWLEDGE.Artifacts", skill: "society"},
  arts: {label: "KNOWLEDGE.Arts", skill: "performance"},
  beasts: {label: "KNOWLEDGE.Beasts", skill: "wilderness"},
  celestials: {label: "KNOWLEDGE.Celestials", skill: "arcana"},
  cosmology: {label: "KNOWLEDGE.Cosmology", skill: "science"},
  crafts: {label: "KNOWLEDGE.Crafts", skill: "society"},
  crime: {label: "KNOWLEDGE.Crime", skill: "society"},
  dragons: {label: "KNOWLEDGE.Dragons", skill: "medicine"},
  elementals: {label: "KNOWLEDGE.Elementals", skill: "arcana"},
  fey: {label: "KNOWLEDGE.Fey", skill: "arcana"},
  fiends: {label: "KNOWLEDGE.Fiends", skill: "arcana"},
  forensics: {label: "KNOWLEDGE.Forensics", skill: "awareness"},
  gods: {label: "KNOWLEDGE.Gods", skill: "arcana"},
  intrigue: {label: "KNOWLEDGE.Intrigue", skill: "deception"},
  legends: {label: "KNOWLEDGE.Legends", skill: "society"},
  machines: {label: "KNOWLEDGE.Machines", skill: "science"},
  monsters: {label: "KNOWLEDGE.Monsters", skill: "medicine"},
  outsiders: {label: "KNOWLEDGE.Outsiders", skill: "arcana"},
  plants: {label: "KNOWLEDGE.Plants", skill: "wilderness"},
  politics: {label: "KNOWLEDGE.Politics", skill: "diplomacy"},
  rituals: {label: "KNOWLEDGE.Rituals", skill: "arcana"},
  seafaring: {label: "KNOWLEDGE.Seafaring", skill: "wilderness"},
  souls: {label: "KNOWLEDGE.Souls", skill: "arcana"},
  subterranea: {label: "KNOWLEDGE.Subterranea", skill: "wilderness"},
  tracking: {label: "KNOWLEDGE.Tracking", skill: "awareness"},
  trade: {label: "KNOWLEDGE.Trade", skill: "society"},
  undeath: {label: "KNOWLEDGE.Undeath", skill: "medicine"},
  warfare: {label: "KNOWLEDGE.Warfare", skill: "intimidation"},
  weather: {label: "KNOWLEDGE.Weather", skill: "science"}
});
