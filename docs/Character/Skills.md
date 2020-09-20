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

| Rank | Perception Progression Ideas       |
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

Lore relates to the breadth of one's general knowledge, ranging from information on cultures, to world history, geography, politics, or even fables and myths.

#### Example Uses

**Recall.** A character can attempt to recall general lore or history they may know about any particular subject. This is often retroactive - a character succeeding on such a Lore check could be seen as having always known the information, but remembering it just in time.<br>
**Deduce.** When information is already at hand, you may use your knowledge of the world to attempt to predict a future event, or deduce something that was previously unknown.<br>

1. **Historian** - Specialists in keeping history, and knowing of the cultures of the world.
2. **Sage** - Specialists in discovering the truth, wherever it may lie.
3. **Storyteller** - Specialists in keeping and studying legendary tales.

### Religion

#### Example Uses

**Recall.** You can attempt to recall information about a deity, religion, or those who follow a religion. This includes understanding symbology, cultural insight of a religion (or religions), or philosophical sentiments.<br>
**Intuit.** Religion checks can also be performed to understand the deeper meaning of a religious custom, comprehend the mandates of a deity, or divine the significance of a religious event or figure. Depending on the setting, this level of insight may, at times, literally be the result of divine intervention.<br>

| Rank | Religion Progression Ideas         |
| ---- | ---------------------------------- |
| 0    | In the eyes of the faithful, you are unenlightened. You likely only know a few details about your own religion, if you follow one, or some widely-known religions. |
| 1    | You have acquired a basic understanding of your own religion, or a few others. Choose a faith: a religion, sect, cult, or circle in your setting, with GM approval. You know of the symbols used to signify your faith, and, if valid, know of the symbols that are antithetical or "blasphemous" to your faith. You know what is generally encouraged or forbidden by your faith, and the places or religious sites normally associated with it. |
| 2    | You have developed greater insight into your own religion, as well as others related to it. You know of the symbology, practices, and taboos of your faith, as well as its associated locations or religious sites, as well as some deeper insight into your religious philosophy. You have Reliability on Skill Checks made to know how closely-aligned another religion is to your own. |
| 3    | **Choose a progression path.** |
| 4    | Your understanding of religion transcends mere encyclopedic knowledge; you have a holistic understanding of faith and dealings with the divine. You are capable of effortlessly conducting, or writing anew, religious doctrine. You automatically succeed on checks to recall information about your own faith, and have +3 Boons to checks made to recall information about other religions. |
| 5    | **Complete your progression path.** |

