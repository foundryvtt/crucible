# Weapon Attacks
## Weapon Attack Rolls
A weapon attack roll is made by performing a standard check tested against the physical defense value of the target. 

```
Attack Roll = 3d8[Boons/Banes] + Ability Modifier + Skill Bonus + Enchantment Bonus
```

The 3d8 dice pool is modified by **Boons** and **Banes**. The ability modifier for the attack roll is determined by the scaling formula of the weapon type being used. The Skill Bonus for the attack roll is determined by the character's training in that particular weapon type. The Enchantment Bonus for the roll is determined by the magical properties (if any) of the weapon being used.

The attack is a hit if the result of the Attack Roll exceeds the Physical Defense value of the target. If the result of the attack roll is less than the Physical Defense value, the attack misses and the nature of the miss is determined by the component defense scores of the target creature.

## Overflow and Damage
The amount by which the Attack Roll exceeded the Physical Defense value is sometimes called "Overflow". This Overflow amount, plus damage bonuses and minus any target resistance becomes the total damage applied from the attack.

```
Overflow = Attack Roll - Physical Defense
Damage = ((Overflow + Damage Bonus) * Damage Multiplier) - Target Resistance
```

Any amount of Damage Resistance that the target possesses is used to reduce the amount of damage dealt by the attack - although damage cannot be mitigated entirely. Any attack that surpasses its target defense will always deal at least one point of damage.

Typically, physical damage (bludgeoning, slashing, or piercing) from weapon attacks target (and reduce) a creature's Health - however in some rare circumstances weapon attacks may target Morale instead.
