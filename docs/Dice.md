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

### Determining Difficulty

The target value which must be surpassed in order for a standard check to be successful depends on the type of check being performed. In many cases specific rules for the type of action being used will specify how the target value is determined. In cases that no specific rule is provided, it is up to the Game Master to subjectively determine the difficulty level of the attempt. The following table provides rough guidance which may be helpful.

| Difficulty Tier | Recommended Target Value |
| --------------- | ------------------------ |
| Trivial         | 5                        |
| Easy            | 10                       |
| Moderate        | 15                       |
| Challenging     | 20                       |
| Difficult       | 25                       |
| Formidable      | 30                       |
| "Impossible"    | 40                       |

> Note that the values in the above table are recommendations only, as a Game Master use your own judgement about what a good target value would be - but discipline yourself to choose the value before your player places the roll - as this is important for player trust. 

Trivial tasks are ones that almost anyone can reasonably perform without an undue risk of failure, while even seemingly impossible tasks could still be overcome by powerful heroes with ample preparation and ideal circumstances.

## Opposed Contests

Sometimes a character's attempted action is in direct opposition to that of another player or character. In such cases both players (or the Game Master) will simultaneously roll using the specified formula, adding any individual Ability Bonus, Skill Bonus, and Situational Bonus which they possess. The total of both rolls are compared against each other and the higher of the two is declared the victor. In some cases the margin of victory may be important for triggering additional effects.

### Resolving Contest Ties

When an opposed contest results in a tie, the contest is resolved by applying the following rules in order until a resolution is achieved.

1. If the contest is such that one party may be reasonably classified as the attacker or instigator of the action while the other is the defender or recipient of the action - the defender wins in the case of a tie.
2. If both parties are equal challengers in the contest, the player who has the higher bonus (excluding rolled dice) is the winner.
3. If the situation may narratively end in a stalemate the contest concludes with neither party successful in their objective.
4. If it is unreasonable for the contest to end in a stalemate, the contest is re-rolled immediately until a victor is identified.

## Accumulation Checks

Some situations in the game call for a check to see how the influence of some effect waxes or wanes over time. Such situations range from the psychological strain placed on heroes when exposed to otherworldly horrors or the collection of applied experience towards the development of a new skill.

Accumulation Checks pertain to attributes or resources which are tracked for each player character, when rolling such a check the result of the rolled formula is added (or sometimes subtracted) from the prior value and the new total is recorded.

## Passive Checks

In some situations it is either not practical or not advisable to request that players roll dice to perform a test. From a narrative perspective, a Passive Check represents acting instinctively rather than deliberately. A Passive Check may is performed by assuming a result of 12 instead of rolling 3d8.

> For those who are statistically inclined "taking 12" represents a slightly below-average roll, at the 40th percentile of the probability distribution of 3d8. This corresponds to your passive abilities being somewhat less effective than your expected outcome when specifically focusing on a task.

You may still apply situational bonuses or penalties, if applicable, to passive check outcomes.

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