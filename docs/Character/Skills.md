[Back to Home](../../README.md)

# Character Skills

Skills represent the social, exploration, puzzle-solving, and crafting abilities of a character. Skills describe how talented your character is at accomplishing certain tasks. Each skill has six tiers ranging from Untrained to Grandmaster which reflect the degree of expertise the hero has in that area. The skill tiers are generally described as follows, each yielding the following Skill Bonus and Skill Point cost.

| Rank | Rank Name   | Rank Description                                             | Rank Modifier | Point Cost |
| ---- | ----------- | ------------------------------------------------------------ | ------------- | ---------- |
| 0    | Untrained   | You have no formal training in this area, any success you have is due to luck. | -4            | 0          |
| 1    | Novice      | You have been provided basic instruction or acquired practical experience in the basics of this skill. | +2            | 1          |
| 2    | Apprentice  | You have practiced and honed your skills to a strong functional degree. | +4            | 1          |
| 3    | Journeyman  | You are a subject matter expert in this area.                | +6            | 2          |
| 4    | Master      | You are a true master of this skill and its techniques.      | +10           | 3          |
| 5    | Grandmaster | You are peerless in your mastery of this area.               | +12           | 5          |

Each skill relies upon two Attribute scores which, in conjunction with your Skill rank modifier determine your **Skill Bonus** for that particular skill which is defined as:

```
Skill Bonus = 0.5 * (Attribute1 + Attribute2) + Skill Rank Modifier + Situational Bonus
```

> A note on statistics and check difficulty. The following table represents the probabilities of success against different recommended check difficulty targets without the presence of any Situational Bonus applied.

| R    | A1   | A2   | SB   | Easy (15) | Moderate (20) | Challenging (25) | Difficult (30) | Formidable (35) | Impossible (45) |
| ---- | ---- | ---- | ---- | --------- | ------------- | ---------------- | -------------- | --------------- | --------------- |
| 1    | 4    | 4    | 6    | 89%       | 50%           | 11%              | 1%             | 0%              | 0%              |
| 2    | 6    | 6    | 10   | 99%       | 84%           | 41%              | 7%             | 0%              | 0%              |
| 3    | 8    | 8    | 14   | 100%      | 98%           | 77%              | 31%            | 4%              | 0%              |
| 4    | 10   | 10   | 20   | 100%      | 100%          | 99%              | 84%            | 40%             | 0%              |
| 5    | 12   | 12   | 24   | 100%      | 100%          | 100%             | 98%            | 76%             | 3%              |

> The maximum theoretical Skill Check roll for a hero with two Attribute scores of 12, Grandmaster rank in the Skill, and a +5 Situational Bonus is a 53, which provides a 31.64% chance of success against an "Impossible" tier target of 45.

## Skill Advancement and Progression Paths

To advance your Skills, you must invest a number of Skill Points as specified by the Skill ranks table above. You gain 2 Skill Points each time your character gains a Level.

When you progress a Skill to the Apprentice tier, you must choose between three progression paths which further specialize your investment in the skill. The three paths are mutually exclusive, and your progression path may not be changed without first reducing the specialization tier in a skill back to the Novice tier.

#### Optional Rule - Learned Mastery

An optional rule which your Game Master may elect to employ within your game is that Mastery of a Skill entails a prerequisite of learning from another who is also a Master or Grandmaster of that skill. This requires your hero to befriend, persuade, or bribe a Master to pass along his or her teachings before your character is able to purchase the Master rank of a Skill. The Game Master may choose whether to apply this rule at the Master or Grand-Master tier (or at both tiers).

#### Skill Respecialization

If you advance an entire character level or one year of time without using a certain skill, you may choose to reduce your level of specialization in that skill by one tier, returning the corresponding number of skill points into your available pool. From a narrative perspective, this represents the process of atrophy by which certain skills might lose their sharpness over time. Mechanically, this offers players with a means of reshaping their skill allocation over time should they desire to do so.

## Skill List

The sixteen skills are listed below, with descriptions of the skill itself. Each skill also has examples of what sort of tasks a character could accomplish through the use of that skill. Upgrades are conferred when progressing to certain ranks in each skill, which are also listed below. Finally, the three specializations for each skill are described, with their own benefits at certain ranks.

> The "tasks" listed under each skill are the proposed, typical usage of the skill, but should not be interpreted as a comprehensive list of the skill's applications. A skill maybe used to perform other tasks as well, at the Game Master's discretion.

### Skill Template


#### Skill Tasks
**Verb A.** Example situation which uses verb A.<br>
**Verb B.** Example situation which uses verb A.

| Rank | Template Skill Progression       |
| ---- | ---------------------------------- |
| 0    | You have no training in the skill. Some general tasks that require some knowledge or experience may automatically fail. |
| 1    | You have some training in the skill. The aforementioned general tasks no longer automatically fail. |
| 2    | You have substantial practice in the skill. Some checks to perform certain simple or straightforward tasks may be performed with Reliability, or be performed with +1 or +2 Boons. |
| 3    | **Choose a progression path.** |
| 4    | You have mastered the skill. Certain limitations or penalties incurred when performing certain tasks are nullified. Certain tasks that would normally automatically fail on principle may now allow for a check. Certain tasks may be performed with +3 or +4 Boons or Reliability. |
| 5    | **Complete your progression path.** |

| Path (Rank) | Path Skill Progression |
| ----------- | ---------------------- |
| **Path A**  | Path A description. |
| Rank 3      | You have uncovered some special knowledge, or accrued specialized experience. Certain other actions may be possible, easier, quicker, or can be performed with Reliability, or +1/+2 Boons, or provide additional bonuses when the check is successful. |
| Rank 5      | You have mastered your craft and uncovered knowledge and techniques that make you peerless. Some actions may no longer require a check, be performed incredibly quick, or provide additional bonuses when the check is successful. |
| **Path B**  | Path B description. |
| Rank 3      | " " " |
| Rank 5      | " " " |

## Exploration Skills

Exploration skills are used most often when dealing with the environment a character finds themselves in. The four skills in this category are Acrobatics, Perception, Stealth, and Survival.

### Acrobatics

Acrobatics relates to one's training in agility and athletics. Ranks in this skill make traversing the environment easier, and those highly proficient in Acrobatics likely have greater balance, spatial awareness, and motor coordination.

#### Example Uses

**Climb.** You can climb vertically ascending surfaces at 1/2 your normal Stride as a part of the Stride action. Difficult surfaces, or attempts to climb an easier surface more quickly, may require an Acrobatics check to scale successfully.<br>
**Leap.** You can perform an Acrobatics check to move farther during a leap than your base Horizontal or Vertical leap distances.<br>
**Tumble.** When you fall and are not restrained or otherwise immobilized, you can perform an Acrobatics check as Standard Action to land safely.<br>
**Escape.** If you are grappled or restrained, you can attempt to slip free. Breaking a source of the Grappled condition is a Standard Action, while freeing yourself from a source of the Restrained condition is a Lengthy Action.<br>
**Squeeze.** You can force your limbs or entire body into tight spaces by performing an Acrobatics check as an action. If you would move while remaining in this tight space, you move at half movement.<br>
**Balance.** When standing on narrow footholds, along edges, or upon slippery terrain, you may be required to perform an Acrobatics check to maintain balance.<br>

| Rank | Acrobatics Skill Progression       |
| ---- | ---------------------------------- |
| 0    | You have no real practice performing athletic maneuvers. You can make attempts to run, jump, and climb, but cannot swim normally without risking drowning. You must perform Skill Checks to climb, even on surfaces with innate handholds such as ladders, or with the assistance of climbing tools such as rope. |
| 1    | You have accrued some experience in traversing your surroundings. You have Reliability on Skill Checks made to swim in calm waters, or to climb ladders and other surfaces with innate handholds at 1/2 speed. You have a basic understanding of how to tumble safely from a fall. |
| 2    | **Choose a progression path.**     |
| 3    | You know some advanced acrobatic maneuvers, and have developed a keen sense of balance. You have +1 Boon on Skill Checks made to Tumble after a fall. |
| 4    | **Upgrade your progression path.** |
| 5    | You have perfected your sense of balance, and are peerless in your motor coordination and ability to carry out complicated maneuvers. You have +3 Boons on Skill Checks made to Tumble after a fall. **Complete your progression path.** |

> TODO: Redraft paths - Gymnast needs a replacement
1. **Gymnast** - Specialists in acrobatic maneuvers which escape harm or tumble safely from great heights.
2. **Traceur** - Specialists in rapidly traversing obstacles and scaling surfaces whether they be natural or urban.
3. **Dancer** - Specialists in the art of dance, from the ballroom to the mesmerizing contortions of a street performer.

### Perception

Perception relates to general awareness, most often in relation to one's physical surroundings. To a lesser extent, it is used to observe people's social behavior as well. Those with training in Perception hone their senses and are expert observationists, noticing details others might miss.

#### Example Uses

