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

## Exploration Skills

### Acrobatics

...

1. **Gymnast** - Specialists in acrobatic maneuvers which escape harm or tumble safely from great heights.  
2. **Climber** - Specialists in rapidly scaling vertical obstacles whether they be natural or urban.
3. **Dancer** - Specialists in the art of dance, from the ballroom to the mesmerizing contortions of a street performer.

### Perception

...

1. **Scout** - Specialists in discovering the path forward and hidden ways which were concealed.
2. **Sentry** - Specialists in the assessment of threats, an expert Sentry is never caught unaware.
3. **Empath** - Specialists in the understanding of people, reading their physical and emotional tells.

### Stealth

Stealth is used to advance unnoticed and gain access to areas which are otherwise inaccessible. Stealth adepts can develop expertise in infiltration, lockpicking, or thievery. Stealth offers three choices of progression paths.

1. **Infiltrator** - Specialists in moving unseen and silent to bypass danger or approach it unaware.
2. **Safecracker** - Specialists in the cracking of mechanical locks and disarming mechanical traps.
3. **Pickpocket** - Specialists in the acquisition of property by removing it from the possession of the less deserving.

### Survival

Survival represents your ability to operate as a self-sufficient explorer in challenging natural environments, understanding their terrain, flora, fauna, and hazards. Survival adepts can develop expertise in dealing with a subset of specific biomes, creature types, or natural resources. 

| Rank | Survival Skill Progression                                   |
| ---- | ------------------------------------------------------------ |
| 1    | You know basic survival skills. You are able to start fires with flint and tinder, you are able to spend time foraging for food and water in most environments, and you can recognize common environmental hazards. You are able to recognize and follow the tracks of creatures which you are familiar with if the tracks are discovered. |
| 2    | **Choose a progression path.**                               |
| 3    | You know advanced survival skills. You can attempt to forage for food, water, and shelter without slowing your pace of travel. You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks. You are experienced with mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them a +2 situational bonus on any Skill Checks made by allies who accompany you. |
| 4    | **Upgrade your progression path.**                           |
| 5    | You are a paragon of wilderness survival and self-sufficiency. You can reliably forage for food, water, and shelter in even inhospitable or foreign environments. You are an expert tracker, once you find the tracks of a creature it cannot elude you by any ordinary means. You are a master of mountain climbing, underwater diving, spelunking, and other means of traversing difficult environments. You can guide groups of allies through such obstacles, granting them a +5 situational bonus on any Skill Checks made by allies who accompany you.<br />**Complete your progression path.** |

The progression paths available to the Survival skill are listed below.

| Path (Rank)   | Progression Path Benefits                                    |
| ------------- | ------------------------------------------------------------ |
| **Explorer**  | Specialists in exploration and navigation of challenging environmental obstacles. |
| Rank 2        | Select one environmental biome as Favored Terrain, You gain a +2 situational bonus to Skill Checks regarding the exploration or knowledge of that environment. You can guide groups of allies through such obstacles, granting them a +2 situational bonus on any Skill Checks made by allies who accompany you. |
| Rank 4        | Select two environmental biomes as Favored Terrain, You gain a +2 situational bonus to Skill Checks made regarding the exploration or knowledge of those environments. |
| Rank 5        | Select three environmental biomes as Favored Terrain. You gain a +5 situational bonus to Skill Checks made regarding the exploration or knowledge of those environments and a +2 situational bonus for non-favored biomes. |
| **Hunter**    | Specialists in the tracking and hunting of creatures.        |
| Rank 2        | Select one naturally occurring creature type as a Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against this type of creature. |
| Rank 4        | Select two naturally occurring creature types as Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against creatures of those types. |
| Rank 5        | Select three naturally occurring creature types as Favored Prey. You gain a +5 situational bonus to Spell Power and Attack Rolls against creatures of those types and you gain a situational bonus +2 when attacking non-favored naturally occurring creatures. |
| **Herbalist** | Specialists in the knowledge, identification, and usage of naturally growing plants and reagents. |
| Rank 2        | You are knowledgeable in common herblore, are able to recognize useful herbs in the wild, and you may devote time during a rest to attempt a Potion Brewing crafting check with a +2 bonus using gathered ingredients. |
| Rank 4        | You are knowledgeable in advanced herblore, are able to recognize both common and rare herbs in the wild. You are familiar with toxins and venom which can be extracted from plants and creatures. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +2 bonus. |
| Rank 5        | You are a master of herblore and are able to recognize any useful herb, reagent, toxin, or venom in the wild. You may devote time during a rest to attempt a crafting check for Potion Brewing or Poison Making with a +5 bonus. If successful, you produce double the normal quantity of output. You know forbidden arts of creating odorless and tasteless poisons using rare ingredients. |

