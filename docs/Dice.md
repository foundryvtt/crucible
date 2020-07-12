[Back to Home](../README.md)

# Dice Mechanics

While <SYSTEM> is designed specifically for virtual tabletop platforms, we use the standard set of role-playing game dice; relying upon 4, 6, 8, 10, 12, and 20-sided dice for various rolls. These dice are referred to as d4, d6, d8, d10, d12, and d20 where a number that precedes the die type (like 4d6) represents the quantity of that die to roll.

> A tenet for the dice mechanics in this system is to, where possible, design first by considering the probability of events and then tailor the dice rolled to appropriately match the target probability distribution.

When your character takes heroic actions within the world, whether they be feats of martial prowess or clever social maneuvers, the outcomes of the attempted action are discovered by rolling dice.

## The Dice Pool

The majority of rolls to determine an outcome in <SYSTEM> use a **3d8** dice pool. Depending on the purpose of the roll, various bonus modifiers are then added to the dice pool to determine the final result of the roll.
For player characters, rolls may involve adding ability scores or skill bonuses as modifiers to a 3d8 roll. Such a roll is considered a Standard Check, and is the most common type of roll made by a character.

## Boons & Banes

A goblin desperately thrusts at an armored human with its damaged, dull blade. An enchanter wishes to haggle with a merchant she has magically charmed. A soldier swings his hammer at the head of a dazed, concussed ogre. When performing a check, a character may find some circumstances shift the odds in their favor. By the same token, other circumstances will hinder a character's chances of success. These situations may be represented as **boons** and **banes**, respectively. The number of boons and banes to be applied to a roll are both determined before a roll is made, as they directly affect the size of the dice rolled. A single dice pool roll can have no more than 6 boons and 6 banes affecting it.

For each **boon** on a roll, add a **+1** modifier to the roll, and increase the number of sides on the *first* die in the pool by 2, up to a maximum of 12. If a die is already a d12 due to boons, increase the size of the next die by 2 instead. In a sense, boons upgrade dice, starting from the first die, towards the last.

For each **bane** on a roll, add a **-1** modifier to the roll, and decrease the number of sides on the *last* die in the pool by 2, to a minimum of 4. If a die is already a d4 due to banes, decrease the size of the previous die by 2 instead. In this way, banes will downgrade dice, starting from the last die, progressing backwards toward the first.

Because boons and banes start at opposite ends of the dice pool, they can both make visible changes in the same roll. However, with a great number of boons and banes, they can begin increasing/decreasing the same die.

**Situation:** *Suppose Albert, a naval captain, has had his ship boarded by pirates. By fortunate circumstance, the fierce rocking of the ship has toppled one of the invaders over on the deck of his ship. Advancing towards the sprawling pirate, he draws his blade and slashes down at the unwelcome guest. Attacking such a prone creature confers 2 boons to his attack roll. This upgrades the first die in his 3d8 dice pool twice, from an d8 to a d12, resulting in a dice pool of 1d12 + 2d8. Additionally, each boon gives him a flat +1 modifier to his roll, resulting in a +2 modifier to this attack roll. On top of his +5 Strength Ability Bonus and +6 Skill Bonus in using the sword, his attack roll becomes a 1d12 + 2d8 + 13.*

Some situations may benefit from boons and banes simultaneously, and allow for varying degrees of advantage/disadvantage.

**Situation:** *Dariel is a practicing outdoorswoman - with Journeyman rank in Survival with a Herbalist specialization. Suppose she wishes to identify a herb that may be used to treat poison, after a long and arduous day of traveling through the forests. Her specialization as a Herbalist gives her +1 boon to her roll made to identify the herb, but her state of exhaustion gives her +2 banes to her roll. The boon upgrades the first die in the 3d8 dice pool to a 1d10, and the two banes downgrade the third die to a d4, resulting in a dice pool of 1d10 + 1d8 + 1d4. Additionally, with each boon giving a flat +1 modifier, and each bane giving a flat -1 modifier, there is a net -1 modifier to the attack roll. On top of her +6 Ability bonus (an average between her Constitution and Survival), and a +6 Survival Skill Bonus, the roll for the Survival check becomes a 1d12 + 1d8 + 1d4 + 11.*

> Game Masters should note that in regards to mathematically expected outcomes, each boon will increase the average result by 2, and each each bane will decrease the average result by 2.

## Standard Checks

In a standard check, the character who takes an action rolls a set of dice, adds bonuses to the roll, and compares the total result against a target value which may or may not be known to the player. More difficult tasks will require a higher target value. For some actions, the amount by which the roll exceeds or fails to meet the target may further determine the extent of the action's effectiveness.

