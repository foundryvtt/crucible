
/**
 * The thematic categories of skills. Each skill belongs to one of these categories.
 * @type {Record<string, {label: string, hint: string, defaultIcon: string, color: Color}>}
 */
export const CATEGORIES = {
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
};

/**
 * @typedef CrucibleSkillConfig
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {[string, string]} abilities
 * @property {Record<1|2|3|4, string>} talents
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
    abilities: ["strength", "dexterity"],
    talents: {
      1: "Compendium.crucible.talent.Item.athleticsNovice0",
      2: "Compendium.crucible.talent.Item.athleticsJourney",
      3: "Compendium.crucible.talent.Item.athleticsAdept00",
      4: "Compendium.crucible.talent.Item.athleticsMaster0"
    }
  },
  awareness: {
    id: "awareness",
    label: "SKILL.LABELS.awareness",
    icon: "systems/crucible/icons/skills/awareness.jpg",
    category: "exp",
    abilities: ["intellect", "wisdom"],
    talents: {
      1: "Compendium.crucible.talent.Item.awarenessNovice0",
      2: "Compendium.crucible.talent.Item.athleticsJourney",
      3: "Compendium.crucible.talent.Item.athleticsAdept00",
      4: "Compendium.crucible.talent.Item.athleticsAdept00"
    }
  },
  stealth: {
    id: "stealth",
    label: "SKILL.LABELS.stealth",
    icon: "systems/crucible/icons/skills/stealth.jpg",
    category: "exp",
    abilities: ["dexterity", "intellect"],
    talents: {
      1: "Compendium.crucible.talent.Item.stealthNovice000",
      2: "Compendium.crucible.talent.Item.stealthJourneyma",
      3: "Compendium.crucible.talent.Item.stealthAdept0000",
      4: "Compendium.crucible.talent.Item.stealthMaster000"
    }
  },
  wilderness: {
    id: "wilderness",
    label: "SKILL.LABELS.wilderness",
    icon: "systems/crucible/icons/skills/wilderness.jpg",
    category: "exp",
    abilities: ["toughness", "wisdom"],
    talents: {
      1: "Compendium.crucible.talent.Item.wildernessNovice",
      2: "Compendium.crucible.talent.Item.wildernessJourne",
      3: "Compendium.crucible.talent.Item.wildernessAdept0",
      4: "Compendium.crucible.talent.Item.wildernessMaster"
    }
  },

  // Knowledge Skills
  arcana: {
    id: "arcana",
    label: "SKILL.LABELS.arcana",
    icon: "systems/crucible/icons/skills/arcana.jpg",
    category: "kno",
    abilities: ["presence", "intellect"],
    talents: {
      1: "Compendium.crucible.talent.Item.arcanaNovice0000",
      2: "Compendium.crucible.talent.Item.arcanaJourneyman",
      3: "Compendium.crucible.talent.Item.arcanaAdept00000",
      4: "Compendium.crucible.talent.Item.arcanaMaster0000"
    }
  },
  medicine: {
    id: "medicine",
    label: "SKILL.LABELS.medicine",
    icon: "systems/crucible/icons/skills/medicine.jpg",
    category: "kno",
    abilities: ["wisdom", "intellect"],
    talents: {
      1: "Compendium.crucible.talent.Item.medicineNovice00",
      2: "Compendium.crucible.talent.Item.medicineJourneym",
      3: "Compendium.crucible.talent.Item.medicineAdept000",
      4: "Compendium.crucible.talent.Item.medicineMaster00"
    }
  },
  science: {
    id: "science",
    label: "SKILL.LABELS.science",
    icon: "systems/crucible/icons/skills/science.jpg",
    category: "kno",
    abilities: ["intellect", "wisdom"],
    talents: {
      1: "Compendium.crucible.talent.Item.scienceNovice000",
      2: "Compendium.crucible.talent.Item.scienceJourneyma",
      3: "Compendium.crucible.talent.Item.scienceAdept0000",
      4: "Compendium.crucible.talent.Item.scienceMaster000"
    }
  },
  society: {
    id: "society",
    label: "SKILL.LABELS.society",
    icon: "systems/crucible/icons/skills/society.jpg",
    category: "kno",
    abilities: ["wisdom", "presence"],
    talents: {
      1: "Compendium.crucible.talent.Item.societyNovice000",
      2: "Compendium.crucible.talent.Item.societyJourneyma",
      3: "Compendium.crucible.talent.Item.societyAdept0000",
      4: "Compendium.crucible.talent.Item.societyMaster000"
    }
  },

  // Social Skills
  deception: {
    id: "deception",
    label: "SKILL.LABELS.deception",
    icon: "systems/crucible/icons/skills/deception.jpg",
    category: "soc",
    abilities: ["intellect", "presence"],
    talents: {
      1: "Compendium.crucible.talent.Item.deceptionNovice0",
      2: "Compendium.crucible.talent.Item.deceptionJourney",
      3: "Compendium.crucible.talent.Item.deceptionAdept00",
      4: "Compendium.crucible.talent.Item.deceptionMaster0"
    }
  },
  diplomacy: {
    id: "diplomacy",
    label: "SKILL.LABELS.diplomacy",
    icon: "systems/crucible/icons/skills/diplomacy.jpg",
    category: "soc",
    abilities: ["wisdom", "presence"],
    talents: {
      1: "Compendium.crucible.talent.Item.diplomacyNovice0",
      2: "Compendium.crucible.talent.Item.diplomacyJourney",
      3: "Compendium.crucible.talent.Item.diplomacyAdept00",
      4: "Compendium.crucible.talent.Item.diplomacyMaster0"
    }
  },
  intimidation: {
    id: "intimidation",
    label: "SKILL.LABELS.intimidation",
    icon: "systems/crucible/icons/skills/intimidation.jpg",
    category: "soc",
    abilities: ["presence", "toughness"],
    talents: {
      1: "Compendium.crucible.talent.Item.intimidationNovi",
      2: "Compendium.crucible.talent.Item.intimidationJour",
      3: "Compendium.crucible.talent.Item.intimidationAdep",
      4: "Compendium.crucible.talent.Item.intimidationMast"
    }
  },
  performance: {
    id: "performance",
    label: "SKILL.LABELS.performance",
    icon: "systems/crucible/icons/skills/performance.jpg",
    category: "soc",
    abilities: ["presence", "dexterity"],
    talents: {
      1: "Compendium.crucible.talent.Item.performanceNovic",
      2: "Compendium.crucible.talent.Item.performanceJourn",
      3: "Compendium.crucible.talent.Item.performanceAdept",
      4: "Compendium.crucible.talent.Item.performanceMaste"
    }
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