**Detect.** You can quickly scan your surroundings as a free action, focusing on your senses to detect an object or some other physical phenomena.<br>
**Search.** You can perform a dedicated search for an object or some other physical phenomena, investigating your surroundings over a minute or more.<br>
**Sense Intent.** During social interactions, you can perform a Perception check to understand the motives of a creature, intuit its emotions, or determine if it is lying.<br>

| Rank | Perception Skill Progression       |
| ---- | ---------------------------------- |
| 0    | You have spent no real effort in honing your observational skills. You can perform Skill Checks to detect threats as an action. |
| 1    | You have acquired knowledge in how to find things, and have developed a basic ability to tune to specific senses. You can perform checks to detect hidden threats as an action. When you perform a lengthy action to search for a particular object you have seen before, or try to sense a particular sight, sound, or scent you know you have sensed before, you gain +1 Boon to your roll. |
| 5    | You can perform checks to detect hidden threats as a free action once per round, and certain natural environmental effects, such as fog, do not reduce your ability to see or hear. You can hear sounds with perfect clarity through doors and thin walls, and have +3 Boons to Spell Defense against illusion magic. |

1. **Scout** - Specialists in discovering hidden paths and threats, a Scout is never caught unaware.
2. **Detective** - Specialists in piecing their environment together, and making deductions from their surroundings.
3. **Empath** - Specialists in the understanding of people, reading their physical and emotional tells.

### Stealth

Stealth is used to advance unnoticed and gain access to areas which are otherwise inaccessible. Stealth adepts can develop expertise in infiltration, lockpicking, or thievery. Stealth offers three choices of progression paths.

#### Example Uses

**Hide.** You can attempt to find a hiding spot nearby and remain hidden, performing a blind Stealth check for your GM.<br>
**Sneak.** You can pass through an area unnoticed, moving a quarter of your normal Stride.<br>
**Sleight of Hand.** You can perform Stealth checks to do a physical action with subtlety, such as removing an item unnoticed from a person or place, smuggle an object, or plant one on another person.<br>

| Rank | Stealth Skill Progression          |
| ---- | ---------------------------------- |
| 0    | You have next to no practice sneaking. You can perform checks to hide, but no longer hide once you move. When you sneak, you move at a quarter of your normal Stride. |
| 1    | You have a basic understanding of how to avoid being noticed, and how to move subtly and quietly. If you move while hiding, checks must be made to remain hidden. Light armor no longer imposes a penalty on your Stealth checks made to move silently. |
| 5    | You are able to perform a hide check as a free action once per round, and may perform hide checks with Reliability as long as you do not use your movement. Hiding in broad daylight no longer imposes penalties on your Stealth checks. You can use your full stride while sneaking without penalty. Wearing light or medium armor imposes no penalty to your Stealth checks. |

1. **Infiltrator** - Specialists in moving unseen and silent to bypass danger or approach it unaware.
2. **Safecracker** - Specialists in the cracking of mechanical locks and disarming mechanical traps.
3. **Pickpocket** - Specialists in the acquisition of property by removing it from the possession of the less deserving.

### Survival

Survival represents your ability to operate as a self-sufficient explorer in challenging natural environments, understanding their terrain, flora, fauna, and hazards. Survival adepts can develop expertise in dealing with a subset of specific biomes, creature types, or natural resources.

#### Example Uses

**Navigate.** Outdoors, you can perform a Survival check to navigate through the use of the sun, clouds, stars, or other natural phenomena.<br>
**Track.** When finding tracks, you can attempt to follow the tracks, identify what might have left them, how many sets of tracks there are, or how long ago they were made.<br>
**Forage.** You can attempt to forage for food, catch small game, or field dress a hunted animal.<br>
**Identify.** You can determine if foraged plants are poisonous, or discern various environmental hazards, such as quicksand, or signs of the passage of a dangerous beast.<br>

| Rank | Survival Skill Progression                                   |
| ---- | ------------------------------------------------------------ |
| 0    | You have little or no experience in the wilderness. You cannot navigate through wilderness without clear directions or a guide. You do not know how to start fires with mundane materials, nor where nearby food or water may be. If you find food, you are unable to determine if it's safe to eat or drink. If you find tracks, you cannot determine what creature made them. |
| 1    | You know basic survival skills. You are able to start fires with flint and tinder, you know where you can try foraging for food and water in environments you are familiar with, and you can recognize common environmental hazards. You are able to recognize the tracks of creatures which you are familiar with if the tracks are discovered. |
| 2    | **Choose a progression path.**                               |
| 3    | You know advanced survival skills. You can attempt to forage for food, water, and shelter without slowing your pace of travel. You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks. You are experienced with mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them +1 Boon on any Skill Checks made by allies who accompany you. |
| 4    | **Upgrade your progression path.**                           |
| 5    | You are a paragon of wilderness survival and self-sufficiency. You can reliably forage for food, water, and shelter in even inhospitable or foreign environments. You are an expert tracker, once you find the tracks of a creature it cannot elude you by any ordinary means. You are a master of mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting +3 Boons on any Skill Checks made by allies who accompany you.<br />**Complete your progression path.** |

The progression paths available to the Survival skill are listed below.

| Path (Rank)   | Progression Path Benefits                                    |
| ------------- | ------------------------------------------------------------ |
| **Explorer**  | Specialists in exploration and navigation of challenging environmental obstacles. |
| Rank 2        | Select one environmental biome as Favored Terrain, You gain +1 Boon to Skill Checks regarding the exploration or knowledge of that environment. You can guide groups of allies through such obstacles, granting +1 Boon on any Skill Checks made by allies who accompany you. |
| Rank 4        | Select two environmental biomes as Favored Terrain, You gain +1 Boon to Skill Checks made regarding the exploration or knowledge of those environments. |
| Rank 5        | Select three environmental biomes as Favored Terrain. You gain +3 Boons to Skill Checks made regarding the exploration or knowledge of those environments and +1 Boon for non-favored biomes. |
| **Hunter**    | Specialists in the tracking and hunting of creatures.        |
| Rank 2        | Select one naturally occurring creature type as a Favored Prey. You gain +1 Boon to Spell Power and Attack Rolls against this type of creature. |
| Rank 4        | Select two naturally occurring creature types as Favored Prey. You gain +1 Boon to Spell Power and Attack Rolls against creatures of those types. |
| Rank 5        | Select three naturally occurring creature types as Favored Prey. You gain +3 Boons to Spell Power and Attack Rolls against creatures of those types and you gain +1 Boon when attacking non-favored naturally occurring creatures. |
| **Herbalist** | Specialists in the knowledge, identification, and usage of naturally growing plants and reagents. |
| Rank 2        | You are knowledgeable in common herblore, are able to recognize useful herbs in the wild, and you may devote time during a rest to attempt a Potion Brewing crafting check with +1 Boon using gathered ingredients. |
| Rank 4        | You are knowledgeable in advanced herblore, are able to recognize both common and rare herbs in the wild. You are familiar with toxins and venom which can be extracted from plants and creatures. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with +1 Boon. |
| Rank 5        | You are a master of herblore and are able to recognize any useful herb, reagent, toxin, or venom in the wild. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with +3 Boons. If successful, you produce double the normal quantity of output. You know forbidden arts of creating odorless and tasteless poisons using rare ingredients. |

## Knowledge Skills

### Arcana

Arcana deals with the properties and perception of the weave of magical energies. This current of arcane potentia can be studied, manipulated, and harnessed by those with sufficient knowledge and willpower. Skill in Arcana represents your understanding of the theory and application of magic. Learned arcanists can develop expertise in the reading the arcane weave, manipulating elemental energies, or infusing arcane potentia into physical objects.

#### Example Uses

**Detect Magic.** You can perform an Arcana check to determine if an item bears magic, and what spell or enchantment the object is affected by, if any.<br>
**Identify Spell.** When you see a spell being cast, you can perform an Arcana check to determine what the spell is, learning which rune and/or gesture was used in its casting. You must have some insight on what components are used to cast a spell before you can properly counter it.<br>
**Recall.** You can attempt to recall general wisdom, or relevant information, about magic itself.<br>

| Rank | Arcana Skill Progression                                     |
| ---- | ------------------------------------------------------------ |
| 0    | You have next to no understanding of magic. If you witness the casting of a spell, or some other magic, you cannot determine the nature of the magic other than its immediately apparent effects. You cannot ascertain whether an object or creature bears magic. |
| 1    | You have a functional comprehension of magical theory and you have developed an ability to perceive and read the weave of magic which flows around you. You are able to cast spells and you can recognize when a creature is channeling magical energy, such as when casting a spell. You may spend 1 AP to attempt a Skill Check to identify the nature of a spell being cast. |
| 2    | You have developed a decent comprehension of magical theory and you can more deeply read the weave of magic which flows around you. You are able to cast powerful spells and can recognize when a creature is channeling magical energy, such as when casting a spell. You may spend 1 AP to attempt a Skill Check to identify the nature of a spell being cast. You can learn the final amount of damage dealt by your own spells after resistances and vulnerabilities have been applied. |
| 3    | **Choose a progression path.** |
| 4    | You are among the world's foremost arcane minds and the reading of the arcane weave has become second-nature to you. You may attempt a Skill Check without consuming any AP to identify the nature of a spell being cast, and automatically succeed on the check if you are able to cast the spell yourself. You are able to cast some of the most powerful magical spells and you can discern the value of a foe's Arcane Defense attribute after they have been engaged in a contest. |
| 5    | **Complete your progression path.** |