In <SYSTEM> the most commonly used dice formula for making a standard check is:

```
3d8 Dice Pool + Ability Bonus + Skill Bonus + Enchantment Bonus 
vs. Target Value
```

## Bonuses
The Ability Bonus, Skill Bonus, and Enchantment Bonus referenced in the above formula are separate concepts, which may each be taken into consideration when making a roll.

An **Ability Bonus** is derived from the ability scores related to that roll. It represents the character's natural ability to perform the desired action. In rolls where only one ability score is applicable, this bonus is simply the ability score itself. However, rolls may have an Ability Bonus that uses multiple ability scores, typically through averaging them together.

A **Skill Bonus** represents a character's expertise and accumulated knowledge that could help them perform the action better. When performing an action that tests knowledge in a skill, the skill bonus is determined by how many ranks the character has in that particular skill. For weapon attacks, the skill bonus is from their training in using that particular type of weapon.

Finally, the **Enchantment Bonus** reflects circumstantial, magical factors that can change the outcome of a roll. By default, the Enchantment Bonus is 0, but some talents, spells or magical items can grant an Enchantment bonus on certain rolls. Similarly, a creature's chances of succeeding on a check can be hindered by applying a negative Enchantment bonus to a roll. If a character is affected by multiple sources of magic, the Enchantment Bonus is the sum of all bonuses from all magical effects that would apply to this roll. This bonus has a maximum of +6.

**Situation**: *Suppose Irzi - a bold ex-town guard hoping to save a victim of an evil ogre's kidnapping - sought to climb a steep cliffside to follow the ogre's trail. The player, Melody, would roll 3d8 and add Irzi's character bonuses for Acrobatics to the result. Furthermore, a situational bonus might apply depending on whether the attempt was made in esepcially favorable or unfavorable conditions. Suppose Irzi had a recent, untreated ankle injury that hindered her ability to climb, adding 2 banes to her roll, reducing one of her dice pool's d8s to a d4. In this case, the player rolls two d8s and one d4, resulting in 6, 8, and 3, adding a +5 for her ability bonus (an average of her Strength and Dexterity scores), and a +4 for her Acrobatics skill, resulting in a total roll of 26. The Game Master deems this was a moderately difficult task, as the cliff was slippery and with few footholds, requiring a roll of 25 or higher to succeed in the attempt. In this situation, Irzi is successful, managing to safely scale the cliff and continuing her pursuit of the kidnapper.*

In this example, the roll uses a bonuses from an applicable skill. Refer to the [Skills](./Character/Skills.md) article for information on skills checks, the ability scores they use, and skill bonuses.

#### Determining Difficulty

The target value which must be surpassed in order for a standard check to be successful depends on the type of check being performed. In many cases specific rules for the type of action being used will specify how the target value is determined. In cases that no specific rule is provided, it is up to the Game Master to subjectively determine the difficulty level of the attempt. The following table provides rough guidance which may be helpful.

| Difficulty Tier | Recommended Target Value |
| --------------- | ------------------------ |
| Trivial         | 1-12                     |
| Easy            | 13-18                    |
| Moderate        | 19-30                    |
| Difficult       | 31-42                    |
| Formidable      | 43-48                    |
| "Impossible"    | 49+                      |

> Note that the values in the above table are recommendations only, as a Game Master use your own judgement about what a good target value would be - but discipline yourself to choose the value before your player places the roll - as this is important for player trust. 

Trivial tasks are ones that almost anyone can reasonably perform with a marginal risk of failure, while even seemingly impossible tasks could still be overcome by powerful heroes with ample preparation and ideal circumstances.

## Opposed Contests

Sometimes a character's attempted action is in direct opposition to that of another player or character. In such cases both players (or the Game Master) will simultaneously roll using the specified formula, adding any individual bonuses which they possess. The total of both rolls are compared against each other and the higher of the two is declared the victor. In some cases the margin of victory may be important for triggering additional effects.

**Situation**: *Suppose Silarn - a hero of lacking in scruples and fond of larceny - were to attempt to burgle the local apothecary by pocketing a potion while the shopkeep was not looking. The player, Andrew, would roll 3d8 and add Silarn's character bonuses for Stealth to the result. Furthermore, a situational bonus might apply depending on whether the attempt was made in especially favorable or unfavorable conditions. In this case, the player rolls 5, 5, and 2, adding a +5 for his ability bonus (an average of his Dexterity and Wisdom scores), and a +4 for his Stealth skill bonus, resulting in a total roll of 21. The Game Master may then roll for the shopkeeper, who is accustomed to keeping an eye out for thieves. The Game Master rolls 3d8 and adds the shopkeeper's Perception bonus to the result. Suppose the Game Master rolls a 4, 2, and 7, adding a +2 for Perception, resulting in a total roll of 15. In this situation, Silarn's 21 beats the shopkeep's 15; Silarn is successful, and the ill-gotten gains are pocketed with the apothecary none the wiser.*

