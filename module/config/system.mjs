import * as ATTRIBUTES from "./attributes.mjs";
import * as ACTION from "./action.mjs";
import * as ARMOR from "./armor.mjs";
import * as CONSUMABLE from "./consumable.mjs";
import * as dice from "./dice.mjs";
import * as ITEM from "./items.mjs";
import * as EFFECTS from "./effects.mjs";
import * as SKILL from "./skills.mjs"
import * as SPELL from "./spellcraft.mjs";
import * as WEAPON from "./weapon.mjs";
import * as ACCESSORY from "./accessory.mjs";
import * as ACTOR from "./actor.mjs";
import * as TALENT from "./talents.mjs";

export const SYSTEM_ID = "crucible";

/* -------------------------------------------- */

/**
 * The amount of damage resistance granted by ancestries.
 * @type {object}
 */
export const ANCESTRIES = {
  primaryAbilityStart: 3,
  secondaryAbilityStart: 2,
  resistanceAmount: 3
}

/* -------------------------------------------- */

/**
 * The compendium pack IDs which should be used as the source for character creation materials.
 * Modules that want to configure base system behavior should define `crucible.CONFIG.packs` instead.
 * @enum {string}
 */
export const COMPENDIUM_PACKS = Object.freeze({
  ancestry: "crucible.ancestry",
  archetype: "crucible.archetype",
  background: "crucible.background",
  spell: "crucible.spells",
  talent: "crucible.talent",
  taxonomy: "crucible.taxonomy"
});

/* -------------------------------------------- */

/**
 * The threat ranks that an adversary may have.
 * @enum {number}
 */
export const THREAT_RANKS = {
  minion: {
    id: "minion",
    actionMax: 4,
    label: "ADVERSARY.THREAT_RANKS.MINION",
    scaling: 0.5,
    icon: "fa-solid fa-chevron-down"
  },
  normal: {
    id: "normal",
    actionMax: 6,
    label: "ADVERSARY.THREAT_RANKS.NORMAL",
    scaling: 1.0,
    icon: "fa-solid fa-chevron-up"
  },
  elite: {
    id: "elite",
    actionMax: 8,
    label: "ADVERSARY.THREAT_RANKS.ELITE",
    scaling: 1.5,
    icon: "fa-solid fa-chevrons-up"
  },
  boss: {
    id: "boss",
    actionMax: 10,
    label: "ADVERSARY.THREAT_RANKS.BOSS",
    scaling: 2.0,
    icon: "fa-solid fa-skull"
  }
};

/* -------------------------------------------- */

/**
 * Define the Action life-cycle hooks which are supported for an Action.
 * @enum {Readonly<Object<{argNames: string[]}>>}
 */
export const ACTION_HOOKS = Object.freeze({
  configure: {
    argNames: [],
    argLabels: []
  },
  prepare: {
    argNames: [],
    argLabels: []
  },
  displayOnSheet: {
    argNames: ["combatant"],
    argLabels: ["combatant: boolean"],
  },
  canUse: {
    argNames: ["targets"],
    argLabels: ["targets: ActionTarget[]"],
  },
  preActivate: {
    argNames: ["targets"],
    argLabels: ["targets: ActionTarget[]"],
    async: true
  },
  roll: {
    argNames: ["target", "rolls"],
    argLabels: ["target: ActionTarget", "rolls: StandardCheck[]"],
    async: true
  },
  postActivate: {
    argNames: ["outcome"],
    argLabels: ["outcome: CrucibleActionOutcome"],
    async: true
  },
  confirm: {
    argNames: ["reverse"],
    argLabels: ["reverse: boolean"],
    async: true
  },
  summon: {
    argNames: ["reverse"],
    argLabels: ["reverse: boolean"],
    async: true
  }
});

/* -------------------------------------------- */

/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  ABILITIES: ATTRIBUTES.ABILITIES,
  ACCESSORY,
  ACTION,
  ACTOR,
  ACTION_HOOKS,
  ANCESTRIES,
  ARMOR,
  COMPENDIUM_PACKS,
  CONSUMABLE,
  DAMAGE_CATEGORIES: ATTRIBUTES.DAMAGE_CATEGORIES,
  DAMAGE_TYPES: ATTRIBUTES.DAMAGE_TYPES,
  DEFENSES: ATTRIBUTES.DEFENSES,
  EFFECTS,
  ITEM,
  PASSIVE_BASE: ATTRIBUTES.PASSIVE_BASE,
  RESOURCES: ATTRIBUTES.RESOURCES,
  SKILL,
  SKILLS: SKILL.SKILLS, // alias
  SPELL,
  TALENT,
  THREAT_RANKS,
  WEAPON,
  activeCheckFormula: "3d8",
  dice: dice
};
