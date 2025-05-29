
const ORIGIN = [
  {id: "origin", type: "origin", tier: "root", abilities: ["dexterity", "toughness", "strength", "wisdom", "presence", "intellect"], connected: []}
];

const TIER_0 = [
  {id: "dex0a", abilities: ["dexterity"], type: "training", connected: ["origin"]},
  {id: "dex0b", abilities: ["dexterity"], type: "utility", connected: ["origin"]},
  {id: "tou0a", abilities: ["toughness"], type: "training", connected: ["origin"]},
  {id: "tou0b", abilities: ["toughness"], type: "utility", connected: ["origin"]},
  {id: "str0a", abilities: ["strength"], type: "utility", connected: ["origin"]},
  {id: "str0b", abilities: ["strength"], type: "training", connected: ["origin"]},
  {id: "wis0a", abilities: ["wisdom"], type: "training", connected: ["origin"]},
  {id: "wis0b", abilities: ["wisdom"], type: "spell", connected: ["origin"], style: "hex"},
  {id: "pre0a", abilities: ["presence"], type: "training", connected: ["origin"]},
  {id: "pre0b", abilities: ["presence"], type: "spell", connected: ["origin"], style: "hex"},
  {id: "int0a", abilities: ["intellect"], type: "spell", connected: ["origin"], style: "hex"},
  {id: "int0b", abilities: ["intellect"], type: "training", connected: ["origin"]}
];

const TIER_1A = [
  {id: "dex1a", abilities: ["dexterity"], type: "ranged", connected: ["dex0a", "dex0b"]},
  {id: "dex1b", abilities: ["dexterity"], type: "melee", connected: ["dex0a", "dex0b", "dex1a"]},
  {id: "tou1a", abilities: ["toughness"], type: "melee", connected: ["tou0a", "tou0b"]},
  {id: "tou1b", abilities: ["toughness"], type: "defense", connected: ["tou0a", "tou0b", "tou1a"]},
  {id: "str1a", abilities: ["strength"], type: "melee", connected: ["str0a", "str0b"]},
  {id: "str1b", abilities: ["strength"], type: "melee", connected: ["str0a", "str0b", "str1a"]},
  {id: "wis1a", abilities: ["wisdom"], type: "skill", connected: ["wis0a", "wis0b"]},
  {id: "wis1b", abilities: ["wisdom"], type: "spell", connected: ["wis0a", "wis0b", "wis1a"]},
  {id: "pre1a", abilities: ["presence"], type: "skill", connected: ["pre0a", "pre0b"]},
  {id: "pre1b", abilities: ["presence"], type: "spell", connected: ["pre0a", "pre0b", "pre1a"]},
  {id: "int1a", abilities: ["intellect"], type: "spell", connected: ["int0a", "int0b"]},
  {id: "int1b", abilities: ["intellect"], type: "skill", connected: ["int0a", "int0b", "int1a"]}
];

const TIER_1B = [
  {id: "intdex1", abilities: ["intellect", "dexterity"], type: "attack", connected: ["int1b", "dex1a"]},
  {id: "dextou1", abilities: ["dexterity", "toughness"], type: "move", connected: ["dex1b", "tou1a"]},
  {id: "toustr1", abilities: ["toughness", "strength"], type: "move", connected: ["tou1b", "str1a"]},
  {id: "strwis1", abilities: ["strength", "wisdom"], type: "melee", connected: ["str1b", "wis1a"]},
  {id: "wispre1", abilities: ["wisdom", "presence"], type: "magic", connected: ["wis1b", "pre1a"]},
  {id: "preint1", abilities: ["presence", "intellect"], type: "magic", connected: ["pre1b", "int1a"]}
];

const TIER_2A = [
  {id: "dex2a", abilities: ["dexterity"], type: "utility", connected: ["dex1a"]},
  {id: "dex2b", abilities: ["dexterity"], type: "spell", connected: ["dex1a", "dex1b", "dex2a"]},
  {id: "dex2c", abilities: ["dexterity"], type: "defense", connected: ["dex1b", "dex2b"]},
  {id: "tou2a", abilities: ["toughness"], type: "melee", connected: ["tou1a"]},
  {id: "tou2b", abilities: ["toughness"], type: "spell", connected: ["tou1a", "tou1b", "tou2a"]},
  {id: "tou2c", abilities: ["toughness"], type: "utility", connected: ["tou1b", "tou2b"]},
  {id: "str2a", abilities: ["strength"], type: "melee", connected: ["str1a"]},
  {id: "str2b", abilities: ["strength"], type: "spell", connected: ["str1a", "str1b", "str2a"]},
  {id: "str2c", abilities: ["strength"], type: "utility", connected: ["str1b", "str2b"]},
  {id: "wis2a", abilities: ["wisdom"], type: "defense", connected: ["wis1a"]},
  {id: "wis2b", abilities: ["wisdom"], type: "utility", connected: ["wis1a", "wis1b", "wis2a"]},
  {id: "wis2c", abilities: ["wisdom"], type: "heal", connected: ["wis1b", "wis2b"]},
  {id: "pre2a", abilities: ["presence"], type: "defense", connected: ["pre1a"]},
  {id: "pre2b", abilities: ["presence"], type: "spell", connected: ["pre1a", "pre1b", "pre2a"]},
  {id: "pre2c", abilities: ["presence"], type: "skill", connected: ["pre1b", "pre2b"]},
  {id: "int2a", abilities: ["intellect"], type: "skill", connected: ["int1a"]},
  {id: "int2b", abilities: ["intellect"], type: "magic", connected: ["int1a", "int1b", "int2a"]},
  {id: "int2c", abilities: ["intellect"], type: "utility", connected: ["int1b", "int2b"]}
];

