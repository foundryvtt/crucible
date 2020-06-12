[Back to Home](../README.md)

# Dice Mechanics

While <SYSTEM> is designed specifically for virtual tabletop platforms, we use the standard set of role-playing game dice; relying upon 4, 6, 8, 10, 12, and 20-sided dice for various rolls. These dice are referred to as d4, d6, d8, d10, d12, and d20 where a number that precedes the die type (like 4d6) represents the quantity of that die to roll.

> A tenet for the dice mechanics in this system is to, where possible, design first by considering the probability of events and then tailor the dice rolled to appropriately match the target probability distribution.

When your character takes heroic actions within the world, whether they be feats of martial prowess or clever social maneuvers, the outcomes of the attempted action are discovered by rolling dice. There are three general types of dice rolls which are used.

## Standard Checks

In a standard check, the character who takes an action rolls a set of dice, adds bonuses to the roll, and compares the total result against a target value which may or may not be known to the player. More difficult tasks will require a higher target value. For some actions, the amount by which the roll exceeds or fails to meet the target may further determine the extent of the action's effectiveness.

In <SYSTEM> the most commonly used dice formula for making a standard check is:

```
3d8 + Ability Bonus + Skill Bonus + Situational Bonus 
vs. Target Number 
```

**Situation**: *Suppose Silarn - a hero of lacking in scruples and fond of larceny - were to attempt to burgle the local apothecary by pocketing a potion while the shopkeep was not looking. The player, Andrew, would roll 3d8 and add Silarn's character bonuses for Dexterity and for Thievery to the result. Furthermore, a situational bonus might apply depending on whether the attempt were made in especially favorable or unfavorable conditions. In this case, the player rolls 4, 6, and 8, adding a +3 for Dexterity and a +2 for Thievery, resulting in a total roll of 23. The Game Master deems this was a difficult task, as the shopkeeper is accustomed to keeping an eye out for thieves, requiring a roll of 20 or higher to succeed in the attempt. In this situation, Silarn is successful, and the ill-gotten gains are pocketed with the apothecary none the wiser.*

#### Determining Difficulty

The target value which must be surpassed in order for a standard check to be successful depends on the type of check being performed. In many cases specific rules for the type of action being used will specify how the target value is determined. In cases that no specific rule is provided, it is up to the Game Master to subjectively determine the difficulty level of the attempt. The following table provides rough guidance which may be helpful.

| Difficulty Tier | Recommended Target Value |
| --------------- | ------------------------ |
| Trivial         | 10                       |
| Easy            | 15                       |
| Moderate        | 20                       |
| Challenging     | 25                       |
| Difficult       | 30                       |
| Formidable      | 35                       |
| "Impossible"    | 45                       |

> Note that the values in the above table are recommendations only, as a Game Master use your own judgement about what a good target value would be - but discipline yourself to choose the value before your player places the roll - as this is important for player trust. 

Trivial tasks are ones that almost anyone can reasonably perform without an undue risk of failure, while even seemingly impossible tasks could still be overcome by powerful heroes with ample preparation and ideal circumstances.

## Opposed Contests

Sometimes a character's attempted action is in direct opposition to that of another player or character. In such cases both players (or the Game Master) will simultaneously roll using the specified formula, adding any individual Ability Bonus, Skill Bonus, and Situational Bonus which they possess. The total of both rolls are compared against each other and the higher of the two is declared the victor. In some cases the margin of victory may be important for triggering additional effects.

#### Resolving Contest Ties

When an opposed contest results in a tie, the contest is resolved by applying the following rules in order until a resolution is achieved.

1. If the contest is such that one party may be reasonably classified as the attacker or instigator of the action while the other is the defender or recipient of the action - the defender wins in the case of a tie.
2. If both parties are equal challengers in the contest, the player who has the higher bonus (excluding rolled dice) is the winner.
3. If the situation may narratively end in a stalemate the contest concludes with neither party successful in their objective.
4. If it is unreasonable for the contest to end in a stalemate, the contest is re-rolled immediately until a victor is identified.

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

## Passive Checks

In some situations it is either not practical or not advisable to request that players roll dice to perform a test. From a narrative perspective, a Passive Check represents acting instinctively rather than deliberately. A Passive Check may is performed by assuming a result of 12 instead of rolling 3d8.

> For those who are statistically inclined "taking 12" represents a slightly below-average roll, at the 40th percentile of the probability distribution of 3d8. This corresponds to your passive abilities being somewhat less effective than your expected outcome when specifically focusing on a task.

You may still apply situational bonuses or penalties, if applicable, to passive check outcomes.

## Twists of Fate

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

## Additional Mechanics

The following general rules are used for all dice rolling situations.

### Round Up

Occasionally a rolled formula will produce a result that is not an integer. In such cases you should always round up unless otherwise stated.

### Prior Declaration

Certain abilities allow for characters to manipulate fate and chance by altering a dice roll formula. For example an ally could assist a hero with a difficult task - granting an additional die which can be included in the roll. Unless explicitly stated by the ability, any alterations to a roll must be declared before the roll occurs and you may not alter that choice upon seeing the rolled result.

> A key design principle is to avoid mechanics where players can devalue the strategic risk in using certain powerful abilities by choosing whether to employ them after the rest of a roll result is known. This maintains a more tangible risk and reward profile for powerful abilities which can manipulate chance.

### Let it Ride

Heroes test their abilities against powerful foes and difficult challenges. Preparation for these obstacles is key and success is not assured. Even failure, however, can produce interesting and memorable moments. As such, it is important that when when a roll is made, the result of that roll is binding for the specific situation and the check cannot be repeated for the same situation unless the circumstances around the attempt meaningfully change. 

**Situation**: *Suppose our roguish friend Silarn wishes to persuade the local magistrate of his innocence in a case of mistaken identity. Silarn may attempt deception to talk his way out of trouble - but if his dice check is unsuccessful, Silarn must live with that result and determine an alternative path forward. Silarn may not repeat a similar attempt at deception later in the same conversation or even the next day unless circumstances have meaningfully changed. Suppose Silarn or his allies were to plant evidence of the misdeed in the belongings of another suspect, another attempt to deceive the magistrate would be permitted since the conditions for the check have changed.*

> It is left to the Game Master to arbitrate whether conditions have changed enough to permit a re-roll of the same test, however we encourage Game Masters to employ "fail forwards" design wherever possible in order to maximize the value of this rule.

Some abilities explicitly provide an opportunity to re-roll a result; such specific cases are exceptions to this overall ruling.

---