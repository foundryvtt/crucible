[Back to Home](../README.md)

# Combat Mechanics

During exploration phases of gameplay, players and the Game Master can take turns to act interchangeably in a way that promotes fluid narrative and storytelling, often it is helpful to impose more structure on the sequence of actions and reactions which comprise a scene. This section of the guide generalizes the terminology for such situations as "combat" as battle with enemies is the foremost example, but the following rules could equally apply to other situations when having structured turns and limitations on each character's ability to act would be helpful.

> Other situations in which combat rules could be helpful might include: a chase sequence, an escape scene where the protagonists are attempting to elude pursuers or avoid danger, social encounters which impose additional structure on dialog, tavern games, or even party exploration through a dangerous area.

## Combat Rounds, Turns, and Phases

An overall combat encounter is divided into "Rounds", "Turns", and "Phases". A *Round* refers to a single set of choices made by the characters in the encounter, where each character gets to act in an order defined by their Initiative (described below). Each round loosely represents around 10 seconds of real time, where 6 rounds of combat occur each minute of combat. A *Turn* represents the actions taken by the one character whose turn it is to act in the initiative order. *Phases* are different stages of the the combat encounter and it's rounds which apply certain additional rules.

**FAQ: Why 10 second rounds instead of 6 second rounds?**

>  In systems which utilize 6 second rounds, combat duration often feels unrealistically short - with many combats resolving in under 30 seconds of time. Given the duration of many temporary effects (for example 1 minute) - combats that end in less than 1 minute of elapsed time do not present players with any tradeoff from using temporary abilities -as these abilities do not effectively expire before the end of the combat scenario. A goal of <SYSTEM> is to introduce more tradeoffs into *when* is the right time to use a talent or spell which might not last for the entire battle.

### A Combat Round

| Phase             | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| Initiative Phase  | All participants in the combat roll Initiative for the Round which determines the order in which they act for the round. |
| Preparation Phase | Each participant who is able to react may choose to perform at most one Preparation Action, all of which are announced and occur simultaneously during the Preparation Phase. |
| Action Phase      | Each combatant takes a turn in the order defined by the Initiative rolls for the round. |
| Maintenance Phase | Any combatants using effects which must be maintained face checks to determine whether those effects are maintained during the Maintenance Phase. If these checks are failed, the effect ends at the end of the round and does not carry over into the next round. |

> Regarding the Preparation Phase and the honor system. Since preparation actions are intended to be simultaneous - every combatant should choose privately to themselves which preparation action they are taking and honestly announce it to the table in any order the GM prefers. Sometimes a preparation action taken by one character can be countered by the preparation made by another - it is up to the table to exercise the honor system and honestly declare which preparation action you took. If it is helpful for enforcing honesty, the Game Master could elect to have players announce in initiative order, or to write down their action on a piece of paper to reveal together.

## Initiative and Turn Order

Initiative reflects your character's swiftness of mind and body - corresponding to how quickly you are able to act in a situation where time is of the essence. Your character's initiative during combat is determined by your Dexterity and Intellect attributes, any passive Initiative Bonus you may have, any situational bonus which allows you to react faster than usual, and an element of random chance. Your initiative is determined by:

```
Initiative = 1d10 + (0.5 * (Dexterity + Intelligence)) + Situational Bonus 
		   + Unspent Action Reserves
```

A situational bonus to initiative could result from you getting the drop on an enemy, or benefiting from a magical spell which hastens your reactions, alternatively you could face a situational penalty to initiative if your reactions are dulled or slowed by alchemical or magical effects.

Each round of combat you have a pool of Action Points which you may elect to spend in various ways. If you are not immobilized or incapacitated, any unspent Action Points at the end of each round are automatically converted to Action Reserves which add to your Initiative in the next round.

> Re-rolling initiative every round introduces greater tactical challenge for players who cannot rely completely upon always acting before or after the same foes each round of combat. Being able to convert unspent action points into an initiative bonus in the subsequent round can also promote creative tactical solutions to a variety of combat challenges.

