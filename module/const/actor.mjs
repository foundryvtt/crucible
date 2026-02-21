import {freezeEnum} from "./enum.mjs";

/**
 * Creature types supported by the system.
 * @type {Record<string, {label: string, skill: string, knowledge: string}>}
 */
export const CREATURE_CATEGORIES = {
  beast: {
    label: "TAXONOMY.CATEGORIES.Beast",
    skill: "medicine",
    knowledge: "beasts"
  },
  celestial: {
    label: "TAXONOMY.CATEGORIES.Celestial",
    skill: "arcana",
    knowledge: "celestials"
  },
  construct: {
    label: "TAXONOMY.CATEGORIES.Construct",
    skill: "science",
    knowledge: "machines"
  },
  dragon: {
    label: "TAXONOMY.CATEGORIES.Dragon",
    skill: "arcana",
    knowledge: "dragons"
  },
  elemental: {
    label: "TAXONOMY.CATEGORIES.Elemental",
    skill: "arcana",
    knowledge: "elementals"
  },
  elementalEarth: {
    label: "TAXONOMY.CATEGORIES.ElementalEarth",
    skill: "arcana",
    knowledge: "elementals"
  },
  elementalFire: {
    label: "TAXONOMY.CATEGORIES.ElementalFire",
    skill: "arcana",
    knowledge: "elementals"
  },
  elementalFrost: {
    label: "TAXONOMY.CATEGORIES.ElementalFrost",
    skill: "arcana",
    knowledge: "elementals"
  },
  elementalStorm: {
    label: "TAXONOMY.CATEGORIES.ElementalStorm",
    skill: "arcana",
    knowledge: "elementals"
  },
  fey: {
    label: "TAXONOMY.CATEGORIES.Fey",
    skill: "arcana",
    knowledge: "fey"
  },
  giant: {
    label: "TAXONOMY.CATEGORIES.Giant",
    skill: "society",
    knowledge: "legends"
  },
  humanoid: {
    label: "TAXONOMY.CATEGORIES.Humanoid",
    skill: "society",
    knowledge: null
  },
  monstrosity: {
    label: "TAXONOMY.CATEGORIES.Monstrosity",
    skill: "medicine",
    knowledge: "monsters"
  },
  ooze: {
    label: "TAXONOMY.CATEGORIES.Ooze",
    skill: "science",
    knowledge: null
  },
  outsider: {
    label: "TAXONOMY.CATEGORIES.Outsider",
    skill: "arcana",
    knowledge: "outsiders"
  },
  undead: {
    label: "TAXONOMY.CATEGORIES.Undead",
    skill: "arcana",
    knowledge: "undeath"
  }
};

/**
 * @typedef CrucibleCurrencyDenomination
 * @property {string} label                 A human-readable and localized label for the denomination
 * @property {string} abbreviation          A short abbreviation for the denomination
 * @property {number} multiplier            A numerical multiplier that quantifies the value of this denomination
 *                                          relative to base currency units
 * @property {string} [icon]                An optional image icon for the denomination.
 *                                          Recommended size is 48px square or smaller
 */

/**
 * Configure the set of currency denominations that are supported by the system.
 * The keys of this object are unique abbreviations which are used to parse currency strings.
 *
 * Each denomination specifies a multiplier which defines how valuable that denomination is.
 * Currency is stored as an integer value of the lowest denomination (multiplier=1).
 *
 * There should be at least one denomination which has a multiplier of 1 to ensure that a raw currency amount can be
 * fully allocated.
 *
 * @type {Record{string, CrucibleCurrencyDenomination}
 */
export const CURRENCY_DENOMINATIONS = {
  cp: {
    label: "CURRENCY_DENOMINATIONS.CP.label",
    abbreviation: "CURRENCY_DENOMINATIONS.CP.abbreviation",
    icon: "systems/crucible/icons/currency/cp.webp",
    multiplier: 1
  },
  sp: {
    label: "CURRENCY_DENOMINATIONS.SP.label",
    abbreviation: "CURRENCY_DENOMINATIONS.SP.abbreviation",
    icon: "systems/crucible/icons/currency/sp.webp",
    multiplier: 10
  },
  gp: {
    label: "CURRENCY_DENOMINATIONS.GP.label",
    abbreviation: "CURRENCY_DENOMINATIONS.GP.abbreviation",
    icon: "systems/crucible/icons/currency/gp.webp",
    multiplier: 100
  },
  pp: {
    label: "CURRENCY_DENOMINATIONS.PP.label",
    abbreviation: "CURRENCY_DENOMINATIONS.PP.abbreviation",
    icon: "systems/crucible/icons/currency/pp.webp",
    multiplier: 1000
  }
};

/**
 * Level advancement
 * @type {Record<number, {level: number, milestones: {start: number, required: number, next: number}}>}
 */
