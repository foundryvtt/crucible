[Back to Home](../README.md)

# Weapons

There are many different types of weapons which can be wielded.

## Weapons Table

The following table presents valid weapons which are valid using the rules provided below.

| One-Handed Weapons | Type     | Damage Type | Properties        |
| ------------------ | -------- | ----------- | ----------------- |
| Kukri              | Light    | Slashing    | Parrying          |
| Shortsword         | Balanced | Slashing    |                   |
| Longsword          | Heavy    | Slashing    | Versatile         |
| Bastard Sword      | Massive  | Slashing    | Versatile, Slow   |
| Club               | Simple   | Bludgeoning |                   |
| Hammer             | Balanced | Bludgeoning |                   |
| Morningstar        | Heavy    | Bludgeoning | Versatile         |
| War Hammer         | Massive  | Bludgeoning | Versatile, Slow   |
| Dagger             | Light    | Piercing    | Ambush            |
| Sai                | Light    | Piercing    | Parrying          |
| Rapier             | Balanced | Piercing    |                   |
| Spear              | Balanced | Piercing    | Versatile, Thrown |
| Mattock            | Heavy    | Piercing    |                   |
| Hatchet            | Simple   | Slashing    | Parrying          |
| Battle Axe         | Heavy    | Slashing    |                   |
| War Axe            | Massive  | Slashing    | Versatile, Slow   |
| Whip               | Light    | Slashing    | Reach, Grasping   |
| Scimitar           | Balanced | Slashing    |                   |
| Sabre              | Heavy    | Slashing    |                   |

| Two-Handed Weapons | Type     | Damage Type | Properties |
| ------------------ | -------- | ----------- | ---------- |
| Glaive             | Balanced | Slashing    | Reach      |
| Greatsword         | Heavy    | Slashing    |            |
| Halberd            | Heavy    | Slashing    | Reach      |
| Pike               | Heavy    | Piercing    | Reach      |
| Quarterstaff       | Balanced | Bludgeoning | Blocking   |
| Greatclub          | Simple   | Bludgeoning |            |
| Woodsman Axe       | Simple   | Slashing    |            |
| Greataxe           | Heavy    | Slashing    |            |
| Great Hammer       | Heavy    | Bludgeoning |            |
| Lance              | Massive  | Piercing    | Slow       |

| Ranged Weapons | Type            | Damage Type | Properties |
| -------------- | --------------- | ----------- | ---------- |
| Shortbow       | Projectile      | Piercing    |            |
| Longbow        | Projectile      | Piercing    | Reach      |
| Dart           | Light           | Piercing    | Thrown     |
| Throwing Axe   | Balanced        | Slashing    | Thrown     |
| Shuriken       | Light           | Slashing    | Thrown     |
| Crossbow       | Mechanical (1h) | Piercing    | Reload     |
| Heavy Crossbow | Mechanical (2h) | Piercing    | Reload     |

# Rules for Weapon Creation

The following section describes the rules for creating a weapon which is balanced in relation to other weapon types.

1. Identify the weapon category
2. Identify the weapon quality tier
3. Identify the weapon enchantment level (if any)
4. Add any special properties

## Weapon Category

The weapon type describes its physical format and complexity of usage. Different weapon types use different scaling formulae for determining their attack roll, while more demanding weaponry generates a larger base damage formula.

| One-Handed Melee | Attack Scaling             | Damage Bonus  | Damage Multiplier | AP Cost |
| ---------------- | -------------------------- | ------------- | ----------------- | ------- |
| Light (1h)       | Dexterity                  | 0 			| 					| 1       |
| Simple (1h)      | Strength                   | 0 			| 					| 1       |
| Balanced (1h)    | (Strength + Dexterity) / 2 | +1            | 					| 1       | 
| Heavy (1h)       | Strength                   | +2            | 					| 1       |  
| Massive (1h)     | Strength                   | +2            | x2				| 2       |

| Two-Handed Melee | Attack Scaling             | Damage Bonus  | Damage Multiplier | AP Cost |
| ---------------- | -------------------------- | ------------- | ----------------- | ------- |
| Simple (2h)      | Strength                   | 0             | x2                | 2       |
| Balanced (2h)    | (Strength + Dexterity) / 2 | +1            | x2                | 2       |
| Heavy (2h)       | Strength                   | +2            | x2                | 2       |
| Massive (2h)     | Strength                   | +2            | x3                | 3       |

| Ranged           | Attack Scaling             | Damage Bonus  | Damage Multiplier | AP Cost |
| ---------------- | -------------------------- | ------------- | ----------------- | ------- |
| Projectile (2h)  | (Strength + Dexterity) / 2  | 0            | x2                | 2       |
| Mechanical (1h)  | Dexterity                   | 0            |                   | 2       |
| Mechanical (2h)  | Dexterity                   | 0            | x2                | 2       |

For weapon types marked (*) please see corresponding Special Properties below.

## Quality Tier

A weapon has a quality tier which describes the quality of its construction and materials.

| Tier Name  | Attack Bonus | Rarity Modifier |
| ---------- | ------------ | --------------- |
| Shoddy     | -1           | 0               |
| Standard   | 0            | 0               |
| Fine       | +1           | +1              |
| Superior   | +2           | +2              |
| Masterwork | +3           | +3              |

## Enchantment Tier

A weapon may have an enchantment tier which increases its power modifier and attack bonus.


| Tier Name | Attack Bonus | Rarity Modifier |
| --------- | ------------ | --------------- |
| Mundane   | 0            | 0               |
| Minor     | +1           | +2              |
| Major     | +2           | +4              |
| Legendary | +3           | +6              |

## Special Properties

Some weapons may have one (or in very rare cases multiple) of the following special properties.

| Property  | Effect                                                       |      |
| --------- | ------------------------------------------------------------ | ---- |
| Massive   | This weapon is oversized and cumbersome. You suffer 2 banes to initiative and cannot make reactions. | 0    |
| Reach     | This weapon has twice the normal attack range, decrease denomination of dice by 2 | 0    |
| Parrying  | Grants +2 Parry defense, decrease denomination of dice by 2  | 0    |
| Versatile | This one-handed weapon may be used with two-hands, increasing its denomination by +2 | 0    |
| Blocking  | Grants +2 Block defense, decrease denomination of dice by 2  | 0    |
| Thrown    | This melee weapon can also be thrown as a ranged weapon      | 0    |
| Keen      | Reduces the weapon's critical hit threshold by 1.            | +1   |
| Ambush    | This Light weapon can be easily concealed and can be drawn quickly. The weapon can be drawn for free during your own turn or as part of a reaction. | +1   |
| Grasping  | Critical hits cause the target to become grappled.           | +1   |

### Blocking
A blocking weapon provides Block defense equal to 2 plus 2 times the Enchantment bonus as long as that weapon is 
not broken.

### Parrying
A parrying weapon provides Parry defense equal to 1 plus the Enchantment bonus as long as that weapon is not broken.