1. **Occultist** - Specialists in the practices of a certain faith, from its beliefs to its rites.
2. **Hierophant** - Specialists in spreading the truth, and illuminating others through their faith.
3. **Druid** - Specialists in understanding the wild forces of nature.

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
| Rank 3 | Your sharp knowledge of physics lets you quickly understand your surroundings. At a glance, you can automatically determine when a creature is going to land after a fall, or approximately how heavy an object is. You have +3 Boons on checks to determine other physical properties of objects, such as volume. You have +2 Boons on checks made to exploit environmental hazards, or identify structural weaknesses in large objects such as buildings and vehicles. If you notice a structural weakness, you and your allies deal +2 damage on all attacks against the object until either the object is destroyed, or the structural weakness is somehow removed. |
| Rank 5 | Your studious knowledge of physics gives you an almost omniscient understanding of your surroundings. At a glance, you can automatically determine when a creature is going to land after a fall, or how heavy an object is. If you notice a creature moving, you automatically know any movement speeds it has. You have +4 Boons on checks made to exploit environmental hazards, or identify structural weaknesses in large objects such as buildings and vehicles. If you notice a structural weakness, you and your allies deal +4 damage on all attacks against the object until either the object is destroyed, or the structural weakness is somehow removed. |
| **Alchemist** | Specialists in harnessing substances to create stunning effects. |
| Rank 3 | Your comprehension of chemistry helps you reliably create powerful chemical reactions. You have +1 Boon on checks made to identify the nature of a powder, liquid, gas, or similar unknown substance, and +1 Boon on checks to determine what sort of reaction the mixing of two substances will make, if any. You have +2 Boons on checks made to craft a potion or other alchemical product. |
| Rank 5 | Your breadth of knowledge has allowed you to uncover the deepest secrets of alchemy. You have +3 Boons on checks made to identify the nature of a powder, liquid, gas, or similar unknown substance, and +3 Boons on checks to determine what sort of reaction the mixing of two substances will make, if any. You have +4 Boons on checks made to craft a potion or other alchemical product, and can do so in half the time. |
| **Tinkerer** | Specialists in the workings of intricate, manufactured objects. |
| Rank 3 | You have a knack for engineering and working with non-magical tools or manufactured objects with moving parts, such as machines or traps. You gain +1 Boon on all checks made to operate, dismantle, or understand any such device. If you are familiar with a manufactured device, you know what sort of materials or tools you would need to create it. You gain +2 Boons to checks to create a tool or device, whether it is conventionally made or an improvised version. |
| Rank 5 | You have unmatched finesse in dealings with non-magical tools or manufactured objects with moving parts, such as machines or traps. You gain +2 Boons on all checks made to operate, dismantle, or understand any such device. If you are familiar with a manufactured device, you know what sort of materials or tools you would need to create it. You gain +4 Boons to checks to create a device, whether it is conventionally made or an improvised version. Devices you create are harder to dismantle; anyone else has +2 Banes on their checks to dismantle your manufactured objects. |


## Social Skills

> Social skills are called such because they involve social interactions between two or more characters - as such, when a check is made, it can often be a part of a contest, where each participant rolls the same type of check. For instance, if a character is suspected of lying (using Deception), another character hearing the lie may roll Deception as well, using their own knowledge of lying to determine if the first character is intentionally misleading them. In a similar vein, if a traveler is haggling with a merchant (through a Bartering check), the merchant's perception of the traveler's offer may be determined by contesting the traveler's roll with their own Bartering roll.

### Bartering

Bartering pertains to the art of trades and bargains. A well-trained barterer will be able to negotiate effectively with merchants or just about anyone they wish to conduct business with. Ranks in Bartering indicate insight into markets as a whole, but also into the social aspect of trading and haggling, persuading others to sweeten an offer, or make a compromise. Barterers can prioritize their training in either procuring obscure goods, transporting trade goods, or negotiating deals with others.

#### Example Uses

**Appraise.** You can perform a Bartering check to determine the approximate value of an item, as well as identify any factors that may cause an item to increase or decrease in value or demand.<br>
**Haggle.** When conducting a trade or other form of negotiation, you can attempt to convince those you deal with to make a more reasonable offer, or settle for a deal that may be less beneficial for them.<br>
**Sense Intent.** When a deal is proposed, a Bartering check can determine if the offer is sincere, a joke, or an attempt to swindle.<br>

