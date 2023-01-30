import TalentData from "../data/talent.mjs";

export default class CrucibleTalentNode {
  constructor({id, tier=0, type="choice", abilities=[], angle=0, distance=200, connected=[]} = {}) {
    if ( CrucibleTalentNode.#nodes.has(id) ) {
      throw new Error(`CrucibleTalentNode id "${id}" is already defined.`);
    }
    const r = Ray.fromAngle(4000, 4000, Math.toRadians(angle), distance * (tier+1));
    Object.defineProperties(this, {
      id: {value: id, writable: false, enumerable: true},
      tier: {value: tier, writable: false, enumerable: true},
      type: {value: type, writable: false, enumerable: true},
      abilities: {value: abilities, writable: false, enumerable: true},
      point: {value: r.B, writable: false, enumerable: true}
    });
    CrucibleTalentNode.#nodes.set(id, this);

    // Node color
    for ( const ability of this.abilities ) {
      if ( !this.color ) this.color = CrucibleTalentNode.ABILITY_COLORS[ability];
      else this.color = this.color.mix(CrucibleTalentNode.ABILITY_COLORS[ability], 0.5)
    }

    for ( const node of connected ) {
      const n = CrucibleTalentNode.#nodes.get(node);
      if ( !n ) throw new Error(`CrucibleTalentNode parent "${node}" has not yet been defined`);
      n.connect(this);
    }

    // Define prerequisites
    this.prerequisites = TalentData.preparePrerequisites(this.requirements, {});

  }

  static ABILITY_COLORS = Object.freeze({
    strength: new Color(0xFF0000),
    wisdom: new Color(0xFF00FF),
    presence: new Color(0x0000FF),
    intellect: new Color(0x00FFFF),
    dexterity: new Color(0x00FF00),
    toughness: new Color(0xFFFF00)
  });

  static TIER_LEVELS = Object.freeze({
    0: 0,
    1: 0,
    2: 3
  });

  static TIER_ABILITIES = Object.freeze({
    0: 3,
    1: 5,
    2: 7
  });

  static get nodes() {
    return this.#nodes;
  }
  static #nodes = new Map();

  connected = new Set();

  talents = new Set();

  /**
   * A reference to the icon in the canvas representation of the talent tree that controls this node.
   * @type {CrucibleTalentTreeNode}
   */
  icon;

  /**
   * The minimum character requirements needed to unlock this Talent.
   * @type {Object<string, number>}
   */
  get requirements() {
    const reqs = {
      "advancement.level": CrucibleTalentNode.TIER_LEVELS[this.tier]
    }
    const ad = this.abilities.length - 1;
    for ( const ability of this.abilities ) {
      reqs[`attributes.${ability}.value`] = CrucibleTalentNode.TIER_ABILITIES[this.tier] - ad;
    }
    return reqs;
  }

  connect(node) {
    this.connected.add(node);
    node.connected.add(this);
  }

  static initialize() {
    for ( const item of game.items ) {
      if ( (item.type !== "talent") || !item.system.node ) continue;
      const node = CrucibleTalentNode.#nodes.get(item.system.node);
      if ( node ) node.talents.add(item);
    }
  }
}

/* -------------------------------------------- */
/*  Tier 0: Level 0                             */
/* -------------------------------------------- */

new CrucibleTalentNode(({
  id: "origin",
  type: "root",
  tier: -1,
  angle: 0
}));

new CrucibleTalentNode({
  id: "dex0",
  abilities: ["dexterity"],
  type: "attack",
  tier: 0,
  angle: 30,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "tou0",
  abilities: ["toughness"],
  type: "defense",
  tier: 0,
  angle: 90,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "str0",
  abilities: ["strength"],
  type: "attack",
  tier: 0,
  angle: 150,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "wis0",
  abilities: ["wisdom"],
  type: "magic",
  tier: 0,
  angle: 210,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "pre0",
  abilities: ["presence"],
  type: "magic",
  tier: 0,
  angle: 270,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "int0",
  abilities: ["intellect"],
  type: "magic",
  tier: 0,
  angle: 330,
  connected: ["origin"]
});

/* -------------------------------------------- */
/*  Tier 1: Level 1                             */
/* -------------------------------------------- */

const intdex1 = new CrucibleTalentNode({
  id: "intdex1",
  abilities: ["dexterity", "intellect"],
  type: "attack",
  tier: 1,
  angle: 0,
  distance: 180,
  connected: ["dex0", "int0"]
});