## Actions and Action Points

Your character has a certain number of Action Points (AP) available to them to use each round of combat. This number is typically 3, however certain talents or situations can modify this value to be larger or smaller. Each type of action you take in combat has a certain cost in Action Points associated with it. The table below defines the four types of actions which can be performed during a combat round.

| Action Type | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| Preparation | Actions specifically taken during the Preparation Phase of each combat round. Preparation actions usually do not cost Action Points, but in some rare situations may impose a non-zero cost. You are limited to, at most, a single Preparation Action per combat Round. |
| Action      | Actions taken during the Action Phase of the round are sometimes called "Standard Actions". Regular actions cost Action Points to perform. Most Actions only cost a single Action Point, but some significant actions impose a higher cost, with the most extraordinary feats of skill or magic requiring three or more Action Points to perform. |
| Reaction    | Reactions are taken in response to the Actions of others. Each Reaction has a specific triggering condition which specifies the conditions under which it may be used. Reactions generally do not cost Action Points, but you are limited to, at most, a single Reaction per combat Round. |
| Free        | A Free Action is one that may be taken at any point during the round and does not impose an Action Point cost. |

#### Preparation Actions

The exact set of Preparation Actions available to a character is defined by their purchased Talents. However some general types of Preparation Actions are listed below to provide intuition around what may occur.

| Action                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| Change Fighting Stance | Adjust your combat stance.                                   |
| Begin Channeling       | Begin casting of a channeled spell.                          |
| Stow a Small Item      | Retrieve or stow an item that can be carried in one hand and is not inside a container from your equipment. |
| Declare Contingency    | Declare a specific contingency condition which could trigger a reaction later in the combat round. |
| Choose to Delay        | You may choose to voluntarily reduce your Initiative score for the round by designating another Combatant whom you wish to follow.. Your initiative is adjusted to immediately follow that combatant's initial value. |

#### Standard Actions

| Action            | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| Move              | Various movement actions represented by Stride, Climb, Burrow, Fly, Climb or other means of traversing the environment. |
| Strike            | Attack with the weapon or weapons you are carrying.          |
| Use an Ability    | Use an ability provided through your purchased Talents.      |
| Cast a Spell      | Cast a spell that is not channeled or performed as a reaction. |
| Disengage         | Carefully move 5ft. away from an enemy without provoking an Attack of Opportunity. |
| Manipulate        | You may manipulate an item which requires one or both hands to operate. |
| Use a Skill       | You may elect to use a Skill to acquire knowledge or influence the tide of battle. |
| Hide              | You may attempt to evade detection by hiding following the rules for Stealth and Detection. |
| Guard             | You act defensively, generating a situational bonus to the Physical Defense of either yourself or a guarded ally. |
| Stow a Large Item | Retrieve or stow an item from your equipment which requires two hands or is inside a container. |
| Escape Restraint  | You may attempt to escape restraint, engaging in a contest of Strength or Dexterity against the Strength of your captor or the difficulty of your bonds. |

#### Reactions

| Action                | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| Attack of Opportunity | Attack an enemy who passes through or concentrates upon an ability while in your threatened radius. |
| Counter Attack        | Respond to an attack which was defended through a Dodge, Block, or Parry outcome. |
| Counter Spell         | Respond to the spellcasting efforts of an enemy to counter their magic. |
| Contingency           | Execute upon a declared Contingency when the required condition is met. |

#### Free Actions

| Action            | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| Drop an Item      | Drop an item that you are carrying in your hands.            |
| Say a Phrase      | Shout, speak, or whisper a short phrase no longer than 10 seconds in duration. |
| Cancel Channeling | Stop casting of a channeled spell.                           |
| Release a Spell   | Release the effects of a maintained spell.                   |

### Movement Actions

#### Stride

