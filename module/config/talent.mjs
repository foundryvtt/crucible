

export const ACTION_TARGET_TYPES = {
  "self": {
    label: "Self"
  },
  "single": {
    label: "Single"
  },
  "cone": {
    label: "Cone"
  },
  "fan": {
    label: "Fan"
  },
  "pulse": {
    label: "Pulse"
  },
  "blast": {
    label: "Blast"
  },
  "ray": {
    label: "Ray"
  },
  "wall": {
    label: "Wall"
  }
}

/* -------------------------------------------- */

/**
 * @typedef {Object}    ActionTag
 * @property {string} tag
 * @property {string} label
 * @property {Function} [prepare]
 * @property {Function} [can]
 * @property {Function} [pre]
 * @property {Function} [execute]
 * @property {Function} [post]
 */

/**
 * Define special logic for action tag types
 * @enum {ActionTag}
 */
export const ACTION_TAGS = {
  deadly: {
    tag: "deadly",
    label: "Deadly",
    pre: (actor, action) => action.bonuses.damageMultiplier += 1,
  },
  dualwield: {
    tag: "dualwield",
    label: "Dual Wield",
    can: (actor, action) => actor.equipment.weapons.dualWield
  },
  empowered: {
    tag: "empowered",
    label: "Empowered",
    pre: (actor, action) => action.bonuses.damageBonus += 2,
  },
  exposing: {
    tag: "exposing",
    label: "Exposing",
    pre: (actor, action) => action.bonuses.boons += 2
  },
  finesse: {
    tag: "finesse",
    label: "Finesse",
    can: (actor, action) => actor.equipment.weapons.mainhand.config.category.id === "light1"
  },
  harmless: {
    tag: "harmless",
    label: "Harmless",
    pre: (actor, action) => action.bonuses.damageMultiplier -= 1
  },
  melee: {
    tag: "melee",
    label: "Melee",
    can: (actor, action) => actor.equipment.weapons.melee,
    execute: (actor, action, target) => {
      target.status.wasAttacked = true
      actor.status.hasAttacked = true
    }
  },
  mainhand: {
    tag: "mainhand",
    label: "Main-Hand",
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.mainhand.systemData.actionCost,
    pre: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      foundry.utils.mergeObject(action.bonuses, mh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {hasDice: true, label: mh.name, tags: mh.getTags({scope: "short"})});
    },
    execute: (actor, action, target) => actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses)
  },
  movement: {
    tag: "movement",
    label: "Movement",
    prepare: (actor, action) => action.actionCost -= (actor.status.hasMoved ? 0 : 1),
    execute: (actor, action, target) => action.actorUpdates["data.status.hasMoved"] = true
  },
  ranged: {
    tag: "ranged",
    label: "Ranged",
    can: (actor, action) => actor.equipment.weapons.ranged,
    execute: (actor, action, target) => action.actorUpdates["data.status.hasAttacked"] = true
  },
  reaction: {
    tag: "reaction",
    label: "Reaction",
    can: (actor, action) => actor !== game.combat.combatant.actor
  },
  shield: {
    type: "shield",
    label: "Shield",
    can: (actor, action) => actor.equipment.weapons.shield
  },
  chain: {
    tag: "chain",
    label: "Attack Chain",
    post: async function(actor, action, target, rolls) {
      if ( !rolls.every(r => r.isSuccess ) ) return;
      const chain = await actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses);
      rolls.push(chain);
    }
  },
  offhand: {
    tag: "offhand",
    label: "Off-Hand",
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.offhand.systemData.actionCost,
    pre: (actor, action) => {
      const oh = actor.equipment.weapons.offhand;
      foundry.utils.mergeObject(action.bonuses, oh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {hasDice: true, label: oh.name, tags: oh.getTags({scope: "short"})});
    },
    execute: (actor, action, target) => actor.equipment.weapons.offhand.weaponAttack(target, action.bonuses)
  },
  twohand: {
    tag: "twohand",
    label: "Two-Handed",
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.mainhand.systemData.actionCost,
    can: (actor, action) => actor.equipment.weapons.twoHanded,
    pre: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      foundry.utils.mergeObject(action.bonuses, mh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {hasDice: true, label: mh.name, tags: mh.getTags({scope: "short"})});
    },
    execute: (actor, action, target) => actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses)
  },
  weapon: {
    tag: "weapon",
    label: "Weaponry",
    can: (actor, action) => !actor.equipment.weapons.unarmed
  },
  unarmed: {
    tag: "unarmed",
    label: "Unarmed",
    can: (actor, action) => actor.equipment.weapons.unarmed
  },
  unarmored: {
    tag: "unarmored",
    label: "Unarmored",
    can: (actor, action) => actor.equipment.unarmored
  },
  unsighted: {
    tag: "unsighted",
    label: "Unsighted",
    pre: (actor, action) => action.bonuses.banes += 2
  },

  /* -------------------------------------------- */
  /*  TODO - Spells (Temporary)                   */
  /* -------------------------------------------- */

  spell: {
    tag: "spell",
    label: "Spell",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {damageMultiplier: 1});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: []
      });
    },
    execute: (actor, action, target) => action.document.spellAttack(target, action.bonuses)
  },
  arcane: {
    tag: "arcane",
    label: "Arcane",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "willpower"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Willpower"]
      });
    },
  },
  primal: {
    tag: "primal",
    label: "Primal",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "reflex"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Reflex"]
      });
    },
  },
  occult: {
    tag: "occult",
    label: "Occult",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "fortitude"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Fortitude"]
      });
    },
  },
}

/* -------------------------------------------- */


/**
 * The default actions that every character can perform regardless of their attributes or talents.
 * @type {object}
 */
export const DEFAULT_ACTIONS = [
  {
    id: "move",
    name: "Move",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "Move quickly up to 4 spaces in any direction, or move cautiously one space in any direction.",
    targetType: "self",
    targetNumber: 1,
    targetDistance: 4,
    actionCost: 1,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: false,
    tags: ["movement"]
  },
  {
    id: "strike",
    name: "Strike",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "Attack a single target creature or object with your main-hand weapon.",
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 0,  // Determined by your weapon
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["mainhand"]
  }
];
