import {defineEnum} from "./enum.mjs";

/**
 * Proficiencies are the things a character can be trained in: skills, weapon categories, spellcraft
 * families, and tradecrafts. Training is the process by which a proficiency is advanced, granted by
 * talents and creation options and allocated with Proficiency Points.
 *
 * Every proficiency lives here rather than beside the subsystem it belongs to, so the full set is
 * legible in one place and `PROFICIENCIES` can be assembled without importing four modules.
 */

/* -------------------------------------------- */
/*  Proficiency Groups                          */
/* -------------------------------------------- */

/**
 * The groups into which proficiencies are gathered for display.
 * Skills are further subdivided for display by their own SKILL_CATEGORIES, which carry their own colors.
 * @type {Readonly<Record<string, {id: string, label: string, color: string}>>}
 */
export const GROUPS = defineEnum({
  skill: {label: "TRAINING.GROUPS.Skill", color: "#81cc44"},
  weapon: {label: "TRAINING.GROUPS.Weapon", color: "#c0553d"},
  equipment: {label: "TRAINING.GROUPS.Equipment", color: "#8a8f98"},
  spell: {label: "TRAINING.GROUPS.Spell", color: "#4d8fd1"},
  craft: {label: "TRAINING.GROUPS.Craft", color: "#c9a227"}
});

/* -------------------------------------------- */
/*  Skills                                      */
/* -------------------------------------------- */

/**
 * The thematic categories of skills. Each skill belongs to one of these categories.
 * @type {Readonly<Record<string, {id: string, label: string, hint: string, defaultIcon: string, color: Color}>>}
 */
