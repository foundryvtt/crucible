## Physical Defense

Physical Defense (PD) represents your ability to avoid damage from physical sources like a weapon or projectile. Weapon attacks, certain offensive Talents, and kinetic Spells all target Physical Defense which has four components:

#### Dodge

Your dodge value represents your ability to avoid an attack by quickly moving out of the way. Your Dodge defense is calculated as:

```
Dodge = Dexterity + Dodge Bonus + Situational Bonus
```

#### Parry

Your parry value represents your ability to deflect an attack by countering it with your own weapon or shield. Your Parry defense is calculated as:

```
Parry = (Strength / 2) + Parry Bonus + Situational Bonus
```

#### Block

Your Block value represents your ability to deflect an attack by using a physical or arcane shield. Your Block defense is calculated as:

```
Block = (Constitution / 2) + Block Bonus + Situational Bonus
```

#### Armor

Your armor value represents your ability to withstand an attack that otherwise bypasses your dodge and parry. Your Armor defense is calculated as:

```
Armor = Armor Value + Armor Bonus + Situational Bonus
```

Different categories of worn armor provide different levels of protection and different ability to dodge while using it.

| Armor Type   | Armor Value | Maximum Dodge | Required Strength |
| ------------ | ----------- | ------------- | ----------------- |
| Unarmored    | 0           | Unlimited     | Any               |
| Light Armor  | 4           | 12            | Any               |
| Medium Armor | 8           | 4             | 13                |
| Heavy Armor  | 16          | 0             | 17                |

Furthermore, equipped items may grant bonuses to Dodge, Parry, or Armor values, but remember - these bonuses do not stack. See the section on [Magical Item Effects](../Items/Magical.md) for clarification.

#### Total Physical Defense

Your total Physical Defense score is the sum of your Dodge, Parry, and Armor values in that order.

```
Physical Defense = Dodge + Parry + Block + Armor
```

**Situation**: *Suppose Silarn, our elusive rogue is beset by a gang of ruffians wielding clubs. Silarn has a Dexterity of 7 and a Strength of 4. He is wearing an enchanted suit of Leather Armor (light) which provides an Armor Value of 4, allows a maximum Dodge bonus up to 12, and provides a magical Dodge Bonus of +2. Furthermore, Silarn's trusty Rapier provides a Parry Bonus of +3. Without any additional situational bonuses, Silarn's Physical Defense is calculated as:*

```
Physical Defense = 9 (Dodge) + 5 (Parry) + 0 (Block) + 4 (Armor) = 19
```

The components of this formula define what happens when an attack roll is placed against a target. If the Attack Roll is less than or equal to the target’s Physical Defense the attack is defended and the manner of defense is determined by the range of each component. Alternatively, if the Attack Roll is greater than the Physical Defense score, the target is struck by the attack and suffers damage from the blow. Lastly, if the Attack Roll exceeds the Physical Defense score by more than 5, the attack counts as a Critical Hit.

| Greater Than          | Less Than or Equal To         | Result                            |
| --------------------- | ----------------------------- | --------------------------------- |
| 0                     | Dodge                         | The attack is dodged!             |
| Dodge                 | Dodge + Parry                 | The attack is parried!            |
| Dodge + Parry         | Dodge + Parry + Block         | The attack is blocked!            |
| Dodge + Parry + Block | Dodge + Parry + Block + Armor | The attack is averted by armor.   |
| Physical Defense      | Physical Defense + 5          | The attack scores a normal hit.   |
| Physical Defense + 5  |                               | The attack scores a critical hit. |

**Situation**: *Returning to our previous situation, the gang of four ruffians all strike at Silarn with their cudgels. The thugs' attack rolls are 6, 13, 19, and 22. Silarn dodges the first attack, parries the second blow, is protected from the third attack by his armor, but is struck by the fourth attack which would result in damage dealt to Silarn's current Wounds.*

An alternative way to visualize the Physical Defense resolution data is with a PD table (which is how the data is displayed on a character sheet). In Silarn's case:

| Dodge | Parry | Block | Armor | Hit   | Critical Hit |
| ----- | ----- | ----- | ----- | ----- | ------------ |
| 0-9   | 10-14 | -     | 15-19 | 20-24 | 25+          |