| Rank | Bartering Progression Ideas        |
| ---- | ---------------------------------- |
| 0    | You are untrained in the ways of the merchant; Any idea you have on the value of a good or service is down to an uneducated guess, or whatever price you've seen it sold at before. Critically failing a Bartering check to haggle a price will often offend those you are haggling with, causing them to either worsen their offer or refuse business entirely. |
| 1    | You have learned the basics of trade. You can more easily ascertain the value of a common item or service in relation to others, even if you have not seen that specific item sold before. Haggling comes more naturally to you, whether through bartered goods or coin. On a bartering check, critical fails alone do not cause those you are trading with to worsen offers or withdraw from business, unless they have another reason to do so. |
| 5    | You are almost omniscient in your ability to conduct trade or incite compromise from those around you. If a mundane item, or a magical item of lower rarity than Unique (Legendary?) has an inherent or unanimously-accepted value, you immediately deduce what that value is. If you spend a day examining a market, you have Reliability on checks made to determine the average value of any given item in that market. If you successfully discern that an offer given is too low or too high, you immediately discern whether the offer is insincere (the offer is a deliberate scam), or simply misguided (the offerer doesn't know any better). |

1. **Antiquarian** - Specialists in the procurement and identification of ancient or eclectic items.
2. **Caravaner** - Specialists in mercantilism and the transportation of goods.
3. **Negotiator** - Specialists in haggling and compromise to arrange favorable terms in negotiation.

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
| Rank 3 | You are adept in the creation and use of disguises. You have +2 Boons on checks made to create a disguise, whether for yourself or for another person. When you see a creature, you automatically know what materials you could use to make a convincing doppelganger, and can assemble disguises in half the normal time. You have Reliability on Skill Checks made to hide your identity through a disguise, voice, or mannerisms, and you have +3 Boons on convincingly imitating another Medium humanoid-shaped creature if you have spent at least 1 hour seeing them both speak and move. |
| Rank 5 | You are an unparalleled master of disguise, capable of creating and committing to impersonations and even entirely new identities. When you see a creature, you automatically know what materials you could use to make a convincing doppelganger, and can assemble disguises in half the normal time. You have Reliability and +3 Boons on Skill Checks made to hide your identity through a disguise, voice, or mannerisms, and automatically succeed on attempts to convincingly imitate another Medium humanoid-shaped creature if you have spent at least 1 hour seeing them both speak and move. |


### Diplomacy

Diplomacy involves the persuasion of others, awareness of customs, and general social grace. Trained diplomats are able to convince others to understand their perspective, and can easily pass as approachable or agreeable in conversation. Skill in Diplomacy represents your aptitude to have others agree with you, or to convince, plead, negotiate, or appease.

#### Example Uses

**Persuade.** It may, at times, be possible to convince others to agree with you with a Diplomacy check.<br>
**Diffuse.** When encountering a creature who bears hostile intent towards you, you may attempt to negotiate for civility through performing a Diplomacy check.<br>
**Recall.** Diplomacy can be used to determine the obligatory social customs to follow with an individual or group you wish to interact with.<br>

| Rank | Diplomacy Progression Ideas        |
| ---- | ---------------------------------- |
| 0    | You have no diplomatic experience beyond what a typical commoner might have. Your conduct in social situations is heavily derived from your personal background, and is largely limited by those experiences. You may find trouble passing yourself off as a public speaker, diplomat, or spokesperson. |
| 1    | You've developed something of an understanding for winning others over with words. Your social conduct is likely more universally friendly; you know what actions to avoid undertaking, lest you offend those who are foreign to you. If you attempt a Diplomacy check of Impossible difficulty, the GM must tell you before you roll and you may choose to alter your approach at most once per social encounter. |
| 5    | You are miraculously persuasive, and can carry yourself through almost any social situation with unparalleled grace. Your social conduct is seen almost universally as civil and polite, if you desire it to be, even if you perform actions considered as "social taboo" in dealings with foreigners. If you ever face a Diplomacy check of Impossible difficulty, the GM must tell you before you roll and you may choose to alter your approach. |

1. **Ambassador** - Specialists in understanding social conduct and how to make the best first impression.
2. **Arbiter** - Specialists in diffusing a situation, invoking law and order to bring peace to those around them.
3. **Firebrand** - Specialists in amplifying the emotions around them, encouraging their allies and impassioning crowds of people.

### Intimidation

Intimidation refers to harnessing one's social or physical presence, imposing one's self as a threat to others. Much like Diplomacy, Intimidation can be used to persuade others; however, this is done through cultivating fear, rather than respect, in those who are to be persuaded. Skill in Intimidation relates to your ability to persuade through threat of violence, persecution, or any other misfortune, and the most skilled intimidators know what can strike fear into almost anyone.

#### Example Uses

**Scare.** The Intimidation skill may be used, first and foremost, to startle and violently coerce others to cooperate.<br>
**Instill.** Creating a more covert sense of doubt in an individual may require an Intimidation check.<br>
**Detect Intent.** You can use your own knowledge of Intimidation to determine if others are attempting to strong-arm you, or if their threats carry any real weight.<br>

| Rank | Intimidation Progression Ideas     |
| ---- | ---------------------------------- |
| 0    | You have no real understanding of what scares people. Your unassertive aura means thieves and cutpurses may see you as an easy target. You only know how to intimidate people through verbal or direct physical threats. |
| 1    | You've developed a general understanding of what scares people. You have a look about you, one which discourages some from disturbing you. You are no longer seen as an "easy mark" by local thieves or cutpurses. Additionally, you can demonstrate your capacity for violence or misfortune without using words (such as adopting a menacing pose) which you can use to frighten off others. |
| 5    | Your capacity to scare others is unmatched; you have become a veritable fortress of fear. The "look" you carry with you is enough to stave off almost any threat; only a complete fool would go out of their way to trouble you. Whether through words or actions, your social presence is overwhelming when you choose it to be. You can perform an Intimidation check as a free action once per round, targeting your choice of creatures who can see you, which the chosen creatures must contest with Willpower or become afraid of you. You gain 2 Boons and Reliability on checks made to socially interact with creatures whose Morale is below half. |

1. **Interrogator** - Specialists in the spoken word, knowing how to craft veiled threats to confuse and unsettle.
2. **Ruffian** - Specialists in using physical force as a social implement, who can strongarm others into cooperation.
3. **Fearmonger** - Specialists in drawing out the acute fears and anxieties of their targets, and exploiting that knowledge to torment them.

## Tradecraft Skills

### Animal Handling

Animal Handling is used, quite simply, in the handling of animals. Skill in Animal Handling helps one understand the mindset and habits of beasts, how to coerce, calm, tame, or stave them off, or predict their next move. A well-trained animal handler knows much more general knowledge about animals, and will more easily have understanding of such creatures, to either develop bonds or manipulate.

#### Example Uses

**Tame.** Animal Handling is used in attempts to calm wild beasts, allowing them to be approached, examined, or fed. A hostile beast may be dissuaded from attacking you with a successful Animal Handling check.<br>
**Mount.** You may mount creatures at least one size larger than you, but doing so requires an Animal Handling check.<br>
**Command.** With creatures who are friendly or indifferent to your presence, you can attempt to command them through Animal Handling.<br>
**Recall.** You can try to remember information about a certain kind of animal, such as its usual habitat, appearance, and eating or mating habits.<br>

| Rank | Animal Handling Progression Ideas  |
| ---- | ---------------------------------- |
| 0    | You have no particular way with animals. Most wild beasts are discomforted by your presence and will often either attack or flee from you. You have trouble mounting or controlling a domesticated creature without supervision. You do not know how to command trained animals, and any attempts to control a mount cause them to try and buck you off on a critical fail. |
| 1    | You have learned how to work with various domesticated animals. Wild beasts are still discomforted by your presence, but you can perform Animal Handling checks as an action to calm them or reduce their chance to flee. If a domesticated animal is willing, you can mount them without having to perform an Animal Handling check. You can attempt to calm any beast, but have +3 Banes on rolls to do so if the creature is charmed or otherwise magically compelled to be hostile. |
| 5    | You have endless empathy and understanding for beasts. You can attempt to give direct, simple orders to any beast, provided it is calm. Charm-like effects or other magical compulsions a creature is under do not hinder your attempts to calm or pacify it. |

1. **Knight** - Specialists in taming, caring for, and mounting large creatures.
2. **Beastmaster** - Specialists in befriending many types of animals, to both work and fight alongside them.
3. **Warden** - Specialists in animal treatment, and the secret lore of beasts.

### Craftsmanship

Craftsmanship involves knowledge and artisanship in a particular trade skill. Earning ranks in Craftsmanship indicates the ability to understand a certain profession (or general professions as a whole) and aptitude in creating high-quality goods or performing skillful services. A competent craftsman may be acclaimed for their ability to make quality goods, and knows what they need to get the job done.

#### Example Uses

**Appraise.** You may determine the quality of an item, its approximate value, or the cost to make it using a Craftsmanship check. You can also attempt to determine the defining features of a crafted item, its purpose, or its potential flaws (both functionally and aesthetically).<br>
**Craft.** Creating an item through a trade skill requires a Craftsmanship check, and often requires some prior knowledge to use tools to make such an item.<br>
**Use Tool.** Tools used by artisans will often employ the Craftsmanship skill in checks made to use the tools yourself, whether this is to create items, repair them, or perform any other task.<br>

| Rank | Craftsmanship Progression Ideas    |
| ---- | ---------------------------------- |
| 0    | The knowledge you have in trade skills is largely insubstantial. You may automatically fail tasks that require certain knowledge of a profession. |
| 1    | You are taught in the rudimentary ways of a certain trade skill. Choose one type of tool to become your Favored Tool; you gain +1 Boon to checks made to craft items or carry out other work using a Favored Tool. You can examine an item and automatically know if such an item was, or could be, made or repaired with your Favored Tool. Instead of rolling, you can choose to perform Passive Checks on simple tasks involving your Favored Tool. |
| 5    | You are a world-class craftsman. You are an instant savant with any tool you can get your hands on, and can save time and costs drastically thanks to your ingenuity. All tools are considered Favored Tools to you; you gain +3 Boons to checks made to craft items or carry out other work using a Favored Tool. You can examine an item and automatically know what type of tools were used to make it, or could reasonably be used to repair it. You can craft any non-magical item at half the normal time and supply cost. |

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


| Rank | Medicine Progression Ideas         |
| ---- | ---------------------------------- |
| 0    | You know little about the inner workings of the body, and can generally only guess what is causing a symptom, or how to treat it. You fail Medicine checks made to help determine an effective treatment to an internal injury or infection, but can still make a guess and carry out an impromptu procedure. You cannot determine an organ's purpose you have not dealt with before, or diagnose problems in an organ which are not immediately obvious. You can, however, analyze corpses to determine a cause of death. |
| 1    | You have developed a basic understanding of the body, and general issues or problems related to illness. You can attempt Medicine checks to determine the underlying cause of a symptom, ascertain the purpose of a strange organ, diagnose medical problems, infer an effective treatment, and analyze corpses to determine cause of death. |
| 5    | You are almost infinitely wise in your knowledge of health. When you are within 5 feet of a creature you can see, you can spend an action to instantly recognize which of the following conditions the creature is affected by: Afraid, Blinded, Bleeding, Bloodied, Confused, Diseased, Frozen, Paralyzed, Poisoned, Silenced, Stunned, or Unconscious. If you do so for an entire minute, you instantly know of any diseases or other medical conditions the creature is afflicted by. You can perform this check on corpses to automatically identify which conditions they were suffering as they died. You have +3 Boons on checks made to resist contracting an infection or disease, and on checks made to recover from such a disease. |

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

| Rank | Performance Progression Ideas      |
| ---- | ---------------------------------- |
| 0    | You have next to no experience in any public performance. You have not committed yourself to any particular art form, and cannot reliably recall finer details about any particular art form. You may be considered largely "uncultured" by those who are more familiar with an art form. |
| 1    | You have learned the basics of an art form, and acquired a general understanding of what attracts onlookers to the spectacle of a good performance. You can recall basic information on most common art forms, and can reliably recite common pieces (such as songs, poems, or dances) as part of a performance. |
| 5    | You are a quintessential crowdpleaser, and your performances can move almost anyone who bears witness to your craft. You can sing, dance, perform, and act in manners fit to entertain kings or even gods. Improvising during a performance meant to entertain does not increase the difficulty of the check. |

1. **Musician** - Specialists in performing music, understanding musical lore, and creating blissful harmonies with others.
2. **Artist** - ???
3. **Athlete** - ???


