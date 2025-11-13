import * as ATTRIBUTES from "./attributes.mjs";
import * as ACTION from "./action.mjs";
import * as ARMOR from "./armor.mjs";
import * as CONSUMABLE from "./consumable.mjs";
import * as CRAFTING from "./crafting.mjs";
import * as DICE from "./dice.mjs";
import * as ITEM from "./items.mjs";
import * as EFFECTS from "./effects.mjs";
import * as SKILL from "./skills.mjs"
import * as SPELL from "./spellcraft.mjs";
import * as WEAPON from "./weapon.mjs";
import * as ACCESSORY from "./accessory.mjs";
import * as ACTOR from "./actor.mjs";
import * as TALENT from "./talents.mjs";

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
  spell: "crucible.spell",
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
    heroismMax: 0,
    label: "ADVERSARY.THREAT_RANKS.MINION",
    scaling: 0.5,
    icon: "fa-solid fa-chevron-down"
  },
  normal: {
    id: "normal",
    actionMax: 6,
    heroismMax: 1,
    label: "ADVERSARY.THREAT_RANKS.NORMAL",
    scaling: 1.0,
    icon: "fa-solid fa-chevron-up"
  },
  elite: {
    id: "elite",
    actionMax: 8,
    heroismMax: 2,
    label: "ADVERSARY.THREAT_RANKS.ELITE",
    scaling: 1.5,
    icon: "fa-solid fa-chevrons-up"
  },
  boss: {
    id: "boss",
    actionMax: 10,
    heroismMax: 3,
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
  initialize: {
    argNames: [],
    argLabels: []
  },
  prepare: {
    argNames: [],
    argLabels: []
  },
  displayOnSheet: {
    argNames: [],
    argLabels: [],
    deprecated: true /** @deprecated */
  },
  canUse: {
    argNames: [],
    argLabels: [],
  },
  configure: {
    argNames: [],
    argLabels: []
  },
  preActivate: {
    argNames: ["targets"],
    argLabels: ["targets: ActionTarget[]"],
    async: true
  },
  roll: {
    argNames: ["outcome"],
    argLabels: ["outcome: CrucibleActionOutcome"],
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
 * Configuration how long certain actions in Crucible take to perform.
 * @type {{restSeconds: number, roundSeconds: number, recoverSeconds: number}}
 */
export const TIME = Object.freeze({
  roundSeconds: 10,
  recoverSeconds: 60 * 10,
  restSeconds: 60 * 60 * 10
});

/* -------------------------------------------- */

/**
 * Include all constant definitions within the SYSTEM global export.
 * Export removing submodule structure such that the entire system constant structure is a plain object.
 * @type {object}
 */
export const SYSTEM = {
  ABILITIES: ATTRIBUTES.ABILITIES,
  ACCESSORY: {...ACCESSORY},
  ACTION: {...ACTION},
  ACTION_HOOKS,
  ACTOR: {...ACTOR},
  ANCESTRIES,
  ARMOR: {...ARMOR},
  COMPENDIUM_PACKS,
  CONSUMABLE: {...CONSUMABLE},
  CRAFTING: {...CRAFTING},
  DAMAGE_CATEGORIES: ATTRIBUTES.DAMAGE_CATEGORIES,
  DAMAGE_TYPES: ATTRIBUTES.DAMAGE_TYPES,
  DEFENSES: ATTRIBUTES.DEFENSES,
  DICE: {...DICE},
  EFFECTS: {...EFFECTS},
  ITEM: {...ITEM},
  PASSIVE_BASE: ATTRIBUTES.PASSIVE_BASE,
  RESOURCES: ATTRIBUTES.RESOURCES,
  SKILL: {...SKILL},
  SKILLS: SKILL.SKILLS, // alias
  SPELL: {...SPELL},
  TALENT: {...TALENT},
  THREAT_RANKS,
  TIME,
  WEAPON: {...WEAPON}
};