const TIER_2B = [
  {id: "intdex2", abilities: ["intellect", "dexterity"], type: "utility", connected: ["intdex1", "int2c", "dex2a"]},
  {id: "dextou2", abilities: ["dexterity", "toughness"], type: "utility", connected: ["dextou1", "dex2c", "tou2a"]},
  {id: "toustr2", abilities: ["toughness", "strength"], type: "defense", connected: ["toustr1", "tou2c", "str2a"]},
  {id: "strwis2", abilities: ["strength", "wisdom"], type: "utility", connected: ["strwis1", "str2c", "wis2a"]},
  {id: "wispre2", abilities: ["wisdom", "presence"], type: "spell", connected: ["wispre1", "wis2c", "pre2a"]},
  {id: "preint2", abilities: ["presence", "intellect"], type: "spell", connected: ["preint1", "pre2c", "int2a"]}
];

const TIER_3A = [
  {id: "dex3a", type: "ranged", abilities: ["dexterity"], tier: 6, connected: ["intdex2", "dex2a", "dex2b"]},
  {id: "dex3b", type: "move", abilities: ["dexterity"], tier: 6, connected: ["dex2b", "dex2c", "dextou2"]},
  {id: "tou3a", type: "defense", abilities: ["toughness"], tier: 6, connected: ["dextou2", "tou2a", "tou2b"]},
  {id: "tou3b", type: "defense", abilities: ["toughness"], tier: 6, connected: ["tou2b", "tou2c", "toustr2"]},
  {id: "str3a", type: "melee", abilities: ["strength"], tier: 6, connected: ["toustr2", "str2a", "str2b"]},
  {id: "str3b", type: "melee", abilities: ["strength"], tier: 6, connected: ["str2b", "str2c", "strwis2"]},
  {id: "wis3a", type: "magic", abilities: ["wisdom"], tier: 6, connected: ["strwis2", "wis2a", "wis2b"]},
  {id: "wis3b", type: "spell", abilities: ["wisdom"], tier: 6, connected: ["wis2b", "wis2c", "wispre2"]},
  {id: "pre3a", type: "utility", abilities: ["presence"], tier: 6, connected: ["wispre2", "pre2a", "pre2b"]},
  {id: "pre3b", type: "spell", abilities: ["presence"], tier: 6, connected: ["pre2b", "pre2c", "preint2"]},
  {id: "int3a", type: "spell", abilities: ["intellect"], tier: 6, connected: ["preint2", "int2a", "int2b"]},
  {id: "int3b", type: "utility", abilities: ["intellect"], tier: 6, connected: ["int2b", "int2c", "intdex2"]}
];

const TIER_3B = [
  {id: "sig3.dexterity", type: "signature", abilities: ["dexterity"], teleport: true, connected: ["dex3a", "dex3b"]},
  {id: "sig3.dexterity.toughness", type: "signature", abilities: ["dexterity", "toughness"], connected: ["dex3b", "tou3a"]},
  {id: "sig3.toughness", type: "signature", abilities: ["toughness"], teleport: true, connected: ["tou3a", "tou3b"]},
  {id: "sig3.toughness.strength", type: "signature", abilities: ["toughness", "strength"], connected: ["tou3b", "str3a"]},
  {id: "sig3.strength", type: "signature", abilities: ["strength"], connected: ["str3a", "str3b"]},
  {id: "sig3.strength.wisdom", type: "signature", abilities: ["strength", "wisdom"], connected: ["str3b", "wis3a"]},
  {id: "sig3.wisdom", type: "signature", abilities: ["wisdom"], connected: ["wis3a", "wis3b"]},
  {id: "sig3.wisdom.presence", type: "signature", abilities: ["wisdom", "presence"], connected: ["wis3b", "pre3a"]},
  {id: "sig3.presence", type: "signature", abilities: ["presence"], connected: ["pre3a", "pre3b"]},
  {id: "sig3.presence.intellect", type: "signature", abilities: ["presence", "intellect"], connected: ["pre3b", "int3a"]},
  {id: "sig3.intellect", type: "signature", abilities: ["intellect"], connected: ["int3a", "int3b"]},
  {id: "sig3.intellect.dexterity", type: "signature", abilities: ["intellect", "dexterity"], connected: ["int3b", "dex3a"]}
];

