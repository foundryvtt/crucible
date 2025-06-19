import {freezeEnum} from "./enum.mjs";

/**
 * Creature types supported by the system.
 * @type {Record<string, string>}
 */
export const CREATURE_CATEGORIES = {
  beast: "TAXONOMY.CATEGORIES.BEAST",
  celestial: "TAXONOMY.CATEGORIES.CELESTIAL",
  elemental: "TAXONOMY.CATEGORIES.ELEMENTAL",
  giant: "TAXONOMY.CATEGORIES.GIANT",
  humanoid: "TAXONOMY.CATEGORIES.HUMANOID",
  outsider: "TAXONOMY.CATEGORIES.OUTSIDER",
  undead: "TAXONOMY.CATEGORIES.UNDEAD"
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
  18: {level: 18, milestones: {required: 8}},
}
for ( const l of Object.values(LEVELS) ) {
  if ( l.level === 0 ) continue;
  const p = LEVELS[l.level - 1];
  l.milestones.start = p.milestones.next;
  l.milestones.next = l.milestones.start + l.milestones.required;
}
foundry.utils.deepFreeze(LEVELS);

/**
 * The travel paces which are possible for group actors.
 * @type {Record<"hidden"|"slow"|"normal"|"fast"|"reckless", Partial<TokenMovementActionConfig>>}
 */
export const TRAVEL_PACES = freezeEnum({
  hidden: {
    order: 1,
    label: "TRAVEL_PACES.HIDDEN",
    costMultiplier: 4,
    speedMultiplier: 0.25,
    icon: "fa-solid fa-backward-fast"
  },
  slow: {
    order: 2,
    label: "TRAVEL_PACES.SLOW",
    costMultiplier: 2,
    speedMultiplier: 0.5,
    icon: "fa-solid fa-backward"
  },
  normal: {
    order: 3,
    label: "TRAVEL_PACES.NORMAL",
    costMultiplier: 1,
    speedMultiplier: 1,
    icon: "fa-solid fa-equals"
  },
  fast: {
    order: 4,
    label: "TRAVEL_PACES.FAST",
    costMultiplier: 0.66,
    speedMultiplier: 1.5,
    icon: "fa-solid fa-forward"
  },
  reckless: {
    order: 5,
    label: "TRAVEL_PACES.RECKLESS",
    costMultiplier: 0.5,
    speedMultiplier: 2,
    icon: "fa-solid fa-forward-fast"
  }
});

/* -------------------------------------------- */

/**
 * Define the actor preparation hooks which are supported for Talent configuration.
 * @enum {{signature: string, argNames: string[]}}
 */
export const HOOKS = Object.freeze({

  // Action Usage
  prepareAction: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action"]
  },
  preActivateAction: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "targets"]
  },
  rollAction: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "target", "rolls"]
  },
  confirmActionOutcome: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "outcome", "options"]
  },
  prepareStandardCheck: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["rollData"]
  },
  prepareWeaponAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "target", "rollData"]
  },
  applyCriticalEffects: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "outcome", "self"]
  },
  defendSkillAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "origin", "rollData"]
  },
  defendSpellAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["spell", "origin", "rollData"]
  },
  defendWeaponAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "origin", "rollData"]
  },

  prepareSkillCheck: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["skill", "rollData"]
  },
  prepareSkillAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "target", "rollData"]
  },
  prepareSpellAttack: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["spell", "target", "rollData"]
  },

  // Data Preparation
  prepareActions: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["actions"]
  },
  prepareResources: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["resources"]
  },
  prepareDefenses: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["defenses"]
  },
  prepareInitiativeCheck: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["rollData"]
  },
  prepareMovement: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["movement"]
  },
  prepareResistances: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["resistances"]
  },
  prepareTraining: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["training"]
  },

  // Turn Events
  startTurn: {
    group: "TALENT.HOOKS.GROUP_COMBAT",
    argNames: ["turnStartConfig"]
  },
  endTurn: {
    group: "TALENT.HOOKS.GROUP_COMBAT",
    argNames: ["turnEndConfig"]
  }
});