## Knowledge Skills

### Arcana

Arcana deals with the properties and perception of the weave of magical energies. This current of arcane potentia can be studied, manipulated, and harnessed by those with sufficient knowledge and willpower. Skill in Arcana represents your understanding of the theory and application of magic. Learned arcanists can develop expertise in the reading the arcane weave, manipulating elemental energies, or infusing arcane potentia into physical objects.

| Rank | Arcana Skill Progression                                     |
| ---- | ------------------------------------------------------------ |
| 1    | You have a functional comprehension of magical theory and you have developed an ability to perceive and read the weave of magic which flows around you. You are able to cast spells and you can recognize when another spellcaster is channeling magical energy. You may attempt a Skill Check to identify the nature of a spell. |
| 2    | **Choose a progression path.**                               |
| 3    | You have an advanced comprehension of magical theory and you can more deeply read the weave of magic which flows around you. You are able to cast powerful spells and you can learn the final amount of damage dealt by your own spells after resistances and vulnerabilities have been applied. |
| 4    | **Upgrade your progression path.**                           |
| 5    | You are a among the world's foremost arcane minds and the reading of the arcane weave has become second-nature to you. You can immediately identify any spell that you can also cast or you may attempt a Skill Check to identify a spell you do not know yourself without consuming any Action. You are able to cast the most powerful tier of magical spell and you can discern the value of a foe's Arcane Defense attribute after they have been engaged in a contest.<br /> **Complete your progression path.** |

The progression paths available to the Survival skill are listed below.

| Path (Rank)      | Progression Path Benefits                                    |
| ---------------- | ------------------------------------------------------------ |
| **Diviner**      | Specialists in understanding the nature of magic and reading the arcane aura of others. |
| Rank 2           | You gain a +2 situational bonus on Skill Checks to identify the nature of a spell or a magically imbued item. |
| Rank 4           | You gain a +5 situational bonus on Skill Checks to identify the nature of a spell or magically imbued item. You gain a +2 situational bonus to your Spell Power when attempting to dispel an existing spell or counter an enemy spellcaster if you have identified the spell being used. |
| Rank 5           | You can immediately and automatically identify the nature of a spell or a magically imbued item. You gain a +5 situational bonus to Spell Power when attempting to dispel an existing spell or counter an enemy spellcaster. |
| **Elementalist** | Specialists in manipulating elemental energies to harness or ward their power. |
| Rank 2           | Select one elemental damage type as your Favored Element. You gain a Damage Resistance of 5 to that element and +2 to damage when rolling at least one damage die of this type. |
| Rank 4           | Select a second elemental damage type as a Favored Element. You gain a Damage Resistance of 5 to both elements and +4 to damage when rolling at least one damage die of either type. |
| Rank 5           | All elements are your Favored Element. You have Damage Resistance of 5 to all elements and +6 to damage when rolling at least one elemental damage die. |
| **Enchanter**    | Specialists in infusing arcane potency into physical objects to create items of great power. |
| Rank 2           | You know how to imbue minor magical effects into nonmagical items. You may attempt a crafting check to Enchant an item with the effects of a spell that you can cast. |
| Rank 4           | You know how to imbue major magical effects into both magical and nonmagical items. You may attempt a crafting check to Enchant an item with the effects of a spell that you can cast. You may attempt to upgrade an existing magical item by adding a new effect if the item has available enchantment capacity. |
| Rank 5           | You are a master of arcane infusion and you can imbue any spell which you can cast into an item. You are able to add new effects to an item if it has available enchantment capacity and you can remove existing magical effects from an item, freeing the item's enchantment capacity for further infusion. |

### Religion

1. Theologian
2. Crusader
3. Druid

### Investigation

1. Detective
2. Spy
3. Tinkerer

### Lore

1. Scholar
2. Historian
3. Storyteller

## Social Skills

### Diplomacy

### Intimidation

### Deception

Deception deals with using misinformation to subtly or overtly mislead others - causing them to make incorrect assumptions or draw erroneous conclusions. Skill in Deception represents your ability to lie, trick, manipulate, or otherwise act in a disingenuous way. Skilled deceivers can develop expertise in manipulating the flow of information, in tricking the senses through illusion, or in infiltrating the very minds of their enemies.