The progression paths available to the Arcana skill are listed below.

| Path (Rank)      | Progression Path Benefits                                    |
| ---------------- | ------------------------------------------------------------ |
| **Diviner**      | Specialists in understanding the nature of magic and reading the arcane aura of others. |
| Rank 3           | You have learned to focus your senses towards magic around you. When you cast a Divination-type spell, you are able to add the Extend or Quicken Metamagics to the casting without spending additional Focus, even if you do not otherwise know those inflections. You gain +1 Boon on Skill Checks to identify the nature of a spell or a magically imbued item.  |
| Rank 5           | You have mastered the ability to divine from unseen magical forces; reading the arcane weave feels like a natural sixth sense to you. You can immediately and automatically identify the nature of a spell or a magically imbued item. When you cast a Divination-type spell, you are able to add the Extend, Quicken, or Empower Metamagics to the casting without spending additional Focus, even if you do not otherwise know those inflections. You gain +2 Boons to Spell Power when attempting to dispel an existing spell or counter an enemy spellcaster. |
| **Elementalist** | Specialists in manipulating elemental energies to harness or ward their power. |
| Rank 3           | Select two elemental damage types as your Favored Elements. You gain a Damage Resistance of 5 to both elements and +3 to damage when rolling at least one damage die of this type. |
| Rank 5           | All elements are your Favored Element. You have Damage Resistance of 5 to all elements and +6 to damage when rolling at least one elemental damage die. |
| **Enchanter**    | Specialists in infusing arcane potency into physical objects to create items of great power. |
| Rank 3           | You are especially familiar with instilling power into items. You know how to imbue major magical effects into both magical and non-magical items. You may attempt a crafting check to Enchant an item with the effects of a spell that you can cast. You may attempt to upgrade an existing magical item by adding a new effect if the item has available enchantment capacity. |
| Rank 5           | You are a master of arcane infusion, and can imbue any spell which you can cast into an item. You are able to add new effects to an item if it has available enchantment capacity and you can remove existing magical effects from an item, freeing the item's enchantment capacity for further infusion. |

> Note: Arcana paths will need revision once the magic system is more thoroughly developed.

### Lore

Lore relates to the breadth of one's general knowledge, ranging from information on cultures, to world history, geography, politics, or even fables and myths. Ranks in the Lore skill correspond with a more comprehensive understanding of the world and those within it. A true master lorekeeper is a polymath of all history, mythos, and even world's greatest-kept secrets.

#### Example Uses

**Recall.** A character can attempt to recall general lore or history they may know about any particular subject. This is often retroactive - a character succeeding on such a Lore check could be seen as having always known the information, but remembering it just in time.<br>
**Deduce.** When information is already at hand, you may use your knowledge of the world to attempt to predict a future event, or deduce something that was previously unknown.<br>
**Study.** Poring over records or other written documents may rely on Lore checks to determine your ability to quickly and accurately comprehend the recorded information.

| Rank | Lore Skill Progression                                     |
| ---- | ------------------------------------------------------------ |
| 0    | You have little to no worldly knowledge; your understanding of history and world events is likely limited to your hometown. A critical failure on a Lore check often results in misremembering a detail to be the exact opposite of the truth, or wildly different than conventional belief. |
| 1    | You have learned some general details about the world, and have started honing your insight regarding local history and current events. You likely know a good few sayings and idiomatic expressions used by cultures you are generally familiar with. When spending downtime in a settlement, you learn of common sources of knowledge there, such as libraries or notable lorekeepers who reside there. Critically failing a Lore check still often results in vastly misremembering details you attempted to recall. |
| 2    | Your education in the world's lore has garnered you a wider variety of information about the world and its people. You have Reliability on checks made to recall general details about widespread world events, such as wars, political upheavals, natural disasters, and celestial events. When spending downtime in a settlement, you learn of common sources of knowledge there, such as libraries or notable lorekeepers who reside there. Critically failing a Lore check no longer results in you vastly misremembering an important detail you attempted to recall. |
| 3    | **Choose a progression path.** |
| 4    | You have amassed a staggering level of knowledge about the world, detailing information on geography, history, politics, folklore, mythology, and more. You know the sitting authority of any settlement or region you have visited. You know of common sources of knowledge, such as local libraries or notable lorekeepers, in any settlement you have visited. You have Reliability on all Lore checks made to recall information, and critically failing a Lore check does not result in you incorrectly remembering an important detail. |
| 5    | **Complete your progression path.** |

| Path (Rank)      | Progression Path Benefits                                    |
| ---------------- | ------------------------------------------------------------ |
| **Historian**    | Specialists in keeping history, and knowing of the cultures of the world. |
| Rank 3           | Your mind is a haven for recorded history, and you readily understand the events that shaped the past of many different cultures. When you gain this rank, choose one language you have heard and seen in writing before. You can read, write, and speak this language fluently. You have +1 Boon on any check to recall information about any written or otherwise formally-recorded lore. You can study any text twice as fast, and have +2 Boons on checks to accurately understand such documents. |
| Rank 5           | You have a near-universal compendious level of understanding of the world's recorded history. In addition to fluency in one previous language, you readily understand all other languages, written or otherwise; you can speak any language proficiently enough to be understood by its fluent speakers, provided you can physically utter the sounds of the language. You have +3 Boons on any check to recall information about any written or otherwise formally-recorded lore. You can study any text five times as fast, and have +4 Boons on checks to accurately understand such documents. |
| **Sage**         | Specialists in discovering the truth, wherever it may lie. |
| Rank 3           | Your curiousity and eagerness for knowledge about the world at large grants you the ability to always know where and how to uncover information. You have +1 Boon on checks to recall unwritten lore, or information that is otherwise obscure. You have +2 Boons on checks made to crack ciphers, solve riddles, or translate esoteric languages, such as hieroglyphs. If you ever fail a check to recall information, you often have a clear idea of one person, place, or object that could possess the answers you seek. |
| Rank 5           | You have mastered the art of uncovering secrets and unearthing forgotten lore. You have +3 Boons on checks ot recall unwritten lore, or information that is otherwise obscure. You have +4 Boons on checks made to crack ciphers, solve riddles, or translate esoteric languages, such as hieroglyphs. If you ever fail a check to recall information, you know of at least one person, place, or object that possesses the answers you seek. |
| **Storyteller**  | Specialists in keeping, studying, and sharing legendary tales. |
| Rank 3           | TBD |
| Rank 5           | TBD |

### Religion

Religion deals with faith, divine beings and events, and understanding the religious groups within the world. Part of this understanding lies in cultural insight, and knowledge on various faiths and those who practice them, while another part is rooted in the metaphysical effect divine forces have in the setting. Ranks in this skill reflect your ability to recall historical information about various religions, conduct religious rites or ceremonies, or understand the deeper meaning of certain reilgious philosophies. Those accomplished in the Religion skill can identify followers of a religion, perform holy (or unholy) rituals, or perhaps even receive insight from their gods through divine intervention.

#### Creeds

The rank benefits for Religion often mention Creeds to explain their benefits. A Creed refers to any particular faith in the setting, such as a sect, cult, circle, or other denomination or religious faction. A Creed may be closely aligned with, or vehemently opposed to, any other Creeds. A Creed may worship specific beings, such as a deity, or something more abstract, such as the forces of nature. The Game Master should have a list of Creeds present in the setting.

#### Example Uses

**Recall.** You can attempt to recall information about a Creed, or those who follow it. This includes understanding symbology, cultural significance, or philosophical sentiments associated with that Creed.<br>
**Conduct.** Religion checks are often required when conducting religious rites in a way which is consistent with their underlying doctrine.<br>
**Intuit.** Religion checks can also be performed to understand the deeper meaning of a religious custom, comprehend the mandates of a deity, or divine the significance of a religious event or figure.<br>
**Recognize.** You can use Religion checks to recognize divine influences, supernatural forces, or extraordinary events which are not explained by physical or arcane theory.