#### Resolving Contest Ties

When an opposed contest results in a tie, the contest is resolved by applying the following rules in order until a resolution is achieved.

1. If the contest is such that one party may be reasonably classified as the attacker or instigator of the action while the other is the defender or recipient of the action - the defender wins in the case of a tie.
2. If both parties are equal challengers in the contest, the player who has the higher bonus (excluding rolled dice) is the winner.
3. If the situation may narratively end in a stalemate the contest concludes with neither party successful in their objective.
4. If it is unreasonable for the contest to end in a stalemate, the contest is re-rolled immediately until a victor is identified.

## Passive Checks

In some situations it is either not practical or not advisable to request that players roll dice to perform a test. From a narrative perspective, a Passive Check represents acting instinctively rather than deliberately. A Passive Check may is performed by assuming a result of 12 instead of rolling 3d8.

> For those who are statistically inclined: "taking 12" represents a slightly below-average roll, at the 40th percentile of the probability distribution of 3d8. This corresponds to your passive abilities being somewhat less effective than your expected outcome when specifically focusing on a task.

You may still apply situational bonuses or penalties, if applicable, to passive check outcomes. As no die are rolled for a passive check, boons each give +1 to a passive check, while banes each give -1 to a passive check.

> In regards to statistics: A boon or bane's effect on a passive check reflects its average effect to a standard roll.

## Additional Mechanics

The following general rules are used for all dice rolling situations.

### Round Up

Occasionally a rolled formula will produce a result that is not an integer. In such cases you should always round up unless otherwise stated.

### Prior Declaration

Certain abilities allow for characters to manipulate fate and chance by altering a dice roll formula. For example an ally could assist a hero with a difficult task - granting an additional die which can be included in the roll. Unless explicitly stated by the ability, any alterations to a roll must be declared before the roll occurs and you may not alter that choice upon seeing the rolled result.
In particular, boons and banes should be declared before a roll, and should never be added to a roll after that roll was made.

> A key design principle is to avoid mechanics where players can devalue the strategic risk in using certain powerful abilities by choosing whether to employ them after the rest of a roll result is known. This maintains a more tangible risk and reward profile for powerful abilities which can manipulate chance.

### Let it Ride

Heroes test their abilities against powerful foes and difficult challenges. Preparation for these obstacles is key and success is not assured. Even failure, however, can produce interesting and memorable moments. As such, it is important that when when a roll is made, the result of that roll is binding for the specific situation and the check cannot be repeated for the same situation unless the circumstances around the attempt meaningfully change. 

**Situation**: *Suppose our roguish friend Silarn wishes to persuade the local magistrate of his innocence in a case of mistaken identity. Silarn may attempt deception to talk his way out of trouble - but if his dice check is unsuccessful, Silarn must live with that result and determine an alternative path forward. Silarn may not repeat a similar attempt at deception later in the same conversation or even the next day unless circumstances have meaningfully changed. Suppose Silarn or his allies were to plant evidence of the misdeed in the belongings of another suspect, another attempt to deceive the magistrate would be permitted since the conditions for the check have changed.*

> It is left to the Game Master to arbitrate whether conditions have changed enough to permit a re-roll of the same test, however we encourage Game Masters to employ "fail forwards" design wherever possible in order to maximize the value of this rule.

Some abilities explicitly provide an opportunity to re-roll a result; such specific cases are exceptions to this overall ruling.


# ~ WIP BELOW THIS POINT ~

## Group Challenges

Sometimes a situation will require the cooperation of every party member in order to overcome a non-combat obstacle. In such cases the Gamemaster may elect to conduct a Group Challenge in which every party member must employ a Skill which can assist in overcoming the challenge. 

> Note that for some party challenges the Gamemaster may simply tell the players which Skill is being tested. For example if the group is trying to collectively negotiate a trade deal - the Gamemaster might require a test of **Bartering**, while if the party is attempting to scale a rugged cliff face, the players might be each offered a choice between **Acrobatics** and **Survival**. In open-ended cases, simply ask each player to choose a Skill and describe how they attempt to use it.

For each player's nominated skill and before dice are rolled the Gamemaster secretly determines the Difficulty Rating of each test, following the **Determining Difficulty** section above. 

