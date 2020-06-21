import {SYSTEM_ID} from "./system.js";


/**
 * The cost in skill points to obtain the next skill rank
 * @type {number[]}
 */
export const SKILL_RANKS = {
  0: {
    label: "SKILL.Untrained",
    description: "You have no formal training in this area. Any success you have is due to luck.",
    cost: 0,
    bonus: -4,
    progression: 0
  },
  1: {
    label: "SKILL.Novice",
    description: "You have been provided basic instruction or acquired practical experience in the basics of this skill.",
    cost: 1,
    bonus: 0,
    progression: 0
  },
  2: {
    label: "SKILL.Apprentice",
    description: "You have practiced and honed your skills to a strong functional degree.",
    cost: 2,
    bonus: 2,
    progression: 1,
  },
  3: {
    label: "SKILL.Journeyman",
    description: "You are a subject matter expert in this area.",
    cost: 4,
    bonus: 4,
    progression: 0
  },
  4: {
    label: "SKILL.Master",
    description: "You are a true master of this skill and its techniques.",
    cost: 7,
    bonus: 8,
    progression: 2
  },
  5: {
    label: "SKILL.Grandmaster",
    description: "You are peerless in your mastery of this area.",
    cost: 12,
    bonus: 12,
    progression: 3
  }
};


export const SKILL_CATEGORIES = {
  "exp": {
    label: "Exploration",
    defaultIcon: "icons/skills/no-exp.jpg"
  },
  "kno": {
    label: "Knowledge",
    defaultIcon: "icons/skills/no-kno.jpg"
  },
  "soc": {
    label: "Social",
    defaultIcon: "icons/skills/no-soc.jpg"
  },
  "trd": {
    label: "Tradecraft",
    defaultIcon: "icons/skills/no-trd.jpg"
  }
};


/**
 * The available Skills which can be progressed within the system
 * @type {Array<Object>}
 */
