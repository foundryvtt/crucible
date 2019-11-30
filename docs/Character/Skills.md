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

## Skill Progression Paths

As each skill is progressed to the Apprentice tier and beyond, you will choose between multiple progression paths which further specialize your investment in the skill. The paths are mutually exclusive, and your progression path may not be changed without first reducing the specialization tier in a skill back to the Novice tier.

## Skill Respecialization

If you advance an entire character level or one year of time without using a certain skill, you may choose to reduce your level of specialization in that skill by one tier, returning the corresponding number of skill points into your available pool. From a narrative perspective, this represents the process of atrophy by which certain skills might lose their sharpness over time. Mechanically, this offers players with a means of reshaping their skill allocation over time should they desire to do so.

## Exploration Skills

#### Acrobatics

...

1. **Gymnast** - Specialists in acrobatic maneuvers which escape harm or tumble safely from great heights.  
2. **Climber** - Specialists in rapidly scaling vertical obstacles whether they be natural or urban.
3. **Dancer** - Specialists in the art of dance, from the ballroom to the mesmerizing contortions of a street performer.

#### Perception

...

1. **Scout** - Specialists in discovering the path forward and hidden ways which were concealed.
2. **Sentry** - Specialists in the assessment of threats, an expert Sentry is never caught unaware.
3. **Empath** - Specialists in the understanding of people, reading their physical and emotional tells.

#### Stealth

Stealth is used to advance unnoticed and gain access to areas which are otherwise inaccessible. Stealth adepts can develop expertise in infiltration, lockpicking, or thievery. Stealth offers three choices of progression paths.

1. **Infiltrator** - Specialists in moving unseen and silent to bypass danger or approach it unaware.
2. **Safecracker** - Specialists in the cracking of mechanical locks and disarming mechanical traps.
3. **Pickpocket** - Specialists in the acquisition of property by removing it from the possession of the less deserving.

#### Survival

Survival represents your ability to operate as a self-sufficient explorer in challenging natural environments, understanding their terrain, flora, fauna, and hazards. Survival adepts can develop expertise in dealing with a subset of specific biomes, creature types, or natural resources. Survival offers three choices of progression paths.

1. **Explorer** - Specialists in exploration and navigation of challenging environmental obstacles.
2. **Hunter** - Specialists in the tracking and hunting of creatures.
3. **Herbalist** - Specialists in the identification and harvesting of herbs and reagents.

| Rank | Benefits                                                     |
| ---- | ------------------------------------------------------------ |
| 1    | You know basic survival skills. You are able to start fires with flint and tinder, you are able to spend time foraging for food and water in most environments, and you can recognize common environmental hazards. You are able to recognize and follow the tracks of creatures which you are familiar with if the tracks are discovered. |
| 2    | **Explorer:** Select one environmental biome as Favored Terrain, You gain a +2 situational bonus to Skill Checks made when exploring that environment.<br />**Hunter:** Select one naturally occurring creature type as a Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against this type of creature.<br />**Herbalist:** You are knowledgeable in common herblore, are able to recognize useful herbs in the wild. You may spend time during a rest to attempt a Potion Brewing crafting check. |
| 3    | You know advanced survival skills, you are experienced with mountain climbing, underwater diving, spelunking, and other methods of exploring difficult environments. You can guide groups of allies through such obstacles, granting a +2 situational bonus to Skill Checks made by allies who do not have this tier of the Survival Skill.<br />You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks. You can attempt to forage for food and water without slowing your normal pace of travel. |
| 4    | **Explorer:** Select a second environmental biome as Favored Terrain.<br />**Hunter:** Select a second naturally occurring creature type as Favored Prey.<br />**Herbalist:** Your studies of advanced herblore have made you familiar with toxins and venoms which you can extract from plants and creatures. You may spend time during a rest to attempt a crafting check to create Poisons. |
| 5    | You are a paragon of wilderness exploration and self-sufficiency. You can find food, water, and shelter in even the most inhospitable of environments. Once you find the tracks of a creature the quarry cannot elude you by non-magical means.<br />**Explorer:** Select a third environmental biome as Favored Terrain. Your situational bonus to Skill Checks performed while exploring these environments improves to +5. You gain a situational bonus of +2 while exploring non-favored biomes.<br />**Hunter:** Select a third naturally occurring creature type as Favored Prey. Your situational bonus to Spell Power and Attack Rolls against this type of creature improves to +5. You gain a situational bonus of +2 when attacking non-favored naturally occurring creatures.<br />**Herbalist:** You always succeed in brewing Potions or Poisons provided you have the ingredients and your efforts produce double the quantity of output. You know forbidden arts of creating odorless and tasteless poisons from rare ingredients. |

## Knowledge Skills

#### Arcana

1. **Diviner** - Specialists in understanding the nature of magic and reading the arcane aura of others.
2. **Elementalist** - Specialists in manipulating elemental energies to harness or ward their power.
3. **Enchanter** - Specialists in infusing arcane potency into physical objects to create items of great power.

#### Religion

1. Theologian
2. Crusader
3. Druid

#### Investigation

1. Detective
2. Spy
3. Tinkerer

#### Lore

1. Scholar
2. Historian
3. Storyteller

## Social Skills

#### Diplomacy

#### Intimidation

1. 

#### Deception

1. **Grifter** - Specialists in falsifying information through subtlety and confidence.
2. **Illusionist** - Specialists in sensory illusions, generally mundane but occasionally arcane in nature.
3. **Mesmer** - Specialists in the use of mind-altering alchemy and magic to transform enemies in to allies.

#### Bartering

1. **Antiquarian** - Specialists in the procurement and identification of ancient or eclectic items.
2. **Caravaner** - Specialists in mercantilism and the transportation of goods.
3. **Negotiator** - Specialists in haggling and compromise to arrange favorable terms in negotiation.

## Tradecraft Skills

#### Animal Handling

1. Knight
2. Beastmaster
3. Warden

#### Craftsmanship

1. Trademaster
2. Artificer
3. Runekeeper

#### Medicine

1. Apothecary
2. Chirugeon
3. Occultist

#### Performance

1. Musician
2. Artist
3. Athlete