| Rank | Religion Skill Progression         |
| ---- | ---------------------------------- |
| 0    | In the eyes of the faithful, you are unenlightened. You likely only know a few details about your own religion, if you follow one, or some widely-known religions. |
| 1    | You have acquired a basic understanding of your own religion. Choose a Creed in your setting, with GM approval. You know of the symbols used to signify the Creed, and, if they exist, you know of the symbols that are antithetical or "blasphemous" to it. You know what is generally encouraged or forbidden by your Creed, and the places or religious sites normally associated with it. |
| 2    | You have developed greater insight into your own religion, as well as others related to it. You know of the symbology, practices, and taboos of your Creed, as well as its associated locations or religious sites, as well as some deeper insight into your religious philosophy. You have Reliability on Skill Checks made to discern how closely-aligned another religion is to your own. |
| 3    | **Choose a progression path.** |
| 4    | Your understanding of religion transcends mere encyclopedic knowledge; you have a holistic understanding of faith and dealings with the divine. You are capable of conducting, or writing anew, religious doctrine associated with your Creed. All faiths are an open book to you, and your attunement to the divine forces of the world allows you to sense or even predict their presence. You automatically succeed on checks to recall information about your own Creed, and have Reliability on checks made to recall information about other religions. |
| 5    | **Complete your progression path.** |

| Path (Rank)      | Progression Path Benefits                                    |
| ---------------- | ------------------------------------------------------------ |
| **Theologian** | Specialists in understanding a wide array of religious beliefs and the history of the divine. |
| Rank 3 | Your breadth of religious knowledge spans to sects and philosophies other than the ones you personally subscribe to. You have +1 Boon on all checks made to recall information on any pantheon or Creed within the world. If you know of a deity or other religious concept, you also know which Creeds are aligned or associated with it. You have +2 Boons on attempts to identify a religious symbol. |
| Rank 5 | Your mastery as a religious historian is all-encompassing and gives you great insight into many different peoples, their beliefs, and their gods. You have +3 Boons on all checks made to recall information on any pantheon or Creed within the world. If you know of a deity or other religious concept, you also know which Creeds are aligned or associated with it. You immediately recognize any religious symbol and its significance. |
| **Occultist** | Specialists in the practices of a certain faith, from its beliefs to its rites. |
| Rank 3 | Your dedication to your faith empowers your ability to carry out the will of the divine forces you follow. Though you understand all common practices and rites observed by your Creed, you have +2 Boons on checks made to recall more obscure information or more esoteric rites related to your Creed. You can automatically identify a member of your Creed by sight, and know where and when its members may reside in any given location. You have +2 Boons on checks made to socially interact with any member of your Creed. |
| Rank 5 | You have uncovered the deepest secrets of your Creed, and have earned a position among the highest ranks of your religious order. You may be privy to special information maintained by your Creed, or directly enlightened by the divine favor you have garnered. You can perform all but the most obscure rites of your Creed with ease, and know all general knowledge related to your Creed and the way it conducts itself. You can automatically identify a member of your creed by sight, and know where members of your Creed reside in any given location. You have +4 Boons on checks made to socially interact with any member of your Creed. |
| **Hierophant** | Specialists in spreading the truth, and illuminating others through their faith. |
| Rank 3 | You have a talent for bringing the wisdom of your faith to the masses, and carrying your religious code across the world with you. You have +2 Boons on any attempt to discern how a given person may feel about your faith, or how to sway others to adhere to your Creed's doctrine. You have an attuned sense for the divine; if you witness a supernatural event, you have Reliability on attempts to determine its divine source, if any. You know the direction to the nearest source of divine influence within half a mile, and whether its source is friendly, indifferent, or hostile to your Creed. |
| Rank 5 | Your deep instinctual insight of your faith is prophetic, and you know how to enlighten those around you to the awesome power of your faith. You have +4 Boons on any attempt to discern how a given person may feel about your faith, or how to sway others to adhere to your Creed's doctrine. You can feel the divine's influence on the world like a sixth sense; if you witness a supernatural event, you immediately recognize its divine source, if any. You know the direction to any source of divine influence within a mile, and whether its source is friendly, indifferent, or hostile to your Creed. |

### Science

Knowledge of Science corresponds to knowledge of the natural world. Improvement in this skill reflects your broadening understanding of the natural laws that govern the world, as well as your ability to apply that knowledge in useful ways. Tasks requiring knowledge of physics, chemistry, mechanics, and engineering can all use Science skill checks to determine their outcome.

#### Example Uses

**Recall.** You can perform a Science check to remember details about a scientifically observed, theorized, or proven phenomenon.<br>
**Theorize.** You can come to new conclusions using information you have already acquired, in regards to natural sciences such as geology and chemistry. This includes predicting the properties or effects of a substance, or understanding where or how an object will move.<br>
**Discern.** You can examine a physical object or phenomenon to determine obscure patterns, an object's purpose or function, or why an object behaves a certain way.<br>

| Rank | Science Skill Progression          |
| ---- | ---------------------------------- |
| 0    | You have little to no scientific understanding of the world. If there are natural laws governing the world, you do not know much about them. You can perform Science checks to attempt to understand, recall, or deduce certain ideas. If you have not yet learned of a common natural law or theory, you automatically fail checks made to deduce it on your own. |
| 1    | You have some understanding of natural laws, and of basic physical properties of objects, such as momentum and inertia. Any scientific rules or laws you have not yet learned can be deduced with checks (usually as a Lengthy Action). |
| 2    | You have a broader understanding of natural philosophy, and have developed a decent understanding of the physical properties of objects. Any scientific rules or laws you have not yet learned can be deduced with checks (usually as a Lengthy Action). You have Reliability on checks made to understand the function or purpose of non-magical tools or objects. |
| 3    | **Choose a progression path.** |
| 4    | You have a superior level of understanding of sciences and natural philosophy. You can perfectly recall any scientific theory, law, or concept you have previously learned. Any scientific rules or laws you have not yet learned can be deduced with checks (usually as a Lengthy Action). You can quickly surmise the function or purpose of non-magical tools or objects. You immediately recognize if a phenomenon violates conventional scientific laws and is therefore supernatural. |
| 5    | **Complete your progression path.** |

The progression paths available to the Science skill are listed below.

| Path (Rank)      | Progression Path Benefits                                    |
| ---------------- | ------------------------------------------------------------ |
| **Physiker** | Specialists in the everpresent laws of the natural world. |
| Rank 3 | Your sharp knowledge of physics lets you quickly understand your surroundings. At a glance, you can automatically determine when a creature is going to land after a fall, or approximately how heavy an object is. You have +2 Boons on checks to determine other physical properties of objects, such as volume. You have +2 Boons on checks made to exploit environmental hazards, or identify structural weaknesses in large objects such as buildings and vehicles. If you notice a structural weakness, you and your allies deal +2 damage on all attacks against the object until either the object is destroyed, or the structural weakness is somehow removed. |
| Rank 5 | Your studious knowledge of physics gives you an almost omniscient understanding of your surroundings. At a glance, you can automatically determine when a creature is going to land after a fall, or how heavy an object is. If you notice a creature moving, you automatically know any movement speeds it has. You have +4 Boons on checks made to exploit environmental hazards, or identify structural weaknesses in large objects such as buildings and vehicles. If you notice a structural weakness, you and your allies deal +4 damage on all attacks against the object until either the object is destroyed, or the structural weakness is somehow removed. |
| **Alchemist** | Specialists in harnessing substances to create stunning effects. |
| Rank 3 | Your comprehension of chemistry helps you reliably create powerful chemical reactions. You have +2 Boons on checks made to identify the nature of a powder, liquid, gas, or similar unknown substance, and on checks to determine what sort of reaction the mixing of two substances will make, if any. You have +2 Boons on checks made to craft a potion or other alchemical product, and can do so in half the time. |
| Rank 5 | Your breadth of knowledge has allowed you to uncover the deepest secrets of alchemy. You have +4 Boons on checks made to identify the nature of a powder, liquid, gas, or similar unknown substance, and on checks to determine what sort of reaction the mixing of two substances will make, if any. You have +4 Boons on checks made to craft a potion or other alchemical product, and can do so in half the time. |
| **Tinkerer** | Specialists in the workings of intricate, manufactured objects. |
| Rank 3 | You have a knack for engineering and working with non-magical tools or manufactured objects with moving parts, such as machines or traps. You gain +1 Boon on all checks made to operate, dismantle, or understand any such device. If you are familiar with a manufactured device, you know what sort of materials or tools you would need to create it. You gain +2 Boons to checks to create a tool or device, whether it is conventionally made or an improvised version. |
| Rank 5 | You have unmatched finesse in dealings with non-magical tools or manufactured objects with moving parts, such as machines or traps. You gain +2 Boons on all checks made to operate, dismantle, or understand any such device. If you are familiar with a manufactured device, you know what sort of materials or tools you would need to create it. You gain +4 Boons to checks to create a device, whether it is conventionally made or an improvised version. Devices you create are harder to dismantle; anyone else has +2 Banes on their checks to dismantle your manufactured objects. |


## Social Skills

> Social skills are called such because they involve social interactions between two or more characters - as such, when a check is made, it can often be a part of a contest, where each participant rolls the same type of check. For instance, if a character is suspected of lying (using Deception), another character hearing the lie may roll Deception as well, using their own knowledge of lying to determine if the first character is intentionally misleading them. In a similar vein, if a traveler is haggling with a merchant (through a Bartering check), the merchant's perception of the traveler's offer may be determined by contesting the traveler's roll with their own Bartering roll.

