[Back to Home](../README.md)

# Weapons

There are many different types of weapons which can be wielded.

## Weapon Properties

**Simple**. This weapon type requires no training to use. Simple weapons do not have any skill bonus penalty if used in the absence of training, unlike more advanced weapon types.

**Two-Handed.** This weapon type ordinarily requires the use of both hands in order to wield properly. Cannot be lightweight.

**Light.** This weapon type can be used in one hand and scales with dexterity.

**Heavy.** This weapon is oversized and scales with strength.

**Reach.** This weapon can attack targets at a distance.

**Slow.** Attacks with this weapon cost one additional action point per attack, due to its cumbersome nature or need to be reloaded.

**Thrown.** This weapon is balanced for throwing in addition to being useful in melee combat.

**Vicious**. This weapon can deal grievous wounds and critically hits on attacks that meet Physical Defense + 5, instead of Physical Defense + 6.

## Weapons Table

The following table presents valid weapons which are valid using the rules provided below.

| One-Handed Weapons | Type     | Damage         | Parry | Properties           |
| ------------------ | -------- | -------------- | ----- | -------------------- |
| Shortsword         | Light    | D6 slashing    | +1    | Simple               |
| Xiphos             | Light    | D6 slashing    | +3    |                      |
| Longsword          | Balanced | D8 slashing    | +1    |                      |
| Club               | Balanced | D6 bludgeoning | 0     | Simple               |
| Dagger             | Light    | D4 piercing    | +1    | Simple, Thrown       |
| Sai                | Light    | D6 piercing    | +3    |                      |
| Stiletto           | Light    | D8 piercing    | 0     | Vicious              |
| Rapier             | Light    | D8 piercing    | +2    |                      |
| Sabre              | Heavy    | D8 slashing    | +1    | Vicious              |
| Battleaxe          | Balanced | D8 slashing    | +2    |                      |
| War Axe            | Heavy    | D10 slashing   |       |                      |
| Hatchet            | Light    | D6 slashing    | 0     | Simple, Thrown       |
| Whip               | Light    | D4 slashing    | 0     | Reach (15 ft.), Slow |
| Spear              | Balanced | D6 piercing    | 0     | Reach (10 ft.)       |
| Flail              | Heavy    | D8 piercing    | 0     | Vicious              |
| Mace               | Balanced | D8 bludgeoning | +1    |                      |
| Morningstar        | Balanced | D10 piercing   | 0     |                      |
| Khopesh            | Heavy    | D10 slashing   |       |                      |
| Katana             | Balanced | D8 slashing    | +2    | Vicious              |

| Two-Handed Weapons | Type     | Damage | Parry | Properties              |
| ------------------ | -------- | ------ | ----- | ----------------------- |
| Pike               | Heavy    | D10    | +2    | Reach (10 ft.)          |
| Glaive             | Heavy    | D12    | 0     | Reach (10 ft.), Vicious |
| Greataxe           | Heavy    | D12    | +2    | Vicious                 |
| Spear              | Balanced | D8     | +1    | Reach (10 ft.), Vicious |
| Halberd            | Heavy    | D8     | +3    | Reach (10 ft.)          |
| Quarterstaff       | Balanced | D8     | +4    | Simple                  |
| Bo Staff           | Balanced | D10    | +4    |                         |

| Ranged Weapons      | Type       | Damage | Range   | Properties |
| ------------------- | ---------- | ------ | ------- | ---------- |
| Sling (1h)          | Light      | D4     | 60 ft.  | Simple     |
| Dart (1h)           | Light      | D4     | 30 ft.  | Vicious    |
| Heavy Crossbow (2h) | Mechanical | D12    | 120 ft. | Slow       |
| Longbow (2h)        | Balanced   | D8     | 360 ft. |            |
| Greatbow (2h)       | Heavy      | D10    | 360 ft. | Slow       |
| Shortbow (2h)       | Light      | D8     | 180 ft. |            |

# Rules for Weapon Creation

The following section describes the rules for creating a weapon which is balanced in relation to other weapon types.



## Weapon Type