export const SKILLS = {

  /* -------------------------------------------- */
  /*  Acrobatics
  /* -------------------------------------------- */
  "acrobatics": {
    name: "Acrobatics",
    category: "exp",
    icon: "icons/skills/acrobatics.jpg",
    attributes: ["strength", "dexterity"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "gymnast",
        name: "Gymnast",
        icon: "icons/skills/gymnast.jpg",
        description: "Specialists in acrobatic maneuvers which escape harm or tumble safely from great heights.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "traceur",
        name: "Traceur",
        icon: "icons/skills/traceur.jpg",
        description: "Specialists in rapidly traversing obstacles and scaling surfaces whether they be natural or urban.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "dancer",
        name: "Dancer",
        icon: "icons/skills/dancer.jpg",
        description: "Specialists in the art of dance, from the ballroom to the mesmerizing contortions of a street performer.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Perception
  /* -------------------------------------------- */
  "perception": {
    name: "Perception",
    category: "exp",
    icon: "icons/skills/perception.jpg",
    attributes: ["intellect", "willpower"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "scout",
        name: "Scout",
        icon: "icons/skills/scout.jpg",
        description: "Specialists in discovering the path forward and hidden ways which were concealed.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "sentry",
        name: "Sentry",
        icon: "icons/skills/sentry.jpg",
        description: "Specialists in the assessment of threats, an expert Sentry is never caught unaware.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "empath",
        name: "Empath",
        icon: "icons/skills/empath.jpg",
        description: "Specialists in the understanding of people, reading their physical and emotional tells.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Stealth
  /* -------------------------------------------- */
  "stealth": {
    name: "Stealth",
    category: "exp",
    icon: "icons/skills/stealth.jpg",
    attributes: ["dexterity", "willpower"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "infiltrator",
        name: "Infiltrator",
        icon: "icons/skills/infiltrator.jpg",
        description: "Specialists in moving unseen and silent to bypass danger or approach it unaware.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "safecracker",
        name: "Safecracker",
        icon: "icons/skills/safecracker.jpg",
        description: "Specialists in the cracking of mechanical locks and disarming mechanical traps.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "pickpocket",
        name: "Pickpocket",
        icon: "icons/skills/pickpocket.jpg",
        description: "Specialists in the acquisition of property by removing it from the possession of the less deserving.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Survival
  /* -------------------------------------------- */
  "survival": {
    name: "Survival",
    category: "exp",
    icon: "icons/skills/survival.jpg",
    attributes: ["constitution", "willpower"],
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
        description: "You know advanced survival skills. You can attempt to forage for food, water, and shelter without slowing your pace of travel. You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks. You are experienced with mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them a +2 situational bonus on any Skill Checks made by allies who accompany you."
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
        description: "Specialists in the knowledge, identification, and usage of naturally growing plants and reagents.",
        ranks: [
          {
            rank: 2,
            description: "You are knowledgeable in common herblore, are able to recognize useful herbs in the wild, and you may devote time during a rest to attempt a Potion Brewing crafting check with a +2 bonus using gathered ingredients."
          },
          {
            rank: 4,
            description: "You are knowledgeable in advanced herblore, are able to recognize both common and rare herbs in the wild. You are familiar with toxins and venom which can be extracted from plants and creatures. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +2 bonus."
          },
          {
            rank: 5,
            description: "You are a master of herblore and are able to recognize any useful herb, reagent, toxin, or venom in the wild. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +5 bonus. If successful, you produce double the normal quantity of output. You know forbidden arts of creating odorless and tasteless poisons using rare ingredients."
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Arcana
  /* -------------------------------------------- */
  "arcana": {
    name: "Arcana",
    category: "kno",
    icon: "icons/skills/arcana.jpg",
    attributes: ["intellect", "willpower"],
    ranks: [
      {
        rank: 1,
        description: "You have a functional comprehension of magical theory and you have developed an ability to perceive and read the weave of magic which flows around you. You are able to cast spells and you can recognize when another spellcaster is channeling magical energy."
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "You have an advanced comprehension of magical theory and you can more deeply read the weave of magic which flows around you. You are able to cast powerful spells and you can learn the final amount of damage dealt by your own spells after resistances and vulnerabilities have been applied."
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "You are a among the world's foremost arcane minds and the reading of the arcane weave has become second-nature to you. You can immediately identify any spell that you can also cast or you may attempt a Skill Check to identify a spell you do not know yourself without consuming any Action. You are able to cast the most powerful tier of magical spell and you can discern the value of a foe's Arcane Defense attribute after they have been engaged in a contest.",
        progression: true
      }
    ],
    paths: [
      {
        id: "diviner",
        name: "Diviner",
        icon: "icons/skills/diviner.jpg",
        description: "Specialists in understanding the nature of magic and reading the arcane aura of others.",
        ranks: [
          {
            rank: 2,
            description: "You gain a +2 situational bonus on Skill Checks to identify the nature of a spell or a magically imbued item."
          },
          {
            rank: 4,
            description: "You gain a +5 situational bonus on Skill Checks to identify the nature of a spell or magically imbued item. You gain a +2 situational bonus to your Spell Power when attempting to dispel an existing spell or counter an enemy spell-caster if you have identified the spell being used."
          },
          {
            rank: 5,
            description: "You can automatically identify the nature of a spell or a magically imbued item. You gain a +5 situational bonus to Spell Power when attempting to dispel an existing spell or counter an enemy spell-caster."
          }
        ]
      },
      {
        id: "elementalist",
        name: "Elementalist",
        icon: "icons/skills/elementalist.jpg",
        description: "Specialists in manipulating elemental energies to harness or ward their power.",
        ranks: [
          {
            rank: 2,
            description: "Select one elemental damage type as your Favored Element. You gain a Damage Resistance of 5 to that element and +2 to damage when rolling at least one damage die of this type."
          },
          {
            rank: 4,
            description: "Select a second elemental damage type as a Favored Element. You gain a Damage Resistance of 5 to both elements and +4 to damage when rolling at least one damage die of either type."
          },
          {
            rank: 5,
            description: "All elements are your Favored Element. You have Damage Resistance of 5 to all elements and +6 to damage when rolling at least one elemental damage die."
          }
        ]
      },
      {
        id: "enchanter",
        name: "Enchanter",
        icon: "icons/skills/enchanter.jpg",
        description: "Specialists in infusing arcane potency into physical objects to create items of great power.",
        ranks: [
          {
            rank: 2,
            description: "You know how to imbue minor magical effects into nonmagical items. You may attempt a crafting check to Enchant an item with the effects of a spell that you can cast."
          },
          {
            rank: 4,
            description: "You know how to imbue major magical effects into both magical and nonmagical items. You may attempt a crafting check to Enchant an item with the effects of a spell that you can cast. You may attempt to upgrade an existing magical item by adding a new effect if the item has available enchantment capacity."
          },
          {
            rank: 5,
            description: "You are a master of arcane infusion and you can imbue any spell which you can cast into an item. You are able to add new effects to an item if it has available enchantment capacity and you can remove existing magical effects from an item, freeing the item's enchantment capacity for further infusion."
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Religion
  /* -------------------------------------------- */
  "religion": {
    name: "Religion",
    category: "kno",
    icon: "icons/skills/religion.jpg",
    attributes: ["willpower", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "theologian",
        name: "Theologian",
        icon: "icons/skills/theologian.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "crusader",
        name: "Crusader",
        icon: "icons/skills/crusader.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "druid",
        name: "Druid",
        icon: "icons/skills/druid.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Investigation
  /* -------------------------------------------- */
  "investigation": {
    name: "Investigation",
    category: "kno",
    icon: "icons/skills/investigation.jpg",
    attributes: ["intellect", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "detective",
        name: "Detective",
        icon: "icons/skills/detective.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "spy",
        name: "Spy",
        icon: "icons/skills/spy.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "tinkerer",
        name: "Tinkerer",
        icon: "icons/skills/tinkerer.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Lore
  /* -------------------------------------------- */
  "lore": {
    name: "Lore",
    category: "kno",
    icon: "icons/skills/lore.jpg",
    attributes: ["intellect", "willpower"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "scholar",
        name: "Scholar",
        icon: "icons/skills/scholar.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "historian",
        name: "Historian",
        icon: "icons/skills/historian.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "storyteller",
        name: "Storyteller",
        icon: "icons/skills/storyteller.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Bartering
  /* -------------------------------------------- */
  "bartering": {
    name: "Bartering",
    category: "soc",
    icon: "icons/skills/bartering.jpg",
    attributes: ["intellect", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "antiquarian",
        name: "Antiquarian",
        icon: "icons/skills/antiquarian.jpg",
        description: "Specialists in the procurement and identification of ancient or eclectic items.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "caravaner",
        name: "Caravaner",
        icon: "icons/skills/caravaner.jpg",
        description: "Specialists in mercantilism and the transportation of goods.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "negotiator",
        name: "Negotiator",
        icon: "icons/skills/negotiator.jpg",
        description: "Specialists in haggling and compromise to arrange favorable terms in negotiation.",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Deception
  /* -------------------------------------------- */
  "deception": {
    name: "Deception",
    category: "soc",
    icon: "icons/skills/deception.jpg",
    attributes: ["intellect", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "You are able to lie with a straight face and without obvious tells. You have a basic understanding of manipulation and you understand what ploys or falsehoods are likely to be believed. You are able to craft false documents which do not rely upon specific handwriting or an identifying seal. You know the basics of disguise artistry, and are able to conceal your identity using a costume which you have prepared in advance."
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "You are an accomplished liar, able to invent plausible scenarios on the fly. You have an advanced understanding of manipulation and automatically succeed on any deception check with a DC of 15 or less. You are able to create false documents, including impersonating handwriting or an official seal if you have a sample to imitate. You are an accomplished disguise artist, and may attempt to conceal your identity by using an improvised costume using materials at hand."
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "You are a master manipulator - it is near impossible to tell whether you are telling the truth. You have a comprehensive understanding of how to manipulate others. You automatically succeed on any deception check with a DC of 25 or less. You are a master forger, able to create false documents including handwriting or official seals which are indistinguishable from the original. You are a peerless disguise artist and are able to exactly imitate the appearance of a  different person if you have the time and materials needed to prepare a disguise. You have a +5 Situational Bonus to Deception Checks which use an improvised disguise.",
        progression: true
      }
    ],
    paths: [
      {
        id: "grifter",
        name: "Grifter",
        icon: "icons/skills/grifter.jpg",
        description: "Specialists in distributing misleading information through subtlety and false confidence.",
        ranks: [
          {
            rank: 2,
            description: "You have a knack for predicting which falsehoods could be believable. If you attempt a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach at most once per social encounter."
          },
          {
            rank: 4,
            description: "You have expertise in predicting which falsehoods could be believable. If you attempt a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach at most twice per social encounter. You are able to remember any lies you have told within the past month."
          },
          {
            rank: 5,
            description: "You have mastery in predicting which falsehoods could be believable. If you are ever face a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach. You are able to remember any lies you have told within the past year. You are able to correctly conjecture what an official document would look like even if you have not seen it."
          }
        ]
      },
      {
        id: "illusionist",
        name: "Illusionist",
        icon: "icons/skills/illusionist.jpg",
        description: "Specialists in sensory illusions, generally mundane but occasionally arcane in nature.",
        ranks: [
          {
            rank: 2,
            description: "You are an expert in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer a -2 situational penalty for Skill Checks to avoid being misled by the distraction. You have a +2 situational bonus to recognize illusory magic created by other spellcasters."
          },
          {
            rank: 4,
            description: "You are a master of using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer a -5 situational penalty for Skill Checks to avoid being misled by the distraction. You have a +5 situational bonus to recognize illusory magic created by other spellcasters."
          },
          {
            rank: 5,
            description: "You are peerless in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others automatically fail their first attempt to avoid being misled by your distraction and suffer a -5 situational penalty for subsequent Skill Checks. You can immediately recognize the presence of illusory magic created by other spellcasters."
          }
        ]
      },
      {
        id: "mesmer",
        name: "Mesmer",
        icon: "icons/skills/mesmer.jpg",
        description: "Specialists in mind-altering alchemy and magic to transform enemies into allies.",
        ranks: [
          {
            rank: 2,
            description: "You have studied the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 minute of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. You have a +2 situational bonus to Willpower Defense against charm-like effects."
          },
          {
            rank: 4,
            description: "You have refined the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 3 rounds of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer a -2 situational bonus to their Willpower Defense against charm-like effects. You have a +5 situational bonus to Willpower Defense against charm-like effects."
          },
          {
            rank: 5,
            description: "You have perfected the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 round of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer a -5 situational bonus to their Willpower Defense against charm-like effects. You are immune to charm-like effects."
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Diplomacy
  /* -------------------------------------------- */
  "diplomacy": {
    name: "Diplomacy",
    category: "soc",
    icon: "icons/skills/diplomacy.jpg",
    attributes: ["willpower", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "p1",
        name: "N1",
        icon: "icons/skills/scholar.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "p2",
        name: "N2",
        icon: "icons/skills/historian.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "p3",
        name: "N3",
        icon: "icons/skills/storyteller.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Intimidation
  /* -------------------------------------------- */
  "intimidation": {
    name: "Intimidation",
    category: "soc",
    icon: "icons/skills/intimidation.jpg",
    attributes: ["strength", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "p1",
        name: "N1",
        icon: "icons/skills/p1.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "p2",
        name: "N2",
        icon: "icons/skills/p2.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "p3",
        name: "N3",
        icon: "icons/skills/p3.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Animal Handling
  /* -------------------------------------------- */
  "animal": {
    name: "Animal Handling",
    category: "trd",
    icon: "icons/skills/animal.jpg",
    attributes: ["strength", "willpower"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "knight",
        name: "Knight",
        icon: "icons/skills/knight.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "beastmaster",
        name: "Beastmaster",
        icon: "icons/skills/beastmaster.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "warden",
        name: "Warden",
        icon: "icons/skills/warden.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Craftsmanship
  /* -------------------------------------------- */
  "craftsmanship": {
    name: "Craftsmanship",
    category: "trd",
    icon: "icons/skills/craftsmanship.jpg",
    attributes: ["dexterity", "intellect"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "trademaster",
        name: "Trademaster",
        icon: "icons/skills/trademaster.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "artificer",
        name: "Artificer",
        icon: "icons/skills/artificer.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "runekeeper",
        name: "Runekeeper",
        icon: "icons/skills/runekeeper.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Medicine
  /* -------------------------------------------- */
  "medicine": {
    name: "Medicine",
    category: "trd",
    icon: "icons/skills/medicine.jpg",
    attributes: ["constitution", "intellect"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "apothecary",
        name: "Apothecary",
        icon: "icons/skills/apothecary.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "chirugeon",
        name: "Chirugeon",
        icon: "icons/skills/chirugeon.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "occultist",
        name: "Occultist",
        icon: "icons/skills/occultist.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  },

  /* -------------------------------------------- */
  /*  Performance
  /* -------------------------------------------- */
  "performance": {
    name: "Performance",
    category: "trd",
    icon: "icons/skills/performance.jpg",
    attributes: ["dexterity", "charisma"],
    ranks: [
      {
        rank: 1,
        description: "TODO"
      },
      {
        rank: 2,
        progression: true
      },
      {
        rank: 3,
        description: "TODO"
      },
      {
        rank: 4,
        progression: true
      },
      {
        rank: 5,
        description: "TODO",
        progression: true
      }
    ],
    paths: [
      {
        id: "musician",
        name: "Musician",
        icon: "icons/skills/musician.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "artist",
        name: "Artist",
        icon: "icons/skills/artist.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      },
      {
        id: "athlete",
        name: "Athlete",
        icon: "icons/skills/athlete.jpg",
        description: "TODO",
        ranks: [
          {
            rank: 2,
            description: "TODO"},
          {
            rank: 4,
            description: "TODO"
          },
          {
            rank: 5,
            description: "TODO"
          }
        ]
      }
    ]
  }
};


/**
 * Combine and configure Skills data to create an official record of skill progression throughout the system
 * Freeze the resulting object so it cannot be modified downstream
 * @param {Object} skills
 * @return {Object}
 */
export function prepareSkillConfig(skills) {
  for ( let [id, skill] of Object.entries(skills.skills) ) {

    // Skill id, icon, and category
    skill.skillId = id;
    skill.icon = `systems/${SYSTEM_ID}/${skill.icon}`;
    skill.category = skills.categories[skill.category];

    // Skill ranks
    const ranks = duplicate(skills.ranks);
    skill.ranks.forEach(r => mergeObject(ranks[r.rank], r));
    skill.ranks = ranks;

    // Skill progression paths
    skill.paths.forEach(p => p.icon = `systems/${SYSTEM_ID}/${p.icon}`);
    skill.paths.unshift(duplicate(skills.noPath));
    skill.paths[0].icon = `systems/${SYSTEM_ID}/${skill.category.noPathIcon}`;
  }

  // Freeze the skills config so it cannot be modified
  Object.freeze(skills);
  return skills;
}