### Bartering

Bartering pertains to the art of trades and bargains. A well-trained barterer will be able to negotiate effectively with merchants or just about anyone they wish to conduct business with. Ranks in Bartering indicate insight into markets as a whole, but also into the social aspect of trading and haggling, persuading others to sweeten an offer, or make a compromise. Barterers can prioritize their training in either procuring obscure goods, the transportation of trade goods, or negotiating deals with others.

#### Example Uses

**Appraise.** You can perform a Bartering check to determine the approximate value of an item, as well as identify any factors that may cause an item to increase or decrease in value or demand.<br>
**Haggle.** When conducting a trade or other form of negotiation, you can attempt to convince those you deal with to make a more reasonable offer, or settle for a deal that may be less beneficial for them.<br>
**Sense Intent.** When a deal is proposed, a Bartering check can determine if the offer is sincere, a joke, or an attempt to swindle.<br>

| Rank | Bartering Skill Progression        |
| ---- | ---------------------------------- |
| 0    | You are untrained in the ways of the merchant; Any idea you have on the value, or possible location, of a good or service is down to an uneducated guess, or whatever price you've seen it sold at before. Critically failing a Bartering check to haggle a price will often offend those you are haggling with, causing them to either worsen their offer or refuse business entirely. |
| 1    | You have learned the basics of trade. You can more easily ascertain the value of a common item or service in relation to others, even if you have not seen that specific item sold before. You can also perform a Bartering check to determine where an item or service might be sold. Haggling comes more naturally to you, whether through bartered goods or coin. On a bartering check, critical fails alone do not cause those you are trading with to worsen offers or withdraw from business, unless they have another reason to do so. You may be able to recognize an antique (unless it is a clever forgery). You have a basic understanding of world trade routes and what exports are produced in any region you have visited. |
| 2    | You are a capable merchant and haggler, and have developed a knack for dealing with traders, workers, and anyone else willing to exchange goods or services. You can perform checks to determine an accurate estimate of a good or service, even if you have not seen that specific item sold before. If a common non-magical commodity has an inherent or unanimously-accepted value, you immediately know what that value is. On a bartering check, critical fails alone do not cause those you are trading with to worsen offers or withdraw from business, unless they have another reason to do so. You can often recognize an antique (unless it is a clever forgery). You have some experience dealing with trade routes and know what primary goods or exports are produced in any region you have visited. |
| 4    | You are almost omniscient in your ability to conduct trade or incite compromise from those around you. If a commodity, non-magical item, or a magical item of lower rarity than Unique (Legendary?) has an inherent or unanimously-accepted value, you immediately know what that value is. If you spend a day examining a marketplace, you have Reliability on checks made to determine the average value of any given item in that market. If you successfully discern that an offer given is too low or too high, you immediately discern whether the offer is insincere (the offer is a deliberate scam), or simply misguided (the offerer doesn't know any better). You have a sharp eye with appraising antiques (unless it is an immaculate replica or forgery of the original). You have comprehensive insight into trade routes; you know what goods might be found in any region you have visited, and have Reliability on determining the exports of any other region. |

| Path (Rank) | Progression Path Benefits |
| ----------- | ---------------------- |
| **Antiquarian**  | Specialists in the procurement and identification of ancient or eclectic items. |
| Rank 3      | You have become an expert with rare items, knowing of both the objects themselves and those who may be interested in them. You know if a rare item is counterfeit or otherwise a mere replica. You have +2 Boons on checks to evaluate or recall details about a rare item, whether they are magical or non-magical. If you critically succeed on a check to recall details about such an item, you automatically deduce the item's (or the nearest copy of that item's) location. When you identify a magical item, you learn the name of its creator, and one party that is likely interested in acquiring it. |
| Rank 5      | You know almost everything there is to know about even the most obscure objects. You know if a rare item is counterfeit or otherwise a mere replica.  You have +4 Boons on checks to evaluate or recall details about rare items, whether they are magical or non-magical. If you critically succeed on a check to recall details about such an item, you automatically deduce the item's (or the nearest copy of that item's) location. When you identify a magical item, you learn the name of its creator, one party interested in acquiring it, and whether the item is cursed, and to what extent. |
| **Caravaner**  | Specialists in mercantilism and the transportation of goods. |
| Rank 3      | You are adept in the understanding of the ebb and flow of various markets, and where goods may be most in demand, or most plentiful in supply. You have +1 Boon on checks to determine the value of any goods you can see. If you critically succeed on a check to determine the price of an item in a local market, you immediately know if its price is higher or lower in neighboring settlements, and why that may be. You understand what factors play into why an item's price might increase or decrease from location to location. You can spend an hour in any settlement with methods of transportation to arrange the delivery of goods to or from another place. |
| Rank 5      | You are a paragon of commerce and can read markets like a book; you always know where to best bring your business. You have +3 Boons on checks to determine the value of any goods you can see. If you succeed on any check to determine the price of an item in a local market, you know if its price is higher or lower in neighboring settlements, and for what reasons. By critically succeeding on such a check, you learn of any individuals who will sell it for the lowest price, or buy it for the highest price, within up to ten days' travel. You can spend an hour in any settlement with methods of transportation to arrange the delivery of goods to or from another place. |
| **Negotiator**  | Specialists in haggling and compromise to arrange favorable terms in negotiation. |
| Rank 3      | You know how to drive a hard bargain. You have +2 Boons on checks made to haggle prices and negotiate during trades, as well as on checks made to determine if an offer is dishonest. At most once per social interaction, if you fail a Bartering check to negotiate more favorable terms, you can reroll the check and must take the new result. |
| Rank 5      | Your silver tongue and quick wit grants you the ability to have almost anyone compromise for you in a deal. You have +3 Boons on checks made to haggle prices and negotiate during trades. You can recognize a scam artist anywhere, and always know if an offer is misleading or otherwise dishonest. At most twice per social interaction, if you fail a Bartering check to negotiate more favorable terms, you can reroll the check and must take the new result. |

### Deception

Deception deals with using misinformation to subtly or overtly mislead others - causing them to make incorrect assumptions or draw erroneous conclusions. Skill in Deception represents your ability to lie, trick, manipulate, or otherwise act in a disingenuous way. Skilled deceivers can develop expertise in manipulating the flow of information, in tricking the senses through illusion, or in infiltrating the very minds of their enemies.

#### Example Uses

**Lie.** You can use the Deception skill for attempts to willfully mislead others, or convincingly omit the truth from your words.<br>
**Detect Lies.** You can use your own knowledge of Deception to determine if someone else may be lying.<br>
**Disguise.** You can attempt to create a disguise that may mask your identity. This includes both creating a costume or outfit for a disguise, and also imitating the behavior and speech of another individual.<br>
**Fabricate.** Attempts at forgery use Deception checks to create a seemingly-official document, or make some other physical object seem genuine.<br>

| Rank | Deception Skill Progression                                  |
| ---- | ------------------------------------------------------------ |
| 0    | Your ability to lie with a straight face is limited, and you may have some less-than-subtle tells when you attempt to hide the truth with your words. You can make attempts to form a disguise, but have no way of knowing what a certain disguise should look like unless you have personally seen such an outfit before. |
| 1    | You are able to lie with a straight face and without obvious tells. You have a basic understanding of manipulation and you understand what ploys or falsehoods are likely to be believed. You are able to craft false documents which do not rely upon specific handwriting or an identifying seal. You know the basics of disguise artistry, and are able to conceal your identity using a costume which you have prepared in advance. |
| 2    | You are well-practiced liar, and can invent plausible scenarios on the fly. You have an advanced understanding of manipulation and automatically succeed on any deception check with a CR of 10 or less. You are able to create false documents, including impersonating handwriting or an official seal if you have a sample to imitate. You are more capable with the art of disguise, and may attempt to conceal your identity with an improvised costume using materials at hand. |
| 3    | **Choose a progression path.**                               |
| 4    | You are a master manipulator - it is near impossible to tell whether you are telling the truth. You have a comprehensive understanding of how to manipulate others. You automatically succeed on any deception check with a CR of 25 or less. You are a master forger, able to create false documents including handwriting or official seals which are indistinguishable from the original. You are a peerless disguise artist, and it is possible for you to exactly imitate the appearance of a different person if you have the time and materials needed to prepare a disguise. |
| 5    | **Complete your progression path.** |

The progression paths available to the Deception skill are listed below.

