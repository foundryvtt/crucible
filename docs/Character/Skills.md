[Back to Home](../../README.md)

# Character Skills

Skills represent the social, exploration, puzzle-solving, and crafting abilities of a character. Skills describe how talented your character is at accomplishing certain tasks. Each skill has six tiers ranging from Untrained to Grandmaster which reflect the degree of expertise the hero has in that area. The skill tiers are generally described as follows, each yielding the following Skill Bonus and Skill Point cost.

| Rank | Rank Name   | Rank Description                                             | Rank Modifier | Point Cost |
| ---- | ----------- | ------------------------------------------------------------ | ------------- | ---------- |
| 0    | Untrained   | You have no formal training in this area, any success you have is due to luck. | -4            | 0          |
| 1    | Novice      | You have been instructed in the basics of this skill.        | +2            | 1          |
| 2    | Apprentice  | You have practiced and honed your skills to a strong functional degree. | +4            | 1          |
| 3    | Journeyman  | You are a subject matter expert in this area.                | +6            | 2          |
| 4    | Master      | You are a true master of this skill and its techniques.      | +10           | 3          |
| 5    | Grandmaster | You are peerless in your mastery of this area.               | +12           | 4          |

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

## Exploration Skills

#### Survival

Survival represents your ability to operate as a self-sufficient explorer in challenging natural environments, understanding their terrain, flora, fauna, and hazards. Survival experts naturally become adept in dealing with a subset of specific biomes and creature types which offer progression paths for the skill of **Favored Terrain** and **Favored Prey**.

| Rank | Benefits                                                     |
| ---- | ------------------------------------------------------------ |
| 1    | You know basic survival skills. You are able to start fires with flint and tinder, you are able to forage for food and water in most environments, and you can recognize basic environmental hazards. |
| 2    | You are able to recognize and follow the tracks of creatures which you are familiar with if the tracks are discovered.<br />**Progression Path 1:** Select one environmental biome as Favored Terrain, You gain a +2 situational bonus to Skill Checks made when exploring that environment.<br />**Progression Path 2:** Select one naturally occurring creature type as a Favored Prey. You gain a +2 situational bonus to Spell Power and Attack Rolls against this type of creature. |
| 3    | You know advanced survival skills, you are experienced with mountain climbing, underwater diving, spelunking, and other means of exploring difficult environments. You are able to lead groups of less trained individuals through such obstacles, granting a +5 situational bonus to Skill Checks made by allies who do not have this rank of the Survival Skill. |
| 4    | You are able to follow the tracks of a creature that you are not familiar with, even if you do not recognize the tracks.**<br />Progression Path 1:** Select a second environmental biome as Favored Terrain.<br />**Progression Path 2:** Select a second naturally occurring creature type as Favored Prey. |
| 5    | You are a paragon of wilderness exploration and self-sufficiency. You can find food, water, and shelter in even the most inhospitable of environments. You can follow the tracks of any creature, even those you are not familiar with. <br />**Progression Path 1:** Select a third environmental biome as Favored Terrain. Your situational bonus to Skill Checks performed while exploring these environments improves to +5.<br />**Progression Path 2:** Select a third naturally occurring creature type as Favored Prey. Your situational bonus to Spell Power and Attack Rolls against this type of creature improves to +5. |



## Reasoning Skills

a

## Social Skills

a

## Crafting Skills

a