const TIER_4A = [
  {id: "dex4a", abilities: ["dexterity"], type: "ranged", connected: ["sig3.intellect.dexterity", "dex3a"]},
  {id: "dex4b", abilities: ["dexterity"], type: "training", connected: ["dex3a", "sig3.dexterity", "dex4a"]},
  {id: "dex4c", abilities: ["dexterity"], type: "utility", connected: ["sig3.dexterity", "dex3b", "dex4b"]},
  {id: "dex4d", abilities: ["dexterity"], type: "melee", connected: ["dex3b", "sig3.dexterity.toughness", "dex4c"]},
  {id: "tou4a", abilities: ["toughness"], type: "attack", connected: ["sig3.dexterity.toughness", "tou3a"]},
  {id: "tou4b", abilities: ["toughness"], type: "training", connected: ["tou3a", "sig3.toughness", "tou4a"]},
  {id: "tou4c", abilities: ["toughness"], type: "attack", connected: ["sig3.toughness", "tou3b", "tou4b"]},
  {id: "tou4d", abilities: ["toughness"], type: "attack", connected: ["tou3b", "sig3.toughness.strength", "tou4c"]},
  {id: "str4a", abilities: ["strength"], type: "utility", connected: ["sig3.toughness.strength", "str3a"]},
  {id: "str4b", abilities: ["strength"], type: "attack", connected: ["str3a", "sig3.strength", "str4a"]},
  {id: "str4c", abilities: ["strength"], type: "training", connected: ["sig3.strength", "str3b", "str4b"]},
  {id: "str4d", abilities: ["strength"], type: "attack", connected: ["str3b", "sig3.strength.wisdom", "str4c"]},
  {id: "wis4a", abilities: ["wisdom"], type: "attack", connected: ["sig3.strength.wisdom", "wis3a"]},
  {id: "wis4b", abilities: ["wisdom"], type: "training", connected: ["wis3a", "sig3.wisdom", "wis4a"]},
  {id: "wis4c", abilities: ["wisdom"], type: "utility", connected: ["sig3.wisdom", "wis3b", "wis4b"]},
  {id: "wis4d", abilities: ["wisdom"], type: "attack", connected: ["wis3b", "sig3.wisdom.presence", "wis4c"]},
  {id: "pre4a", abilities: ["presence"], type: "attack", connected: ["sig3.wisdom.presence", "pre3a"]},
  {id: "pre4b", abilities: ["presence"], type: "training", connected: ["pre3a", "sig3.presence", "pre4a"]},
  {id: "pre4c", abilities: ["presence"], type: "attack", connected: ["sig3.presence", "pre3b", "pre4b"]},
  {id: "pre4d", abilities: ["presence"], type: "attack", connected: ["pre3b", "sig3.presence.intellect", "pre4c"]},
  {id: "int4a", abilities: ["intellect"], type: "attack", connected: ["sig3.presence.intellect", "int3a"]},
  {id: "int4b", abilities: ["intellect"], type: "utility", connected: ["int3a", "sig3.intellect", "int4a"]},
  {id: "int4c", abilities: ["intellect"], type: "training", connected: ["sig3.intellect", "int3b", "int4b"]},
  {id: "int4d", abilities: ["intellect"], type: "attack", connected: ["int3b", "sig3.intellect.dexterity", "int4c"]},
];

const TIER_4B = [
  {id: "intdex4", abilities: ["intellect", "dexterity"], type: "move", connected: ["sig3.intellect.dexterity", "int4d", "dex4a"]},
  {id: "dextou4", abilities: ["dexterity", "toughness"], type: "attack", connected: ["sig3.dexterity.toughness", "dex4d", "tou4a"]},
  {id: "toustr4", abilities: ["toughness", "strength"], type: "attack", connected: ["sig3.toughness.strength", "tou4d", "str4a"]},
  {id: "strwis4", abilities: ["strength", "wisdom"], type: "attack", connected: ["sig3.strength.wisdom", "str4d", "wis4a"]},
  {id: "wispre4", abilities: ["wisdom", "presence"], type: "spell", connected: ["sig3.wisdom.presence", "wis4d", "pre4a"]},
  {id: "preint4", abilities: ["presence", "intellect"], type: "spell", connected: ["sig3.presence.intellect", "pre4d", "int4a"]}
];

export default [
  {nodes: ORIGIN, tier: 0, angleOffset: 0, angleDelta: 0, distance: 0},
  {nodes: TIER_0, tier: 0, angleOffset: 15, angleDelta: 30, distance: 200},
  {nodes: TIER_1A, tier: 1, angleOffset: 20, angleDelta: 20, distance: 320},
  {nodes: TIER_1B, tier: 1, angleOffset: 0, angleDelta: 60, distance: 360},
  {nodes: TIER_2A, tier: 2, angleOffset: 15, angleDelta: 15, distance: 440},
  {nodes: TIER_2B, tier: 2, angleOffset: 0, angleDelta: 60, distance: 480},
  {nodes: TIER_3A, tier: 3, angleOffset: 15, angleDelta: 30, distance: 560},
  {nodes: TIER_3B, tier: 3, angleOffset: 30, angleDelta: 30, distance: 600},
  {nodes: TIER_4A, tier: 4, angleOffset: 9, angleDelta: 14, distance: 700},
  {nodes: TIER_4B, tier: 4, angleOffset: 0, angleDelta: 60, distance: 760}
];
