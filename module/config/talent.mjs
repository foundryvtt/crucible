

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
 * @property {Function} [can]
 * @property {Function} [pre]
 * @property {Function} [prepare]
 * @property {Function} [post]
 */

/**
 * Define special logic for action tag types
 * @enum {ActionTag}
 */
export const ACTION_TAGS = {
  melee: {
    tag: "melee",
    label: "Melee",
    can: (actor, action) => actor.equipment.weapons.melee,
  },
  mainhand: {
    tag: "mainhand",
    label: "Main-Hand",
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.mainhand.systemData.actionCost
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
  attackChain: {
    tag: "attackChain",
    label: "Attack Chain",
    post: async function(actor, action, rolls) {
      if ( rolls.every(r => r.isSuccess) ) {
        rolls.push(await actor.equipment.weapons.mainhand.roll(rolls[0].data));
      }
    }
  },
  offhand: {
    tag: "offhand",
    label: "Off-Hand",
    can: (actor, action) => actor.equipment.weapons.dualWield,
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.offhand.systemData.actionCost
  },
  twohand: {
    tag: "twohand",
    label: "Two-Handed",
    can: (actor, action) => actor.equipment.weapons.twoHanded,
    prepare: (actor, action) => action.actionCost += actor.equipment.weapons.mainhand.systemData.actionCost
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



async function createTalent() {
  await Item.create({
    "name": "Impenetrable Advance",
    "img": "icons/environment/people/infantry-armored.webp",
    "type": "talent",
    "folder": game.folders.getName("Armor Talents").id,
    "data.tier": 1,
    "data.cost": 1,
    "data.description": "You gain +1 Resistance to Bludgeoning, Piercing, and Slashing while you have Heavy Armor equipped.",
    // "data.actions": [{
    //   id: "move",
    //   name: "Move",
    //   img: "icons/skills/movement/arrow-upward-yellow.webp",
    //   description: "You move at normal speed up to 10 feet in any direction.",
    //   targetType: "self",
    //   targetNumber: 1,
    //   targetDistance: 2,
    //   actionCost: 1,
    //   focusCost: 0,
    //   affectAllies: false,
    //   affectEnemies: false,
    //   tags: ["movement"]
    // }],
    "data.requirements": {"advancement.level": 1, "attributes.strength.value": 4}
  });
}
