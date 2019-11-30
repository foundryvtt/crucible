export const skills = {};

/**
 * The rank tiers which can be progressed for Skills in the system
 * @type {Array<Object>}
 */
skills.ranks = [
  {
    name: "Untrained",
    desc: "You have no formal training in this area. Any success you have is due to luck.",
    modifier: -4,
    cost: 0,
    cumulative: 0,
    progression: 0
  },
  {
    name: "Novice",
    desc: "You have been provided basic instruction or acquired practical experience in the basics of this skill.",
    modifier: 2,
    cost: 1,
    cumulative: 1,
    progression: 0
  },
  {
    name: "Apprentice",
    desc: "You have practiced and honed your skills to a strong functional degree.",
    modifier: 4,
    cost: 1,
    cumulative: 2,
    progression: 1
  },
  {
    name: "Journeyman",
    desc: "You are a subject matter expert in this area.",
    modifier: 6,
    cost: 2,
    cumulative: 4,
    progression: 0
  },
  {
    name: "Master",
    desc: "You are a true master of this skill and its techniques.",
    modifier: 10,
    cost: 3,
    cumulative: 7,
    progression: 2
  },
  {
    name: "Grandmaster",
    desc: "You are peerless in your mastery of this area.",
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
  "exp": "Exploration",
  "kno": "Knowledge",
  "soc": "Social",
  "trd": "Tradecraft"
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
        description: "You know basic survival skills. You are able to start fires with flint and tinder, you are able " +
          "to spend time foraging for food and water in most environments, and you can recognize common environmental " +
          "hazards. You are able to recognize and follow the tracks of creatures which you are familiar with if the " +
          "tracks are discovered."
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "You know advanced survival skills, you are experienced with mountain climbing, underwater diving, " +
          "spelunking, and other methods of exploring difficult environments. You can guide groups of allies through " +
          "such obstacles, granting a +2 situational bonus to Skill Checks made by allies who do not have this tier of " +
          "the Survival Skill. You are able to follow the tracks of a creature that you are not familiar with, even " +
          "if you do not recognize the tracks. You can attempt to forage for food and water without slowing your " +
          "normal pace of travel."
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "You are a paragon of wilderness exploration and self-sufficiency. You can find food, water, and " +
          "shelter in even  the most inhospitable of environments. Once you find the tracks of a creature the quarry " +
          "cannot elude you by non-magical means.",
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
            description: "Select one environmental biome as Favored Terrain, You gain a +2 situational bonus to Skill " +
              "Checks made when exploring that environment."
          },
          {
            rank: 4,
            description: "Select a second environmental biome as Favored Terrain."
          },
          {
            rank: 5,
            description: "Select a third environmental biome as Favored Terrain. Your situational bonus to Skill Checks " +
              "performed while exploring these environments improves to +5. You gain a situational bonus of +2 while " +
              "exploring non-favored biomes."
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
            description: "Select one naturally occurring creature type as a Favored Prey. You gain a +2 situational " +
              "bonus to Spell Power and Attack Rolls against this type of creature."
          },
          {
            rank: 4,
            description: "Select a second naturally occurring creature type as Favored Prey."
          },
          {
            rank: 5,
            description: "Select a third naturally occurring creature type as Favored Prey. Your situational bonus to " +
              "Spell Power and Attack Rolls against this type of creature improves to +5. You gain a situational bonus " +
              "of +2 when attacking non-favored naturally occurring creatures."
          }
        ]
      },
      {
        id: "herbalist",
        name: "Herbalist",
        icon: "icons/skills/herbalist.jpg",
        description: "Specialists in exploration and navigation of challenging environmental obstacles.",
        ranks: [
          {
            rank: 2,
            description: "You are knowledgeable in common herblore, are able to recognize useful herbs in the wild. " +
              "You may spend time during a rest to attempt a Potion Brewing crafting check."
          },
          {
            rank: 4,
            description: "Your studies of advanced herblore have made you familiar with toxins and venoms which you " +
              "can extract from plants and creatures. You may spend time during a rest to attempt a crafting check to " +
              "create Poisons."
          },
          {
            rank: 5,
            description: "You always succeed in brewing Potions or Poisons provided you have the ingredients and your " +
              "efforts produce double the quantity of output. You know forbidden arts of creating odorless and " +
              "tasteless poisons from rare ingredients."
          }
        ]
      }
    ]
  }
};

