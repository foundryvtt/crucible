import {freezeEnum} from "./enum.mjs";

/**
 * The travel paces which are possible for group actors.
 * @type {Record<"hidden"|"slow"|"normal"|"fast"|"reckless", {id: string, label: string, modifier: number}>}
 */
export const TRAVEL_PACES = freezeEnum({
  hidden: {
    label: "TRAVEL_PACES.HIDDEN",
    modifier: -1
  },
  slow: {
    label: "TRAVEL_PACES.SLOW",
    modifier: -0.5
  },
  normal: {
    label: "TRAVEL_PACES.NORMAL",
    modifier: 0
  },
  fast: {
    label: "TRAVEL_PACES.FAST",
    modifier: 0.5
  },
  reckless: {
    label: "TRAVEL_PACES.RECKLESS",
    modifier: 1
  }
});

/* -------------------------------------------- */

/**
 * Define the actor preparation hooks which are supported for Talent configuration.
 * @enum {{signature: string, argNames: string[]}}
 */
export const HOOKS = Object.freeze({

  // Action Usage
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
  applyActionOutcome: {
    group: "TALENT.HOOKS.GROUP_ACTION",
    argNames: ["action", "outcome", "options"]
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
  prepareSkillCheck: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["skill", "rollData"]
  },
  prepareSkillAttack: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["action", "target", "rollData"]
  },
  prepareSpellAttack: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["spell", "target", "rollData"]
  },
  prepareTraining: {
    group: "TALENT.HOOKS.GROUP_PREPARATION",
    argNames: ["training"]
  }
});
