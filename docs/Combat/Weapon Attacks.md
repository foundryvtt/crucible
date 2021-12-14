# Weapon Attacks
A weapon attack roll is made by performing a standard check tested against the physical defense value of the target. 

```
Attack Roll = 3d8 + Attack Modifier + Attack Bonuses
```

The attack is a hit if it exceeds the Physical Defense value of the target. 

## Overflow and Damage
The amount by which the Attack Roll exceeded the Physical Defense value is sometimes called "Overflow". This Overflow amount, plus damage bonuses and minus any target resistance becomes the total damage applied from the attack.

```
Overflow = Attack Roll - Physical Defense
Damage = ((Overflow + Damage Bonus) * Damage Multiplier) - Target Resistance
```

Any damage resistance that the target possesses is used to reduce the amount of damage dealt by the attack - although damage cannot be mitigated entirely and reduced below one.

Most physical damage is applied to Health, although in some rare occasions damage can be applied against Morale instead.