| Path (Rank)     | Progression Path Benefits                                    |
| --------------- | ------------------------------------------------------------ |
| **Grifter**     | Specialists in distributing misleading information through subtlety and false confidence. |
| Rank 3          | You have a knack for predicting which falsehoods could be believable. If you attempt a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach at most once per social encounter. You are able to remember any lies you have told within the past month. You can recall the appearance of any official document you have read, and have +2 Boons on attempts to forge documents or similarly fabricate other items to appear genuine. |
| Rank 5          | You have mastery in predicting which falsehoods could be believable. If you ever face a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach. You are able to remember any lies you have told within the past year. You are able to correctly conjecture what an official document would look like even if you have not seen it, and have +2 Boons on attempts to forge documents or similarly fabricate other items to appear genuine. |
| **Illusionist** | Specialists in sensory illusions, generally mundane but occasionally arcane in nature. <br> Currently under review; see Trickster. |
| Rank 2          | You are an expert in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer from +1 Bane for Skill Checks to avoid being misled by the distraction. You have +1 Boon on checks made to recognize illusory magic created by other spellcasters. |
| Rank 4          | You are a master of using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer from +3 Banes for Skill Checks to avoid being misled by the distraction. You have +3 Boons on checks made to recognize illusory magic created by other spellcasters. |
| Rank 5          | You are peerless in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others automatically fail their first attempt to avoid being misled by your distraction and suffer from +3 Banes for subsequent Skill Checks. You can immediately recognize the presence of illusory magic created by other spellcasters. |
| **Mesmer**      | Specialists in mind-altering alchemy and magic to transform enemies into allies. <br> Currently under review; see Trickster. |
| Rank 2          | You have studied the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 minute of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. You have +1 Boon to Willpower Defense against charm-like effects. |
| Rank 4          | You have refined the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 3 rounds of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer from +1 Bane to their Willpower Defense against charm-like effects. You have +3 Boons to Willpower Defense against charm-like effects. |
| Rank 5          | You have perfected the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 round of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer from +3 Banes to their Willpower Defense against your charm-like effects. You are immune to charm-like effects. |
| **Trickster** | Specialists in fooling the senses with illusions and mesmerization, whether mundane or arcane. |
| Rank 3 | You are an expert in using misdirection with mundane equipment, such as firecrackers, flash powders, smoke bombs, as well as illusory magic and charms. Others suffer +1 Bane on checks made to avoid being misled by these distractions, or charmed by one of your spells. You have +2 Boons on checks made to recognize illusions created by other spellcasters, and can immediately tell if a creature you see is charmed. |
| Rank 5 | You are peerless in the art of misdirection with mundane equipment, such as firecrackers, flash powders, or smoke bombs, as well as illusory magic and charms. Others suffer +3 Banes on checks made to avoid being misled by these distractions, or charmed by one of your spells. You can immediately recognize the presence of illusory magic, and can tell if a creature you see is magically charmed or dominated. You have +3 Boons to Willpower Defense against charm-like effects. |
| **Spy** | Specialists in concealing one's identity through disguises and impersonation. |
| Rank 3 | You are adept in the creation and use of disguises. You have +2 Boons on checks made to create a disguise, whether for yourself or for another person. When you see a creature, you automatically know what materials you could use to make a convincing doppelganger, and can assemble disguises in half the normal time. You have Reliability on Skill Checks made to obscure your identity, and you have +3 Boons on convincingly imitating another Medium humanoid-shaped creature if you have spent at least 1 hour seeing them both speak and move. |
| Rank 5 | You are an unparalleled master of disguise, capable of creating and committing to impersonations and even entirely new identities. When you see a creature or an outfit, you automatically know what materials you could use to make a convincing doppelganger, and can assemble disguises in half the normal time. You have Reliability and +3 Boons on Skill Checks made to obscure your identity, and automatically succeed on attempts to convincingly imitate another Medium humanoid-shaped creature if you have spent at least 1 hour seeing them both speak and move. |

### Diplomacy

Diplomacy involves the persuasion of others, awareness of customs, and general social grace. Trained diplomats are able to convince others to understand their perspective, and can easily pass as approachable or agreeable in conversation. Skill in Diplomacy represents your aptitude to have others agree with you, or to convince, plead, negotiate, or appease.

#### Example Uses

**Persuade.** It is often possible to convince others to agree with you with a Diplomacy check.<br>
**Diffuse.** When encountering a creature who bears hostile intent towards you, you may attempt to negotiate for civility through performing a Diplomacy check.<br>
**Empathize.** Attempts to understand the motives or rationale of others may be possible with a Diplomacy check. <br>
**Recall.** Diplomacy can be used to determine the obligatory social customs to follow with an individual or group you wish to interact with.<br>

| Rank | Diplomacy Skill Progression        |
| ---- | ---------------------------------- |
| 0    | You have no diplomatic experience beyond what a typical commoner might have. Your conduct in social situations is heavily derived from your personal background, and is largely limited by those experiences. You may find trouble passing yourself off as a public speaker, diplomat, or spokesperson. |
| 1    | You've developed something of an understanding for winning others over with words. Your social conduct is likely more universally friendly; you know what actions to avoid taking, lest you offend those who are unfamiliar to you. You have a sense of what can be reasonable for others, and how to make people agree with you through their own social rules (or your own). |
| 2    | You often know how to carry yourself around others, and have a way with words. With your sense of empathy and social grace comes the ability to appear agreeable to a wide variety of people, letting others give you the benefit of the doubt. You often know what may stand to reason with others by their own rationale. If you attempt a Diplomacy check of Impossible difficulty, the GM must tell you before you roll and you may choose to alter your approach at most once per social encounter. |
| 4    | You are miraculously persuasive, and can carry yourself through almost any social situation with unparalleled grace. Your social conduct is seen almost universally as civil and polite, if you desire it to be, even if you perform actions considered as "social taboo" in dealings with foreigners. If you attempt a Diplomacy check of Impossible difficulty, the GM must tell you before you roll and you may choose to alter your approach at most twice per social encounter. |

| Path (Rank) | Path Skill Progression |
| ----------- | ---------------------- |
| **Ambassador** | Specialists in understanding social conduct and how to make the best first impression. |
| Rank 3      | You have a keen sense of the unspoken rules of social conduct with those around you, even if they are total strangers or completely foreign to you. As long as they are not currently hostile towards you, you gain +2 Boons on Skill Checks made to socially interact with strangers, as well as attempts to discern what unspoken social obligations (such as bowing or other gestures) you should adhere to when dealing with them. If you critically succeed on a Diplomacy check with a stranger, you and your allies cannot critically fail a Diplomacy check while interacting with the stranger for the remainder of the social encounter. |
| Rank 5      | Your skill as a diplomat can appeal to almost all races and cultures of people, bestowing you with an everpresent grace, even with those who would normally find you disagreeable or even contemptible. As long as they are not currently hostile towards you, you gain +4 Boons on Skill Checks made to socially interact with strangers. You automatically know what social obligations to adhere to, or taboo behavior you should avoid, when dealing with those who are unfamiliar with you. When you critically succeed on a Diplomacy check with a stranger, you and your allies cannot critically fail a Diplomacy check while interacting with the stranger for the next day. |
| **Arbiter** | Specialists in defusing a situation, invoking law and order to bring peace to those around them. <br> *Experimental: <br> • Your allies have +X Boons on checks made to resist being frightened. <br> • You can spend 1 AP on your turn to allow a creature who can hear you to immediately make a check to end an effect that is currently Frightening them.* |
| Rank 3      | You align yourself (or at least have a deep understanding) of orderly conduct, and can effectively deal with authorities or make others agree with you through the lens of law. You have +2 Boons on Skill Checks made to interact with notable figures of authority, such as nobles or those who are considered your superior, and checks made to peacefully defuse a situation where someone bears hostile intent toward you or one of your allies. |
| Rank 5      | You are a beacon of lawful conduct, and your understanding of social order instills confidence in those you deal with. You have +4 Boons on Skill Checks made to interact with notable figures of authority, such as nobles or those who are considered your superior, and checks made to peacefully defuse a situation where someone bears hostile intent toward you or one of your allies. |
| **Firebrand** | Specialists in amplifying the emotions around them, encouraging their allies and impassioning crowds of people. <br> *Experimental: <br> • You can spend X AP to encourage an ally who can hear you, allowing them to immediately move 5 feet or stand up without expending their own movement or AP. <br> • The AP cost to Help an ally with an action is halved. <br> • Once per round, if you would have Boons performing a particular check yourself, you can grant the same bonus to a nearby ally performing that check.* |
| Rank 3      | You have learned how to serve as a favored leader, and spark inspiration in those around you. You have +2 Boons on any checks made to convince others in a call of action, or sway the opinion of crowds or other large gatherings of people. |
| Rank 5      | You are a quintessential demagogue, and can draw others' emotions to your own convictions like moths to a flame. You have +4 Boons on any checks made to convince others in a call of action, or sway the opinion of crowds or other large gatherings of people. Your capacity to convince people in this way surpasses language barriers; you can can perform such checks as normal on creatures who you do not share a language with. |

### Intimidation

Intimidation refers to harnessing one's social or physical presence, imposing one's self as a threat to others. Much like Diplomacy, Intimidation can be used to persuade others; however, this is done through cultivating fear, rather than respect, in those who are to be persuaded. Skill in Intimidation relates to your ability to persuade through threat of violence, persecution, or any other misfortune, and the most skilled intimidators know what can strike fear into almost anyone.

