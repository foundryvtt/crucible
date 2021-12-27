

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
  },
  mainhand: {
    tag: "mainhand",
    label: "Main-Hand",
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.mainhand.systemData.actionCost,
    pre: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      foundry.utils.mergeObject(action.bonuses, mh.getItemBonuses());
      action.context = {label: mh.name, tags: mh.getTags({scope: "short"})};
    },
    execute: (actor, action, target) => actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses)
  },
  movement: {
    tag: "movement",
    label: "Movement"
  },
  ranged: {
    tag: "ranged",
    label: "Ranged",
    can: (actor, action) => actor.equipment.weapons.ranged
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
      action.context = {label: oh.name, tags: oh.getTags({scope: "short"})};
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
      action.context = {label: mh.name, tags: mh.getTags({scope: "short"})};
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
  }
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
    description: "Move quickly up to 20 feet in any direction, or move cautiously 5 feet in any direction.",
    targetType: "self",
    targetNumber: 1,
    targetDistance: 2,
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