| Rank | Deception Skill Progression                                  |
| ---- | ------------------------------------------------------------ |
| 1    | You are able to lie with a straight face and without obvious tells. You have a basic understanding of manipulation and you understand what ploys or falsehoods are likely to be believed. You are able to craft false documents which do not rely upon specific handwriting or an identifying seal. You know the basics of disguise artistry, and are able to conceal your identity using a costume which you have prepared in advance. |
| 2    | **Choose a progression path.**                               |
| 3    | You are an accomplished liar, able to invent plausible scenarios on the fly. You have an advanced understanding of manipulation and automatically succeed on any deception check with a DC of 15 or less. You are able to create false documents, including impersonating handwriting or an official seal if you have a sample to imitate. You are an accomplished disguise artist, and may attempt to conceal your identity by using an improvised costume using materials at hand. |
| 4    | **Upgrade your progression path.**                           |
| 5    | You are a master manipulator - it is near impossible to tell whether you are telling the truth. You have a comprehensive understanding of how to manipulate others. You automatically succeed on any deception check with a DC of 25 or less. You are a master forger, able to create false documents including handwriting or official seals which are indistinguishable from the original. You are a peerless disguise artist and are able to exactly imitate the appearance of a  different person if you have the time and materials needed to prepare a disguise. You have a +5 Situational Bonus to Deception Checks which use an improvised disguise. <br /> **Complete your progression path.** |

The progression paths available to the Deception skill are listed below.

| Path (Rank)     | Progression Path Benefits                                    |
| --------------- | ------------------------------------------------------------ |
| **Grifter**     | Specialists in distributing misleading information through subtlety and false confidence. |
| Rank 2          | You have a knack for predicting which falsehoods could be believable. If you attempt a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach at most once per social encounter. |
| Rank 4          | You have expertise in predicting which falsehoods could be believable. If you attempt a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach at most twice per social encounter. You are able to remember any lies you have told within the past month. |
| Rank 5          | You have mastery in predicting which falsehoods could be believable. If you are ever face a Deception Check of Impossible difficulty the Game Master must inform you before you roll and you may choose to alter your approach. You are able to remember any lies you have told within the past year. You are able to correctly conjecture what an official document would look like even if you have not seen it. |
| **Illusionist** | Specialists in sensory illusions, generally mundane but occasionally arcane in nature. |
| Rank 2          | You are an expert in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer a -2 situational penalty for Skill Checks to avoid being misled by the distraction. You have a +2 situational bonus to recognize illusory magic created by other spellcasters. |
| Rank 4          | You are a master of using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others suffer a -5 situational penalty for Skill Checks to avoid being misled by the distraction. You have a +5 situational bonus to recognize illusory magic created by other spellcasters. |
| Rank 5          | You are peerless in using firecrackers, flash powders, smoke bombs, or illusory magic to cause distractions. Others automatically fail their first attempt to avoid being misled by your distraction and suffer a -5 situational penalty for subsequent Skill Checks. You can immediately recognize the presence of illusory magic created by other spellcasters. |
| **Mesmer**      | Specialists in mind-altering alchemy and magic to transform enemies into allies. |
| Rank 2          | You have studied the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 minute of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. You have a +2 situational bonus to Willpower Defense against charm-like effects. |
| Rank 4          | You have refined the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 3 rounds of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer a -2 situational bonus to their Willpower Defense against charm-like effects. You have a +5 situational bonus to Willpower Defense against charm-like effects. |
| Rank 5          | You have perfected the arts of hypnosis and mesmerization and you can use these tools to entrance or deceive. You can spend 1 round of uninterrupted time to hypnotize a humanoid creature if it is willing or fails a Contest of Willpower against you. Enemies suffer a -5 situational bonus to their Willpower Defense against charm-like effects. You are immune to charm-like effects. |

> NOTES: Illusionist and Mesmer require some further refinement.

### Bartering

1. **Antiquarian** - Specialists in the procurement and identification of ancient or eclectic items.
2. **Caravaner** - Specialists in mercantilism and the transportation of goods.
3. **Negotiator** - Specialists in haggling and compromise to arrange favorable terms in negotiation.

## Tradecraft Skills

### Animal Handling

1. Knight
2. Beastmaster
3. Warden

### Craftsmanship

1. Trademaster
2. Artificer
3. Runekeeper

### Medicine

1. Apothecary
2. Chirugeon
3. Occultist

### Performance

1. Musician
2. Artist
3. Athlete