new CrucibleTalentNode({
  id: "dex1a",
  abilities: ["dexterity"],
  type: "utility",
  tier: 1,
  angle: 20,
  connected: ["dex0", "intdex1"]
});

new CrucibleTalentNode({
  id: "dex1b",
  abilities: ["dexterity"],
  type: "attack",
  tier: 1,
  angle: 40,
  connected: ["dex0", "dex1a"]
});

new CrucibleTalentNode({
  id: "dextou1",
  abilities: ["dexterity", "toughness"],
  type: "move",
  tier: 1,
  angle: 60,
  distance: 180,
  connected: ["dex0", "tou0", "dex1b"]
});

new CrucibleTalentNode({
  id: "tou1a",
  abilities: ["toughness"],
  type: "defense",
  tier: 1,
  angle: 80,
  connected: ["tou0", "dextou1"]
});

new CrucibleTalentNode({
  id: "tou1b",
  abilities: ["toughness"],
  type: "utility",
  tier: 1,
  angle: 100,
  connected: ["tou0", "tou1a"]
});

new CrucibleTalentNode({
  id: "toustr1",
  abilities: ["toughness", "strength"],
  type: "move",
  tier: 1,
  angle: 120,
  distance: 180,
  connected: ["tou0", "str0", "tou1b"]
});

new CrucibleTalentNode({
  id: "str1a",
  abilities: ["strength"],
  type: "attack",
  tier: 1,
  angle: 140,
  connected: ["str0", "toustr1"]
});

new CrucibleTalentNode({
  id: "str1b",
  abilities: ["strength"],
  type: "utility",
  tier: 1,
  angle: 160,
  connected: ["str0", "str1a"]
});

new CrucibleTalentNode({
  id: "strwis1",
  abilities: ["strength", "wisdom"],
  type: "attack",
  tier: 1,
  angle: 180,
  distance: 180,
  connected: ["str0", "wis0", "str1b"]
});

new CrucibleTalentNode({
  id: "wis1a",
  abilities: ["wisdom"],
  type: "magic",
  tier: 1,
  angle: 200,
  connected: ["wis0", "strwis1"]
});

new CrucibleTalentNode({
  id: "wis1b",
  abilities: ["wisdom"],
  type: "heal",
  tier: 1,
  angle: 220,
  connected: ["wis0", "wis1a"]
});

new CrucibleTalentNode({
  id: "wispre1",
  abilities: ["wisdom", "presence"],
  type: "magic",
  tier: 1,
  angle: 240,
  distance: 180,
  connected: ["wis0", "pre0", "wis1b"]
});

new CrucibleTalentNode({
  id: "pre1a",
  abilities: ["presence"],
  type: "utility",
  tier: 1,
  angle: 260,
  connected: ["pre0", "wispre1"]
});

new CrucibleTalentNode({
  id: "pre1b",
  abilities: ["presence"],
  type: "attack",
  tier: 1,
  angle: 280,
  connected: ["pre0", "pre1a"]
});

new CrucibleTalentNode({
  id: "preint1",
  abilities: ["presence", "intellect"],
  type: "magic",
  tier: 1,
  angle: 300,
  distance: 180,
  connected: ["pre0", "int0", "pre1b"]
});

new CrucibleTalentNode({
  id: "int1a",
  abilities: ["intellect"],
  type: "move",
  tier: 1,
  angle: 320,
  connected: ["int0", "preint1"]
});

const int1b = new CrucibleTalentNode({
  id: "int1b",
  abilities: ["intellect"],
  type: "magic",
  tier: 1,
  angle: 340,
  connected: ["int0", "int1a"]
});
intdex1.connect(int1b);

/* -------------------------------------------- */
/*  Tier 2: Level 3                             */
/* -------------------------------------------- */

const intdex2 = new CrucibleTalentNode({
  id: "intdex2",
  abilities: ["dexterity", "intellect"],
  type: "utility",
  tier: 2,
  angle: 0,
  distance: 180,
  connected: ["int1b", "intdex1", "dex1a"]
});

new CrucibleTalentNode({
  id: "dex2a",
  abilities: ["dexterity"],
  type: "magic",
  tier: 2,
  angle: 15,
  connected: ["dex1a", "intdex2"]
});

new CrucibleTalentNode({
  id: "dex2b",
  abilities: ["dexterity"],
  type: "attack",
  tier: 2,
  angle: 30,
  distance: 180,
  connected: ["dex1a", "dex1b", "dex2a"]
});

new CrucibleTalentNode({
  id: "dex2c",
  abilities: ["dexterity"],
  type: "move",
  tier: 2,
  angle: 45,
  connected: ["dex1b", "dex2b"]
});