> When determining difficulty, the Gamemaster may choose a different difficulty threshold for different skills - for example ascending the cliff using Survival might be somewhat easier than climbing using Acrobatics - but the difficulty threshold should be the same for all players for the same Skill (before situational modifiers).

When the challenge begins, all players roll their Skill Checks privately, and do not reveal their rolled results until all players have rolled. After all checks have been rolled and results revealed, each player may activate any ability which allows them to force a reroll should they have such an ability available.

> At the Gamemaster's discretion and if narratively appropriate, players should be allowed to expend limited-use abilities like Spells which could plausibly assist them during the challenge. Such abilities must be declared before the initial roll is made. Depending on the effectiveness of the abilities used, the Gamemaster may allow for situational bonuses to be added to the rolls for some or all players. 

Once any re-rolls have been performed the Gamemaster determines the overall success of the challenge as follows: each check which surpassed its target Difficulty Rating counts as one success, a roll which exceeds the target by more than 5 counts as 2 successes, a roll which is more than 5 below the target counts as two failures. Count the total number of successes and compare that number to the following Group Challenge table:

#### Group Challenge Difficulty Table

| Challenge Difficulty | Number of Successes Required for Party of Size *N* |
| -------------------- | -------------------------------------------------- |
| Easy                 | (N / 2) - 1                                        |
| Moderate             | (N / 2)                                            |
| Challenging          | N - 1                                              |
| Formidable           | N                                                  |
| Impossible           | N + 1                                              |

> Note that the group challenge difficulty does not have to mirror the Difficulty Rating of each individual Skill check that is part of the challenge. An elaborate heist plan which requires the simultaneous coordination of all party members might be collectively a Formidable challenge even if each individual's component of the plan is only Challenging.

Once the outcome of the challenge has been determined it is final and cannot be modified by any further rolls or abilities. The Gamemaster describes the narrative implications of that outcome as well as any complications or serendipities which arise from challenge success or failure.

## Accumulation Checks

Some situations in the game call for a check to see how the influence of some effect waxes or wanes over time. Such situations range from the psychological strain placed on heroes when exposed to otherworldly horrors or the collection of applied experience towards the development of a new skill.

Accumulation Checks pertain to attributes or resources which are tracked for each player character, when rolling such a check the result of the rolled formula is added (or sometimes subtracted) from the prior value and the new total is recorded.

## Random Chance

Sometimes there is no alternative suitable mechanic to use to determine an outcome, in such cases it is perfectly acceptable to use random chance to resolve the situation. This can be as simple as flipping a coin, but we recommend the following dice mechanics:

#### Twists of Fate

Roll a 1d100 and consult the following table of consequences. When possible, adjudicate the consequence of the twist of fate from the perspective of the protagonists. Complications result in unfortunate setbacks, while serendipities result in fortunate outcomes.

| Rolled Result | Consequence                                                  |
| ------------- | ------------------------------------------------------------ |
| 1-5           | **A disastrous complication.** Within the realm of plausibility, the worst-case-scenario has occurred which thwarts the goals of the protagonists. |
| 6-40          | **An unfortunate complication.** Determine a setback which is directly opposed to the goals of the protagonists. The lower the rolled number the more challenging the setback. |
| 51-60         | **A side effect.** Determine a complication which is not immediately opposed to the goals of the protagonists, but changes the current scenario. |
| 61-95         | **A serendipitous circumstance.** Determine a serendipity which is favorable towards the goals of the protagonists. The higher the rolled number, the more advantageous the boon. |
| 96-100        | **A wondrous boon.** Within the realm of plausibility, the best-case scenario has occurred which furthers the goals of the protagonists. |

#### Scatter Dice

Sometimes you will need to figure out a random direction that a creature, group, or object moves in. Roll two dice where the first die (the "scatter die") represents the direction and the second die (the "distance die") represents the distance scattered.

* If playing on a square grid, roll **1d10** for the direction where a result of 1 or 10 is a direct hit (no movement) and results 2 through 9 proceed clockwise from North.
* If playing on a hexagonal grid, roll **1d8** for the direction where results of 1 and 8 are direct hits (no movement) and results 2 through 9 proceed clockwise from North.

For the distance die, roll a **1d8** where a result of 8 results in a direct hit, a roll of 3 through 7 results in one space, and a roll of 1 or 2 results in 2 spaces scattered.

> For example, suppose a trebuchet lobs a flaming boulder at our hero's squadron of fighters and we are playing on a square grid. The Gamemaster rolls **1d10, 1d8** and produces results of **5** and **2**. As a result the boulder lands two grid spaces southeast of the target.

---