#### Example Uses

**Scare.** The Intimidation skill may be used, first and foremost, to startle and violently coerce others to cooperate.<br>
**Instill.** Creating a more covert sense of doubt in an individual may require an Intimidation check.<br>
**Detect Intent.** You can use your own knowledge of Intimidation to determine if others are attempting to strong-arm you, or if their threats carry any real weight.<br>

| Rank | Intimidation Skill Progression     |
| ---- | ---------------------------------- |
| 0    | You have no real understanding of what scares people. Your unassertive aura means thieves and cutpurses may see you as an easy target. You only know how to intimidate people through verbal or direct physical threats. |
| 1    | You've developed a general understanding of what scares people. You have a look about you, one which discourages some from disturbing you. Thieves and cutpurses may still see you as an "easy mark," and others may target you for other ploys. You can demonstrate your capacity for violence or misfortune without using words (such as adopting a menacing pose) which you can use to frighten off others. When you see another creature, you know if their Morale is below half its maximum value. |
| 2    | You know how to assert your presence, and know what can scare the average person. You carry yourself in a way that is enough to put off those who would disturb you. Thieves and cutpurses no longer see you as an "easy mark". You can easily and subtly intimidate others without using words (such as adopting a menacing pose). When you see another creature, you know if their Morale is below half its maximum value. |
| 3    | **Choose a progression path.** |
| 4    | You have become a veritable fortress of fear; your capacity to scare those around you is nearly unmatched. The "look" you carry with you is enough to stave off almost any threat; only a complete fool would go out of their way to trouble you. Whether through words or actions, your social presence is overwhelming when you choose it to be. You can perform an Intimidation check as a free action once per round, targeting your choice of creatures who can see you, which the chosen creatures must contest with Willpower or become Frightened of you until the end of your next turn. When you see another creature, you know if their Morale is below half its maximum value, and gain Reliability on checks made to socially interact with such a creature. |
| 5    | **Complete your progression path.** |

| Path (Rank)    | Path Skill Progression |
| -------------- | ---------------------- |
| **Inquisitor** | Specialists in the spoken word, interrogation, and knowing how to craft veiled threats to confuse and unsettle. |
| Rank 3         | You are an expert in the art of veiled threats, and can terrify others with your ability to get to the truth. You have +2 Boons on attempts to scare others subtly and verbally, such as through veiled threats. All creatures have +1 Bane on Deception checks to lie to you. |
| Rank 5         | Your brand of terror is simultaneously overwhelming and subtle, and can shake people in a way they can rarely understand or predict. You have +4 Boons on attempts to scare others subtly and verbally, such as through veiled threats. Third parties who see and hear you make veiled threats are not aware of what has transpired unless you make it known. When interrogating for information out of combat, your target has +3 Banes on Deception checks to lie to you. |
| **Ruffian**    | Specialists in using physical force as a social implement, and strongarming others into cooperation. <br> *Experimental: <br> • Ability to drain Morale from a creature in combat <br> • Bonus on feint attacks and similar maneuvers* |
| Rank 3         | You know how to use outright aggression to strike fear into others. If you physically assert yourself, such as aggressively advancing towards a creature or grappling, you have +2 Boons on checks made to intimidate them. If a creature within 40 feet of you is Frightened of you, they have +2 Banes on any roll made to overcome the condition. |
| Rank 5         | Your ability to exert your physical presence can scare others senseless. If you physically assert yourself towards a creature, such as aggressively advancing towards them or grappling them, you have +4 Boons on Intimidation checks. If a creature within 40 feet of you is Frightened of you, they have +2 Banes on any roll made to overcome the condition and move at half speed. |
| **Fearmonger** | Specialists in magically drawing out and exploiting the acute fears and anxieties of their targets to torment them. |
| Rank 3         | You know how to understand a creature's deeper fears, and can conjure horrifying scenarios to affect them. Targets have +1 Bane on checks to resist being Frightened by magical effects created by you. When you target a creature with an effect that changes their Morale, you learn of their current Morale. |
| Rank 5         | You have perfected the art of uncovering one's deepest fears, and can engineer situations to leave them abjectly horrified. Targets have +3 Banes on checks to resist being Frightened by magical effects created by you, and the duration of such effects are doubled. When you target a creature with an effect that changes their Morale, you learn of their current Morale. |

## Tradecraft Skills

### Animal Handling

Animal Handling is used, quite simply, in the handling of animals. Skill in Animal Handling helps one understand the mindset and habits of beasts, how to coerce, calm, tame, or stave them off, or predict their next move. A well-trained animal handler knows much more general knowledge about animals, and will more easily have understanding of such creatures, to either develop bonds or manipulate.

#### Example Uses

**Tame.** Animal Handling is used in attempts to calm wild beasts, allowing them to be approached, examined, or fed. A hostile beast may be dissuaded from attacking you with a successful Animal Handling check.<br>
**Mount.** You may mount creatures at least one size larger than you, but doing so requires an Animal Handling check.<br>
**Command.** With creatures who are friendly or indifferent to your presence, you can attempt to command them through Animal Handling.<br>
**Recall.** You can roll Animal Handling checks to try to remember information about a certain kind of animal, such as its usual habitat, appearance, and eating or mating habits.<br>

| Rank | Animal Handling Skill Progression |
| ---- | ---------------------------------- |
| 0    | You have no particular way with animals. Most wild beasts are discomforted by your presence and will often either attack or flee from you. You have trouble mounting or controlling a domesticated creature without supervision. You do not know how to command trained animals, and any attempts to control a mount will cause them to try bucking you off on a critical fail. |
| 1    | You have learned how to work with various domesticated animals. You know how to mount creatures unsupervised, and how to issue basic commands to a domesticated creature you are riding. You no longer risk being bucked off a calm animal when you critically fail a check to command it. Wild beasts are still discomforted by your presence, but you can perform Animal Handling checks as a Lengthy Action to calm them. You can attempt to calm any beast, but beasts who are magically compelled to be hostile will be harder to pacify. You know the basic diets and typical habits of most common animals. |
| 2    | Your experience working with animals helps you understand and control both wild and tame beasts. Wild beasts sometimes still startled by your presence, but you can perform Animal Handling checks as a Lengthy Action to calm them. You have Reliability on checks to mount any calm beast. You can attempt to calm any beast, but beasts who are magically compelled to be hostile will be harder to pacify. You have a fairly detailed understanding of the diets, habits, and locations of common animals. |
| 3    | **Choose a progression path.** |
| 4    | You have endless empathy and understanding for beasts. Wild beasts are not bothered by your presence unless they are otherwise compelled to be, and you can spend 2 AP to perform an Animal Handling check to calm them. You can mount willing domesticated animals without having to perform an Animal Handling check. You have Reliability on checks to give direct, simple orders to any beast, provided it is calm. Charm-like effects or other magical compulsions a creature is under do not hinder your attempts to calm or pacify it. |
| 5    | **Complete your progression path.** |

| Path (Rank)     | Path Skill Progression |
| --------------- | ---------------------- |
| **Cavalier**    | Specialists in taming, caring for, and mounting large creatures. <br> *Experimental: <br> • Use Help action for free to assist any mount's skill check* |
| Rank 3          | Your familiarity with larger creatures makes you an expert on how they are best tamed and handled. You have +2 Boons on Skill Checks to tame and calm beasts at least one size category larger than you, and can tame such a creature in half the time. You have +1 Boon on checks to maintain control of a friendly large creature, and on checks to stay mounted to them. A friendly beast you are riding will never try to buck you off unless it is magically compelled to, and any mount you are riding has +2 Boons on checks to resist mental effects. |
| Rank 5          | Your unyielding confidence around larger animals lets them easily trust you as their handler. You have +4 Boons on Skill Checks to tame and calm beasts at least one size category larger than you, and you can tame such a creature in half the time. You have +2 Boons on checks to maintain control of a friendly large creature, and you cannot unwillingly fall off a creature you are riding unless you are unconscious. A friendly beast you are currently handling or riding is immune to magical compulsions to disobey your orders, and has +2 Boons on other checks to resist mental effects. |
| **Beastmaster** | Specialists in befriending many types of animals, to both work and fight alongside them. <br> *Experimental: <br> • Reliability on checks to command non-hostile beasts.* |
| Rank 3          | You have a way with all types of animals, understanding their temperament enough to even befriend them. You have +1 Boon on any check to tame or handle any undomesticated beasts. You can tame several wild creatures of the same species at the same time with a single Skill Check. Any beast you successfully calm or tame will always remember your appearance, voice, or scent, and will generally always remain docile to you after they are first calmed. |
| Rank 5          | You have an unbreakable bond with the fauna of the world. You have +3 Boons on any check to tame or handle any undomesticated beast. You can tame several wild creatures at the same time, even if they are of different species, with a single Skill Check. Any beast you successfully calm or tame will always remember your appearance, voice, or scent, and will readily defend or assist you even well after they are first befriended. |
| **Gamewarden**  | Specialists in animal treatment, and the secret lore of beasts. |
| Rank 3          | Your knowledge of beastlore helps you understand and effectively treat a wide variety of fauna. You have +2 Boons on checks to recall specific information about animals, such as their species, behavior, size, habitat, or diet. You can automatically identify any common or non-magical ailment a beast suffers has when you examine it, and have +2 Boons on attempts to medically treat a beast's illnesses. Though you cannot communicate with beasts, you have a peculiarly accurate way of understanding them; if a beast is behaving a certain way (such as anxiously pacing, staring, or making noises), you immediately discern the reasons why. |
| Rank 5          | Your knowledge of beastlore helps you treat You can accurately recall any known information on any common animal, and you have +4 Boons on checks to recall specific information about uncommon animals, such as their species, behavior, size, habitat, or diet. You can automatically identify any ailment a beast suffers from or has suffered from in the past when you examine it, and have +4 Boons on attempts to medically treat a beast's illnesses. Your insight into bestial creatures makes it seem almost as if you can speak to them; if a beast is behaving a certain way (such as anxiously pacing, staring, or making noises), you immediately discern the reasons why. |