export const SKILL_CATEGORIES = defineEnum({
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

/* -------------------------------------------- */
/*  Weapons                                     */
/* -------------------------------------------- */

/**
 * Training categories which apply to weapons.
 * Icons are inherited from the talent which grants each training, except for simple weapons which no talent grants.
 * Abilities name the scaling of each type's archetypal categories. They are authored rather than derived because
 * balanced categories declare two training types, which would otherwise collapse light and heavy onto one pair,
 * and because no category declares the natural or simple types at all.
 * @type {Readonly<Record<WeaponTrainingTypes, {id: string, label: string, icon: string, abilities: string[]}>>}
 **/
export const WEAPONS = defineEnum({
  talisman: {label: "TRAINING.LABELS.talisman", short: "TRAINING.LABELS.talismanShort",
    icon: "icons/weapons/polearms/trident-fork-white.webp", abilities: ["presence"]},
  heavy: {label: "TRAINING.LABELS.heavy", short: "TRAINING.LABELS.heavyShort",
    icon: "icons/skills/melee/weapons-crossed-poleaxes-white.webp", abilities: ["strength"]},
  light: {label: "TRAINING.LABELS.light", short: "TRAINING.LABELS.lightShort",
    icon: "icons/weapons/swords/sword-simple-white.webp", abilities: ["dexterity"]},
  mechanical: {label: "TRAINING.LABELS.mechanical", short: "TRAINING.LABELS.mechanicalShort",
    icon: "icons/weapons/crossbows/crossbow-white.webp", abilities: ["dexterity"]},
  natural: {label: "TRAINING.LABELS.natural", short: "TRAINING.LABELS.naturalShort",
    icon: "systems/crucible/icons/proficiencies/natural-weapon.webp", abilities: ["strength", "dexterity"]},
  projectile: {label: "TRAINING.LABELS.projectile", short: "TRAINING.LABELS.projectileShort",
    icon: "icons/weapons/bows/shortbow-white.webp", abilities: ["strength", "dexterity"]},
  shield: {label: "TRAINING.LABELS.shield", short: "TRAINING.LABELS.shieldShort",
    icon: "icons/equipment/shield/buckler-wooden-boss-lightning.webp", abilities: ["strength", "dexterity"]},
  unarmed: {label: "TRAINING.LABELS.unarmed", short: "TRAINING.LABELS.unarmedShort",
    icon: "icons/skills/melee/unarmed-punch-fist-white.webp", abilities: ["strength", "dexterity"]}
});

/* -------------------------------------------- */
/*  Equipment                                   */
/* -------------------------------------------- */

/**
 * Proficiencies in the use of worn or carried equipment other than weapons.
 * Armor is deliberately one proficiency rather than one per category, since bearing armor is a single
 * competence regardless of its weight.
 * @type {Readonly<Record<string, {id: string, label: string, short?: string, icon: string,
 *   abilities: string[]}>>}
 */
export const EQUIPMENT = defineEnum({
  armor: {label: "TRAINING.LABELS.armor", short: "TRAINING.LABELS.armorShort",
    icon: "systems/crucible/icons/proficiencies/armor.webp", abilities: ["strength", "toughness"]}
});

/* -------------------------------------------- */
/*  Spellcraft                                  */
/* -------------------------------------------- */

/**
 * The areas of spellcraft in which a character may be trained, each grouping several Arcane Runes.
 * Abilities are the union of the scaling declared by the runes of each family, restated here so that every
 * training type carries its own abilities rather than requiring consumers to walk the rune table.
 * @type {Readonly<Record<string, {id: string, label: string, icon: string, abilities: string[]}>>}
 */
export const SPELLCRAFT = {
  physical: {id: "physical", label: "TRAINING.LABELS.physical", short: "TRAINING.LABELS.physicalShort",
    icon: "icons/magic/movement/pinwheel-turning-blue.webp",
    abilities: ["wisdom", "presence"]},
  elemental: {id: "elemental", label: "TRAINING.LABELS.elemental", short: "TRAINING.LABELS.elementalShort",
    icon: "icons/magic/symbols/elements-air-earth-fire-water.webp",
    abilities: ["wisdom", "intellect"]},
  spiritual: {id: "spiritual", label: "TRAINING.LABELS.spiritual", short: "TRAINING.LABELS.spiritualShort",
    icon: "icons/magic/light/projectile-halo-teal.webp",
    abilities: ["intellect", "presence"]}
};

/* -------------------------------------------- */
/*  Tradecrafts                                 */
/* -------------------------------------------- */

/**
 * Training categories which apply to tradecraft.
 * Icons are inherited from the talent which grants each training.
 * @type {Readonly<Record<string, {id: string, label: string, icon: string, abilities: string[]}>>}
 **/
export const TRADECRAFTS = defineEnum({
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

/* -------------------------------------------- */
/*  The Full Set                                */
/* -------------------------------------------- */

/**
 * Every proficiency in the system, keyed by id.
 * `label` is the full and formal name, correct wherever a proficiency is cited on its own. `short` is
 * optional shorthand for use beside its own group heading; display it as `short ?? label`.
 * @type {Readonly<Record<string, {id: string, group: string, label: string, short?: string,
 *   abilities: string[]}>>}
 */
export const PROFICIENCIES = defineEnum({
  ...Object.entries(SKILLS).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.skill.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(WEAPONS).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.weapon.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(EQUIPMENT).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.equipment.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(SPELLCRAFT).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.spell.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(TRADECRAFTS).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.craft.label, label, short, abilities};
    return obj;
  }, {})
});

/* -------------------------------------------- */
/*  Training Progression                        */
/* -------------------------------------------- */

/**
 * The possible training ranks, their skill bonuses, and the points required to attain them.
 * Requirements double their interval, so each rank costs as much to reach as every rank before it combined.
 * @type {Readonly<Record<string, CrucibleTrainingRank>>}
 */
export const RANKS = defineEnum({
  untrained: {
    rank: 0,
    label: "TALENT.RANKS.Untrained",
    bonus: -4,
    required: 0
  },
  trained: {
    rank: 1,
    label: "TALENT.RANKS.Trained",
    bonus: 0,
    required: 2
  },
  proficient: {
    rank: 2,
    label: "TALENT.RANKS.Proficient",
    bonus: 1,
    required: 6
  },
  expert: {
    rank: 3,
    label: "TALENT.RANKS.Expert",
    bonus: 2,
    required: 14
  },
  master: {
    rank: 4,
    label: "TALENT.RANKS.Master",
    bonus: 3,
    required: 30
  }
});

/**
 * A reverse mapping of training rank integers to rank definitions.
 * @type {Readonly<Record<number, CrucibleTrainingRank>>}
 */
export const RANK_VALUES = Object.freeze(Object.values(RANKS).reduce((obj, e) => {
  obj[e.rank] = e;
  return obj;
}, {}));

/**
 * The highest training rank which may be attained.
 * @type {number}
 */
export const RANK_MAX = Math.max(...Object.values(RANKS).map(r => r.rank));

/**
 * The greatest number of training points any one type may hold, being those which attain the highest rank.
 * @type {number}
 */
export const POINTS_MAX = Math.max(...Object.values(RANKS).map(r => r.required));

/**
 * Proficiency Points awarded to a hero, which are allocated to advance training.
 * This rate also caps how many points a single training may hold, so allocation alone can carry exactly one
 * training to mastery; talents advance further trainings rather than carrying any one of them higher.
 * @type {Readonly<{initial: number, perLevel: number}>}
 */
export const PROFICIENCY_POINTS = Object.freeze({
  initial: 4,
  perLevel: 2
});

/**
 * The number of training points a Background is expected to grant, free of Proficiency Point cost.
 * @type {number}
 */
export const BACKGROUND_POINTS = 2;

/* -------------------------------------------- */
/*  Knowledge                                   */
/* -------------------------------------------- */

/**
 * The UUID of the journal entry which provides skill definitions to the system.
 * @type {string}
 */
export const JOURNAL_ID = "Compendium.crucible.rules.JournalEntry.CrucibleSkills00";

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