### Physical Defense Situational Bonuses

A situational bonus to your defense is applied when you are in an advantageous or disadvantageous defensive position, for example protected by a magical spell (advantageous), or surrounded by enemies (disadvantageous). Different situations may add bonuses or impose penalties to your Dodge, your Parry, or your Armor score. For example:

* If you are heavily obscured by dense fog, it would grant a major situational bonus to your Dodge.
* If you benefit from a magical effect which allows you to react with greater alacrity, it would grant a major situational bonus to your Parry.
* If you are behind heavy cover, it would grant a major situational bonus to your Armor.

Situational bonuses and their magnitude may be applied at the Dungeon Master’s discretion. The table below presents several standard bonuses which are commonly applied. 

| Situational Bonus Type<br />(Example)                        | Bonus Amount |
| ------------------------------------------------------------ | ------------ |
| **Minor Bonus.** The character is in a position which provides some moderate advantage to their execution of the check.<br />*(Example - Partial Cover)* If the target is behind hard cover which shields between 25% and 75% of their form from the perspective of the attacker. | +2 Bonus     |
| **Major Bonus.** The character is in a position which provides some major advantage to their execution of the check.<br />*(Example - Heavy Cover)* If the target is behind hard cover which shields more than 75% of their form from the perspective of the attacker they benefit from a major bonus to their Physical Defense. | +5 Bonus     |
| **Minor Penalty.** The character is in a position where they suffer some moderate disadvantage to their execution of a check.<br />*(Example - Flanked)* If a character is adjacent to two or more enemies on opposite sides, they are considered Flanked and suffer a -2 penalty to their Physical Defense. | -2 Penalty   |
| **Major Penalty**. The character is in a position where they suffer some major disadvantage to their execution of a check.<br />*(Example - Surrounded)* If a character is adjacent to three or more enemies on three sides, they are considered Surrounded and suffer a -5 penalty to their Physical Defense. | -5 Penalty   |

> As a Game Master, you should identify creative opportunities to apply situational bonuses to the Physical and Magical Defense of characters and enemies. Allow your players to suggest conditions which may give them such a bonus, or impose a penalty on their foes.

---

## Arcane Defense

Arcane Defense (AD) represents your ability to resist or avoid damage or other negative effects from arcane or environmental sources like elemental Spells, traps and hazards, or diseases and poisons. Such effects target Arcane Defense which has three types:

## Willpower and Contests of Resolve

**Willpower** represents a character or creature’s ability to exert the mental presence necessary to inflict or resist an effect which is psychological in nature. 

```
Willpower Defense = Wisdom + (0.5 * Charisma) + Situational Bonus
```

When a Spell or Talent targets a creature's Willpower it triggers a **Contest of Resolve** which is resolved as follows. 

* Both attacker and defender simultaneously roll a d10. The attacker adds their Spell Power while the defender adds their Willpower Defense to the result. This is repeated up to three times and the contest is won by whichever entity wins 2 of the 3 rounds.
* For the first round of the contest, both attacker and defender roll a d10. Each subsequent round, the winner of the previous round adds 2 sides to their die and the loser subtracts 2 sides from theirs. In the second round of the contest, the first round winner rolls a d12 and the first round loser rolls a d8.
* If a round results in a tie the round is repeated but both attacker and defender reset to rolling a d10.

## Fortitude and Contests of Endurance

**Fortitude** represents a character or creature’s ability to withstand hardship which afflicts the body. 

```
Fortitude Defense = Constitution + (0.5 * Strength) + Situational Bonus
```

When a Spell or Talent targets a creature's Fortitude it triggers a **Contest of Endurance** which is resolved as follows: <TODO>

## Reflex and Contests of Avoidance

**Reflex** represents a character or creature’s ability to respond with quickness of thought and action to avoid hazards and threats.

```
Reflex Defense = Dexterity + (0.5 * Intellect) + Situational Bonus
```

When a Spell or Talent targets a creature's Reflex it triggers a **Contest of Reflex** which is resolved as follows: <TODO>