export const LEVELS = {
  0: {level: 0, milestones: {start: 0, required: 0, next: 0}},
  1: {level: 1, milestones: {required: 2}},
  2: {level: 2, milestones: {required: 3}},
  3: {level: 3, milestones: {required: 4}},
  4: {level: 4, milestones: {required: 4}},
  5: {level: 5, milestones: {required: 5}},
  6: {level: 6, milestones: {required: 5}},
  7: {level: 7, milestones: {required: 5}},
  8: {level: 8, milestones: {required: 6}},
  9: {level: 9, milestones: {required: 6}},
  10: {level: 10, milestones: {required: 6}},
  11: {level: 11, milestones: {required: 6}},
  12: {level: 12, milestones: {required: 7}},
  13: {level: 13, milestones: {required: 7}},
  14: {level: 14, milestones: {required: 7}},
  15: {level: 15, milestones: {required: 7}},
  16: {level: 16, milestones: {required: 7}},
  17: {level: 17, milestones: {required: 8}},
  18: {level: 18, milestones: {required: 8}}
};
for ( const l of Object.values(LEVELS) ) {
  if ( l.level === 0 ) continue;
  const p = LEVELS[l.level - 1];
  l.milestones.start = p.milestones.next;
  l.milestones.next = l.milestones.start + l.milestones.required;
}
LEVELS[18].milestones.next = Infinity;
foundry.utils.deepFreeze(LEVELS);

/**
 * The travel paces which are possible for group actors.
 * @type {Record<"hidden"|"slow"|"normal"|"fast"|"reckless", Partial<TokenMovementActionConfig>>}
 */
export const TRAVEL_PACES = freezeEnum({
  hidden: {
    order: 1,
    label: "TRAVEL_PACES.Hidden",
    costMultiplier: 4,
    speedMultiplier: 0.25,
    icon: "fa-solid fa-backward-fast"
  },
  slow: {
    order: 2,
    label: "TRAVEL_PACES.Slow",
    costMultiplier: 2,
    speedMultiplier: 0.5,
    icon: "fa-solid fa-backward"
  },
  normal: {
    order: 3,
    label: "TRAVEL_PACES.Normal",
    costMultiplier: 1,
    speedMultiplier: 1,
    icon: "fa-solid fa-equals"
  },
  fast: {
    order: 4,
    label: "TRAVEL_PACES.Fast",
    costMultiplier: 0.66,
    speedMultiplier: 1.5,
    icon: "fa-solid fa-forward"
  },
  reckless: {
    order: 5,
    label: "TRAVEL_PACES.Reckless",
    costMultiplier: 0.5,
    speedMultiplier: 2,
    icon: "fa-solid fa-forward-fast"
  }
});

/**
 * Categories a language can (optionally) belong to
 * @type {Record<string, {label: string}>}
 */
export const LANGUAGE_CATEGORIES = {
  nonSpoken: {
    label: "LANGUAGE_CATEGORIES.Nonspoken"
  },
  spoken: {
    label: "LANGUAGE_CATEGORIES.Spoken"
  }
};

/**
 * Languages a creature can know
 * @type {Record<string, {label: string, category?: string}>}}
 */
export const LANGUAGES = {
  common: {
    label: "LANGUAGES.Common",
    category: "spoken"
  },
  sign: {
    label: "LANGUAGES.Sign",
    category: "nonSpoken"
  }
};

/* -------------------------------------------- */

/**
 * Define the actor preparation hooks which are supported for Talent configuration.
 * @enum {{signature: string, argNames: string[]}}
 */
export const HOOKS = Object.freeze({

  // Action Usage
  prepareAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action"]
  },
  useAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action"]
  },
  preActivateAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "targets"]
  },
  rollAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "target", "rolls"]
  },
  finalizeAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "outcome"]
  },
  confirmAction: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "outcome", "options"]
  },
  prepareStandardCheck: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["rollData"]
  },
  applyCriticalEffects: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "outcome", "self"]
  },
  defendAttack: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "origin", "rollData"]
  },
  receiveAttack: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "roll"]
  },
  prepareAttack: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["action", "target", "rollData"]
  },
  prepareSkillCheck: {
    group: "TALENT.HOOKS.GroupAction",
    argNames: ["skill", "rollData"]
  },

  // Data Preparation
  prepareActions: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["actions"]
  },
  prepareResources: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["resources"]
  },
  prepareDefenses: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["defenses"]
  },
  prepareInitiativeCheck: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["rollData"]
  },
  prepareMovement: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["movement"]
  },
  prepareResistances: {
    group: "TALENT.HOOKS.GroupPreparation",
    argNames: ["resistances"]
  },

  // Equipment Preparation
  prepareArmor: {
    group: "TALENT.HOOKS.GroupEquipment",
    argNames: ["armor"]
  },
  prepareWeapons: {
    group: "TALENT.HOOKS.GroupEquipment",
    argNames: ["weapons"]
  },
  prepareAccessories: {
    group: "TALENT.HOOKS.GroupEquipment",
    argNames: ["accessories"]
  },
  prepareToolbelt: {
    group: "TALENT.HOOKS.GroupEquipment",
    argNames: ["toolbelt"]
  },

  // Spell Preparation
  prepareGrimoire: {
    group: "TALENT.HOOKS.GroupSpellcraft",
    argNames: ["grimoire"]
  },
  prepareSpells: {
    group: "TALENT.HOOKS.GroupSpellcraft",
    argNames: ["grimoire"]
  },

  // Turn Events
  startTurn: {
    group: "TALENT.HOOKS.GroupCombat",
    argNames: ["turnStartConfig"]
  },
  endTurn: {
    group: "TALENT.HOOKS.GroupCombat",
    argNames: ["turnEndConfig"]
  }
});
