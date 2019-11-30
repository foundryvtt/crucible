export const skills = {};

/**
 * The rank tiers which can be progressed for Skills in the system
 * @type {Array<Object>}
 */
skills.ranks = [
  {
    rank: 0,
    name: "Untrained",
    description: "Purchase ranks in this skill to unlock its benefits.",
    rankDescription: "You have no formal training in this area. Any success you have is due to luck.",
    modifier: -4,
    cost: 0,
    cumulative: 0,
    progression: 0
  },
  {
    rank: 1,
    name: "Novice",
    rankDescription: "You have been provided basic instruction or acquired practical experience in the basics of this skill.",
    modifier: 2,
    cost: 1,
    cumulative: 1,
    progression: 0
  },
  {
    rank: 2,
    name: "Apprentice",
    rankDescription: "You have practiced and honed your skills to a strong functional degree.",
    modifier: 4,
    cost: 1,
    cumulative: 2,
    progression: 1
  },
  {
    rank: 3,
    name: "Journeyman",
    rankDescription: "You are a subject matter expert in this area.",
    modifier: 6,
    cost: 2,
    cumulative: 4,
    progression: 0
  },
  {
    rank: 4,
    name: "Master",
    rankDescription: "You are a true master of this skill and its techniques.",
    modifier: 10,
    cost: 3,
    cumulative: 7,
    progression: 2
  },
  {
    rank: 5,
    name: "Grandmaster",
    rankDescription: "You are peerless in your mastery of this area.",
    modifier: 12,
    cost: 5,
    cumulative: 12,
    progression: 3
  },
];

/**
 * The categories of skills which exist within the system
 * @type {Object}
 */
skills.categories = {
  "exp": {
    name: "Exploration",
    noPathIcon: "icons/skills/no-exp.jpg"
  },
  "kno": {
    name: "Knowledge",
    noPathIcon: "icons/skills/no-kno.jpg"
  },
  "soc": {
    name: "Social",
    noPathIcon: "icons/skills/no-soc.jpg"
  },
  "trd": {
    name: "Tradecraft",
    noPathIcon: "icons/skills/no-trd.jpg"
  }
};

/**
 * A template data structure to use for cases where a specialization path has not yet been chosen
 * @type {Object}
 */
skills.noPath = {
  id: "",
  name: "No Path",
  icon: "",
  description: "You have not chosen a specialization path.",
  ranks: []
};


/**
 * The available Skills which can be progressed within the system
 * @type {Array<Object>}
 */
skills.skills = {
  "survival": {
    name: "Survival",
    category: "exp",
    icon: "icons/skills/survival.jpg",
    ranks: [
      {
        rank: 1,
        description: "You know basic survival skills. You are able to start fires with flint and tinder, you are able to spend time foraging for food and water in most environments, and you can recognize common environmental hazards. You are able to recognize and follow the tracks of creatures which you are familiar with if the tracks are discovered."
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "You know advanced survival skills. You are able to start fires, attempt to forage for food, water, and shelter without slowing your pace of travel. You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks. You are experienced with mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them a +2 situational bonus on any Skill Checks made by allies who accompany you."
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "You are a paragon of wilderness survival and self-sufficiency. You can reliably forage for food, water, and shelter in even inhospitable or foreign environments. You are an expert tracker, once you find the tracks of a creature it cannot elude you by any ordinary means. You are a master of mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them a +5 situational bonus on any Skill Checks made by allies who accompany you.",
        progression: true
      }
    ],
    paths: [
      {
        id: "explorer",
        name: "Explorer",
        icon: "icons/skills/explorer.jpg",
        description: "Specialists in exploration and navigation of challenging environmental obstacles.",
        ranks: [
          {
            rank: 2,
            description: "Select one environmental biome as Favored Terrain, You gain a +2 situational bonus to Skill Checks made when exploring that environment."
          },
          {
            rank: 4,
            description: "Select two environmental biomes as Favored Terrain, You gain a +2 situational bonus to Skill Checks made when exploring those environments."
          },
          {
            rank: 5,
            description: "Select three environmental biomes as Favored Terrain. You gain a +5 situational bonus to Skill Checks made when exploring those environments and a +2 situational bonus while exploring non-favored biomes."
          }
        ]
      },
      {
        id: "hunter",
        name: "Hunter",
        icon: "icons/skills/hunter.jpg",
        description: "Specialists in the tracking and hunting of creatures.",
        ranks: [
          {
            rank: 2,
            description: "Select one naturally occurring creature type as a Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against this type of creature."
          },
          {
            rank: 4,
            description: "Select two naturally occurring creature types as Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against creatures of those types."
          },
          {
            rank: 5,
            description: "Select three naturally occurring creature types as Favored Prey. You gain a +5 situational bonus to Spell Power and Attack Rolls against creatures of those types and you gain a situational bonus +2 when attacking non-favored naturally occurring creatures."
          }
        ]
      },
      {
        id: "herbalist",
        name: "Herbalist",
        icon: "icons/skills/herbalist.jpg",
        description: "Specialists in the knowledge, identification, and usage of naturally growing plants and reagents",
        ranks: [
          {
            rank: 2,
            description: "You are knowledgeable in common herblore, are able to recognize useful herbs in the wild, and you may devote time during a rest to attempt a Potion Brewing crafting check with a +2 bonus using gathered ingredients."
          },
          {
            rank: 4,
            description: "You are knowledgeable in advanced herblore, are able to recognize both common and rare herbs in the wild. You are familiar with toxins and venoms which can be extracted from plants and creatures. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +2 bonus."
          },
          {
            rank: 5,
            description: "You are a master of herblore and are able to recognize any useful herb, reagent, toxin, or venom in the wild. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +5 bonus. If successful, you produce double the normal quantity of output. You know forbidden arts of creating odorless and tasteless poisons using rare ingredients."
          }
        ]
      }
    ]
  }
};