new CrucibleTalentNode({
  id: "dextou2",
  abilities: ["dexterity", "toughness"],
  type: "defense",
  tier: 2,
  angle: 60,
  distance: 180,
  connected: ["dex1b", "dextou1", "tou1a", "dex2c"]
});

new CrucibleTalentNode({
  id: "tou2a",
  abilities: ["toughness"],
  type: "defense",
  tier: 2,
  angle: 75,
  connected: ["tou1a", "dextou2"]
});

new CrucibleTalentNode({
  id: "tou2b",
  abilities: ["toughness"],
  type: "attack",
  tier: 2,
  angle: 90,
  distance: 180,
  connected: ["tou1a", "tou1b", "tou2a"]
});

new CrucibleTalentNode({
  id: "tou2c",
  abilities: ["toughness"],
  type: "utility",
  tier: 2,
  angle: 105,
  connected: ["tou1b", "tou2b"]
});

new CrucibleTalentNode({
  id: "toustr2",
  abilities: ["toughness", "strength"],
  type: "magic",
  tier: 2,
  angle: 120,
  distance: 180,
  connected: ["tou1b", "toustr1", "str1a", "tou2c"]
});

new CrucibleTalentNode({
  id: "str2a",
  abilities: ["strength"],
  type: "defense",
  tier: 2,
  angle: 135,
  connected: ["str1a", "toustr2"]
});

new CrucibleTalentNode({
  id: "str2b",
  abilities: ["strength"],
  type: "attack",
  tier: 2,
  angle: 150,
  distance: 180,
  connected: ["str1a", "str1b", "str2a"]
});

new CrucibleTalentNode({
  id: "str2c",
  abilities: ["strength"],
  type: "utility",
  tier: 2,
  angle: 165,
  connected: ["str1b", "str2b"]
});

new CrucibleTalentNode({
  id: "strwis2",
  abilities: ["strength", "wisdom"],
  type: "utility",
  tier: 2,
  angle: 180,
  distance: 180,
  connected: ["str1b", "strwis1", "wis1a", "str2c"]
});

new CrucibleTalentNode({
  id: "wis2a",
  abilities: ["wisdom"],
  type: "defense",
  tier: 2,
  angle: 195,
  connected: ["wis1a", "strwis2"]
});

new CrucibleTalentNode({
  id: "wis2b",
  abilities: ["wisdom"],
  type: "heal",
  tier: 2,
  angle: 210,
  distance: 180,
  connected: ["wis1a", "wis1b", "wis2a"]
});

new CrucibleTalentNode({
  id: "wis2c",
  abilities: ["wisdom"],
  type: "utility",
  tier: 2,
  angle: 225,
  connected: ["wis1b", "wis2b"]
});

new CrucibleTalentNode({
  id: "wispre2",
  abilities: ["wisdom", "presence"],
  type: "utility",
  tier: 2,
  angle: 240,
  distance: 180,
  connected: ["wis1b", "wispre1", "pre1a", "wis2c"]
});

new CrucibleTalentNode({
  id: "pre2a",
  abilities: ["presence"],
  type: "defense",
  tier: 2,
  angle: 255,
  connected: ["pre1a", "wispre2"]
});

new CrucibleTalentNode({
  id: "pre2b",
  abilities: ["presence"],
  type: "heal",
  tier: 2,
  angle: 270,
  distance: 180,
  connected: ["pre1a", "pre1b", "pre2a"]
});

new CrucibleTalentNode({
  id: "pre2c",
  abilities: ["presence"],
  type: "utility",
  tier: 2,
  angle: 285,
  connected: ["pre1b", "pre2b"]
});

new CrucibleTalentNode({
  id: "preint2",
  abilities: ["presence", "intellect"],
  type: "utility",
  tier: 2,
  angle: 300,
  distance: 180,
  connected: ["pre1b", "preint1", "int1a", "pre2c"]
});

new CrucibleTalentNode({
  id: "int2a",
  abilities: ["intellect"],
  type: "utility",
  tier: 2,
  angle: 315,
  connected: ["int1a", "preint2"]
});

new CrucibleTalentNode({
  id: "int2b",
  abilities: ["intellect"],
  type: "attack",
  tier: 2,
  angle: 330,
  distance: 180,
  connected: ["int1a", "int1b", "int2a"]
});

const int2c = new CrucibleTalentNode({
  id: "int2c",
  abilities: ["intellect"],
  type: "defense",
  tier: 2,
  angle: 345,
  connected: ["int1b", "int2b"]
});
intdex2.connect(int2c);