Your basic movement ability is defined by Stride which represents a distance that you can travel if not restrained or inhibited by difficult or impassible terrain.

#### Dropping or Standing

As part of your movement, you may elect to drop to a Prone state, or stand from a Prone state. This change to your posture costs you half your Stride value and is compounded by other penalties like moving through Difficult Terrain.

#### Crawling while Prone

You may move while Prone, moving at half your Stride and maintaining your Prone status. This penalty to Stride is compounded by other penalties, like moving through Difficult Terrain.

#### Difficult and Impassible Terrain

Moving through Difficult Terrain slows your hero down, either because the footing itself is treacherous or because the terrain features hazards which must be carefully avoided. While moving through difficult terrain your Stride is halved unless otherwise stated.

Impassible Terrain represents obstacles that your character cannot bypass without using some alternative means of mobility like Leaping, Climbing, or Flying.

#### Leaping

As part of a Stride action, you may elect to leap horizontally, vertically, or both. The distance you may leap is given by the following table with increasing distance based on your Strength score. Your level of encumbrance modifies your distance tier downward by a certain number of rows.

| Strength Score | Horizontal Leap | Vertical Leap | Encumbrance  | Leap Penalty |
| -------------- | --------------- | ------------- | ------------ | ------------ |
| 1 to 3         | 5 feet          | 2 feet        | Unencumbered | 0            |
| 4 to 6         | 10 feet         | 5 feet        | Encumbered   | -1 tiers     |
| 7 to 9         | 20 feet         | 10 feet       | Overburdened | -2 tiers     |
| 10 to 12       | 30 feet         | 15 feet       | Immobilized  | May not leap |

For example, a hero with 8 Strength who is Encumbered may leap 10 feet, as if they had a Strength score between 4 and 6. A hero with 11 Strength who is Overburdened may also leap horizontally 10 feet, or vertically 5 feet.

#### Climbing

As part of a Stride action, you may elect to climb a vertically ascending surface which, unless otherwise stated, allows you to move vertically at 1/2 your normal Stride. If the surface being climbed does not have natural handholds, or you are unassisted by climbing tools, the Game Master may require you to perform an Acrobatics Check to ascertain how effectively you are able to scale the surface unaided. If the check is failed you make no progress, and if the check is Critically Failed, you fall during the attempt.

#### Flying

You move through the air up to your allowed Flying speed (this is often different than your Stride). You may gain altitude as if moving through Difficult Terrain (at one half movement). Moving horizontally at a given altitude, or descending in elevation faces no penalty. You may use Flying to hover in place. If you fly through natural means like wings - you must use the Stride (Flying) action each Round otherwise you begin Falling at the end of your turn.

#### Burrowing

Some creatures are able to burrow through the earth, in such cases the creature will have designated a specific Burrow speed which is used in place of it's Stride when moving underground. You are not able to burrow through impassible terrain unless a specific Ability allows it.

#### Mount or Dismount a Steed

You may use a Stride action to either mount or dismount a willing Steed which is at least one size category larger than you. If the steed is unwilling you must face an Animal Handling check with a difficulty ascertained by the Game Master.

#### Falling and Tumbling

Falling does not cost you a Move action, as gravity happens whether you like it or not. For simplicity, assume falling occurs at 200 feet per second, or 1000 feet per round. 

If you are Falling, the distance moved from falling and any resulting impact damage is evaluated at the beginning of your Action Phase, before any other actions (except for Tumble) may be taken. When impacting a hard surface after falling for more than 5 feet, you suffer half the distance of the fall in Bludgeoning damage up to a maximum of 1000 damage.

While evaluating the effects of Falling, a character who is not otherwise restrained or immobilized may spend an Action Point to Tumble, immediately taking an Acrobatics check where the difficulty of the check is equal to the cumulative distance fallen. If successful, no impact damage is taken from the Fall. If the test results in a Critical Success, you may roll upon impact in a direction of your choosing up to 10 feet.