### Craftsmanship

Craftsmanship involves knowledge and artisanship in a particular trade skill. Earning ranks in Craftsmanship indicates the ability to understand a certain profession (or general professions as a whole) and aptitude in creating high-quality goods or performing skillful services. A competent craftsman may be acclaimed for their ability to make quality goods, and knows what they need to get the job done.

#### Tools of the Trade

Experience in a certain trade skill often comes with the ability to use various implements involved in that trade. Craftsmanship ranks make use of Trade Tools, which denote all tools commonly associated with a specific skill. A smith's Trade Tools, for instance, covers tools and facilities commonly used to smith and work metal, such as hammers, whetstones, and forges. Ranks in Craftsmanship bestow knowledge of Trade Tools, which provides benefits in all tasks associated with that skill.

#### Example Uses

**Appraise.** You may determine the quality of an item, its approximate value, or the cost to make it using a Craftsmanship check. You can also attempt to determine the defining features of a crafted item, its purpose, or its potential flaws (both functionally and aesthetically).<br>
**Craft.** Creating an item through a trade skill requires a Craftsmanship check, and often requires some prior knowledge on using certain tools to make such an item.<br>
**Use Tool.** Tools used by artisans will often employ the Craftsmanship skill in checks to use the tools, whether this is to create items, repair them, or perform any other task.<br>

| Rank | Craftsmanship Skill Progression    |
| ---- | ---------------------------------- |
| 0    | The knowledge you have in trade skills is largely insubstantial. You may automatically fail tasks that require certain knowledge of a profession, or complicated use of a Trade Tool. |
| 1    | You are taught in the rudimentary ways of a certain trade skill. Choose one type of tool to become your Trade Tool; you have Reliability on checks to carry out work using your Trade Tool. You can examine an item and automatically know if such an item was, or could be, made or repaired with your Trade Tool. |
| 2    | You are well-practiced in a few trade skills. Choose one more type of tool (bringing your total to two) to become your Trade Tool; you have Reliability on checks to carry out work using your Trade tool. You can examine an item and automatically know if such an item was, or could be, made or repaired with your trade tool. You can repair any item in half the normal time. |
| 3    | **Choose a progression path.** |
| 4    | You are a world-class craftsman. You are an instant savant with any tool you can get your hands on, and can save time and costs drastically thanks to your ingenuity. Choose one more type of tool (bringing your total to three) to become your Trade Tool; you have Reliability on Skill Checks made to carry out work using a Trade Tool. You can examine an item and automatically know what type of tools were used to make it, or could reasonably be used to repair it. You can craft or repair any non-magical item at half the normal time and supply cost. |
| 5    | **Complete your progression path.** |

1. **Trademaster** - Specialists in all aspects of a certain trade, from the creation of its goods, to the sale of those goods, to the instruction of others in that skill.
2. **Artificer** - ???
3. **Runekeeper** - ???

### Medicine

Medicine is used to deal with the health of one's self and others, and to diagnose and effectively treat medical problems. Knowledge in this skill represents your knowledge about the humanoid body, sickness, infections, and the art of healing. This skill typically involves examining/treating humanoids, but can apply to other types of creatures as well. A medic who has mastered their craft can diagnose and treat a wide variety of illnesses, prevent illnesses in those around them, perform autopsies, and more.

#### Example Uses

**Diagnose.** You can use a Medicine check to determine the state of a creature's health, and what ailments are affecting it.<br>
**Autopsy.** You can determine the cause of death in a creature with a successful Medicine check.<br>
**Treat.** If you are aware of a disease, injury, or other medical ailment affecting a creature, you can perform Medicine checks to attempt to treat or cure the condition.<br>
**Recall.** You can attempt to remember medical knowledge about an ailment, its treatment, the function of an organ in a creature. Medicine checks can also be used infer this information even if it is not yet known.<br>


| Rank | Medicine Skill Progression         |
| ---- | ---------------------------------- |
| 0    | You know little about the inner workings of the body, and can generally only guess what is causing a symptom, or how to treat it. You fail Medicine checks made to help determine an effective treatment to an internal injury or infection, but can still make a guess and carry out an impromptu procedure. You cannot determine an organ's purpose you have not dealt with before, or diagnose problems in an organ which are not immediately obvious. You can, however, analyze corpses to determine a cause of death. |
| 1    | You have developed a basic understanding of the body, and general issues or problems related to illness. You can attempt Medicine checks to determine the underlying cause of a symptom, ascertain the purpose of a strange organ, diagnose medical problems, infer an effective treatment, and analyze corpses to determine cause of death. |
| 2    | You have practiced medicine enough to have a strong understanding of most conventional illnesses and how to treat them. If you spend at least five minutes doing so, you have Reliability on checks to diagnose a living creature's illness, or determine a corpse's cause of death. With bedrest and proper treatment, you have Reliability on checks made to recover from an illnesses. |
| 3    | **Choose a progression path.** |
| 4    | You are almost infinitely wise in your knowledge of health. When you are within 5 feet of a creature you can see, you can spend an action to instantly recognize which of the following conditions the creature is affected by: Afraid, Blinded, Bleeding, Bloodied, Confused, Diseased, Frozen, Paralyzed, Poisoned, Silenced, Stunned, or Unconscious. If you examine a creature for an entire minute, you instantly know of any diseases or other medical conditions the creature is afflicted by. You can perform this check on corpses to automatically identify which conditions they were suffering as they died. You have +3 Boons on checks made to resist contracting an infection or disease, and on checks made to recover from such a disease. |
| 5    | **Complete your progression path.** |

1. **Apothecary** - Specialists in the identification and creation of curatives, preventatives, and poisons.
2. **Chirugeon** - Specialists in surgery, bringing those back from death's door with life-saving blades, stitches, and bandages.
3. **???**

> NOTES: For third specialization, potentially: <br>
> Thanatologist/Diener - specializing in autopsy, obscuring the age of a corpse, or perhaps confering a bonus to dealing with / creating undead creatures <br>
> Thaumaturgist - specializing in using magic to diagnose or cure, removing disease or disease-like curses through the use of magic <br>

### Performance

Performance deals with the creative arts meant to impress, inspire, or evoke emotions in those who bear witness. Knowledge in this skill reflects on your ability to entertain an audience, through song, dance, comedy, theatrics, or other crowd-pleasing feats. A talented performer understands their own trade, and knows how to appeal to emotion through an art form.

#### Example Uses

**Perform.** You can recite a song, dance, theatrical scene, or otherwise entertain an audience through a rehearsed act with Performance checks.<br>
**Improvise.** You can envision or create a work of performance art on your own, which may require Performance checks to adequately execute.<br>
**Recall.** You may perform Performance checks to recall information about a particular work of art, or an individual performance of that work.<br>

| Rank | Performance Skill Progression      |
| ---- | ---------------------------------- |
| 0    | You have next to no experience in any public performance. You have not committed yourself to any particular art form, and cannot reliably recall finer details about any particular art form. You may be considered largely "uncultured" by those who are more familiar with an art form. |
| 1    | You have learned the basics of an art form, and acquired a general understanding of what attracts onlookers to the spectacle of a good performance. You can recall basic information on most common art forms, and can reliably recite common pieces (such as songs, poems, or dances) as part of a performance. |
| 5    | You are a quintessential crowdpleaser, and your performances can move almost anyone who bears witness to your craft. You can sing, dance, perform, and act in manners fit to entertain kings or even gods. Improvising during a performance meant to entertain does not increase the difficulty of the check. |

1. **Musician** - Specialists in performing music, understanding musical lore, and creating blissful harmonies with others.
2. **Artist** - ???
3. **Athlete** - ???