| Weapon Type   | Power Modifier | Attack Scaling             | Rarity |
| ------------- | -------------- | -------------------------- | ------ |
| Simple (1h)   | 1              | Strength                   | 0      |
| Light (1h)    | 1              | Dexterity                  | 0      |
| Balanced (1h) | 2              | (Strength + Dexterity) / 2 | 0      |
| Martial (1h)  | 3              | Strength                   | 0      |
| Simple (2h)   | 3              | Strength                   | 0      |
| Balanced (2h) | 4              | (Strength + Dexterity) / 2 | 0      |
| Martial (2h)  | 5              | Strength                   | 0      |

## Quality Tier

| Tier Name  | Power Modifier | Rarity |
| ---------- | -------------- | ------ |
| Broken     | -2             | 0      |
| Shoddy     | -1             | 0      |
| Mundane    | 0              | 0      |
| Fine       | 1              | 1      |
| Superior   | 2              | 2      |
| Masterwork | 3              | 3      |
| Exquisite  | 4              | 4      |
| Legendary  | 5              | 5      |

## Enchantment Level

A weapon may have an enchantment level which increases its power modifier and attack bonus; a mundane weapon has no bonus.

## Special Properties

| Property  | Effect                                                       | Rarity |
| --------- | ------------------------------------------------------------ | ------ |
| Oversized | Increase number of dice by 1, and decrease denomination of dice by 1, weapon is *slow* |        |
| Keen      | Reduces the weapon's critical hit threshold by 1.            | 1      |
| Parrying  | Grants between +1 and +3 Parry Defense                       | #Parry |
| Reliable  | Increase number of dice by 1 and decrease denomination of dice by 2 | 1      |
| Reach     | Increases weapon range by #                                  |        |
| Ambush    | Weapon can be easily concealed. Weapon is *fast*             |        |

### Power resolution order:

1. Weapon Type
2. Special Properties
3. Quality Tier
4. Enchantment Level

|         | **1** | **2** | **3** | **4** |
| ------- | ----- | ----- | ----- | ----- |
| **d4**  | 2.5   |       |       |       |
| **d6**  | 3.5   | 7     |       |       |
| **d8**  | 4.5   | 9     | 13.5  |       |
| **d10** | 5.5   | 11    | 16.5  | 22    |
| **d12** | 6.5   | 13    | 19.5  | 26    |









### Step 1. Determine the point pool for the weapon. 

Each weapon type begins with 5 points to spend. The number of points is modified by the following table:

| Weapon Type       | Points / Modifier |
| ----------------- | ----------------- |
| Starting pool     | +5 points         |
| Two-handed weapon | +4 points         |
| Simple weapon     | -2 points         |

### Step 2. Purchase weapon attributes.

Spend the allowed pool of points by purchasing weapon attributes from the following table.

| Attribute                | Point Cost        |
| ------------------------ | ----------------- |
| D4 damage scaling        | 1 points          |
| D6 damage scaling        | 2 points          |
| D8 damage scaling        | 3 point           |
| D10 damage scaling       | 5 points          |
| D12 damage scaling       | 6 points          |
| Parry Defense            | 1 point per parry |
| Melee Reach (10 ft.)     | 3 points          |
| Melee Reach (15 ft.)     | 5 points          |
| Thrown (30 ft.)          | 1 point           |
| Projectile Range 30 ft.  | 1 point           |
| Projectile Range 60 ft.  | 2 points          |
| Projectile Range 120 ft. | 3 points          |
| Projectile Range 180 ft. | 4 points          |
| Projectile Range 360 ft. | 5 points          |
| Slow                     | -1 point          |
| Vicious                  | 1 point           |

### Step 3. Determine Attack Scaling

| Weapon Type | Scaling Formula           | Point Cost | Max. Damage |
| ----------- | ------------------------- | ---------- | ----------- |
| Lightweight | DEX                       | 1 point    | D6          |
| Balanced    | (0.5 * STR) + (0.5 * DEX) | 0          | D10         |
| Heavy       | STR                       | 1 point    | D12         |
| Mechanical  | DEX                       | 2 points   | D12         |







