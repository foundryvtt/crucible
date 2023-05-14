import CrucibleTalent from "../data/talent.mjs";
import {ABILITIES} from "./attributes.mjs";

export default class CrucibleTalentNode {
  constructor({id, tier=0, type="choice", abilities=[], angle, distance=200, connected=[], twin} = {}) {
    if ( CrucibleTalentNode.#nodes.has(id) ) {
      throw new Error(`CrucibleTalentNode id "${id}" is already defined.`);
    }

    // Determine the angle
    CrucibleTalentNode.#counters[tier] ??= 0;
    const n = CrucibleTalentNode.#counters[tier]++;
    angle ??= n * CrucibleTalentNode.TIER_ANGLES[tier];

    // Create a Ray
    const r = Ray.fromAngle(0, 0, Math.toRadians(angle), distance * (tier+1));
    Object.defineProperties(this, {
      id: {value: id, writable: false, enumerable: true},
      tier: {value: tier, writable: false, enumerable: true},
      twin: {value: twin, writable: false, enumerable: true},
      type: {value: type, writable: false, enumerable: true},
      abilities: {value: new Set(abilities), writable: false, enumerable: true},
      point: {value: r.B, writable: false, enumerable: true}
    });

    // Node color
    for ( const ability of this.abilities ) {
      if ( !this.color ) this.color = ABILITIES[ability].color;
      else {
        const c2 = ABILITIES[ability].color.maximize(0.5);
        this.color = this.color.mix(c2, 0.5);
      }
    }

    // Connected nodes
    for ( const node of connected ) {
      const n = CrucibleTalentNode.#nodes.get(node);
      if ( !n ) throw new Error(`CrucibleTalentNode parent "${node}" has not yet been defined`);
      n.connect(this);
    }

    // Define prerequisites
    this.prerequisites = CrucibleTalent.preparePrerequisites(this.requirements, {});

    // Register node
    CrucibleTalentNode.#nodes.set(id, this);
    if ( this.type === "signature" ) CrucibleTalentNode.#signature.add(this);
  }

  static #counters = {};

  static TIER_LEVELS = Object.freeze({
    0: 0,
    1: 0,
    2: 3,
    3: 5
  });

  static TIER_ANGLES = {
    0: 60,
    1: 20,
    2: 15,
    3: 15
  };

  /**
   * The states which a node may have on the tree for a given Actor.
   * @enum {number}
   */
  static STATES = {
    BANNED: -1,
    LOCKED: 0,
    UNLOCKED: 1,
    PURCHASED: 2
  }
  /* -------------------------------------------- */

  /**
   * A mapping of all nodes in the tree.
   * @returns {Map<string, CrucibleTalentNode>}
   */
  static get nodes() {
    return this.#nodes;
  }
  static #nodes = new Map();

  /* -------------------------------------------- */

  /**
   * The signature nodes in the tree
   * @type {Set<CrucibleTalentNode>}
   */
  static get signature() {
    return this.#signature;
  }
  static #signature = new Set();

  /* -------------------------------------------- */

  /**
   * The Set of other nodes which are connected to this one
   * @type {Set<CrucibleTalentNode>}
   */
  connected = new Set();

  talents = new Set();

  /**
   * A reference to the icon in the canvas representation of the talent tree that controls this node.
   * @type {CrucibleTalentTreeNode}
   */
  icon;

  get twinNode() {
    return this.twin ? CrucibleTalentNode.#nodes.get(this.twin) : null;
  }

  /**
   * The minimum character requirements needed to unlock this Talent.
   * @type {Object<string, number>}
   */
  get requirements() {
    const reqs = {
      "advancement.level": CrucibleTalentNode.TIER_LEVELS[this.tier]
    }
    const ad = this.abilities.size - 1;
    for ( const ability of this.abilities ) {
      reqs[`abilities.${ability}.value`] = this.tier + 3 - ad;
    }
    return reqs;
  }

  connect(node) {
    this.connected.add(node);
    node.connected.add(this);
  }

  /**
   * Initialize all talents from within the designated collection
   */
  static async initialize() {
    for ( const node of this.nodes.values() ) node.talents.clear();
    const pack = game.packs.get(CONFIG.SYSTEM.COMPENDIUM_PACKS.talent);
    const talents = await pack.getDocuments();
    for ( const talent of talents ) {
      const node = talent.system.node;
      if ( !node ) continue;

      // Register Talents
      node.talents.add(talent);

      // Twinned Nodes
      const twin = node.twinNode;
      if ( twin ) twin.talents.add(talent);

      // Update Metadata
      if ( talent.system.rune ) {
        const rune = CONFIG.SYSTEM.SPELL.RUNES[talent.system.rune];
        rune.img = talent.img;
        rune.description = talent.system.description;
      }
      if ( talent.system.gesture ) {
        const gesture = CONFIG.SYSTEM.SPELL.GESTURES[talent.system.gesture];
        gesture.img = talent.img;
        gesture.description = talent.system.description;
      }
      if ( talent.system.inflection ) {
        const inflection = CONFIG.SYSTEM.SPELL.INFLECTIONS[talent.system.inflection];
        inflection.img = talent.img;
        inflection.description = talent.system.description;
      }
    }
  }

  /* -------------------------------------------- */
  /*  State Testing                               */
  /* -------------------------------------------- */

  /**
   * Test whether a node belongs to a certain special state.
   * This method only verifies node state independent of other nodes.
   * It does not, therefore, know whether a node is accessible.
   * @param {CrucibleActor} actor
   * @param {Object<number,Set<CrucibleTalent>>} signatures
   * @returns {CrucibleTalentNode.STATES}
   */
  getState(actor, signatures) {
    if ( this.#isPurchased(actor) ) return CrucibleTalentNode.STATES.PURCHASED;
    if ( this.#isBanned(actor, signatures) ) return CrucibleTalentNode.STATES.BANNED;
    const accessible = Object.values(CrucibleTalent.testPrerequisites(actor, this.prerequisites)).every(r => r.met);
    if ( !accessible ) return CrucibleTalentNode.STATES.LOCKED;
  }

  /* -------------------------------------------- */

  /**
   * Is this Node connected and eligible to be acquired by an Actor?
   * @param {CrucibleActor} actor         The Actor being tested
   * @returns {boolean}                   Is the node connected?
   */
  isConnected(actor) {
    for ( const c of this.connected ) {
      if ( c.#isPurchased(actor) ) return true;
    }
    if ( this.twin ) {
      for ( const c of this.twinNode.connected ) {
        if ( c.#isPurchased(actor) ) return true;
      }
    }
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Is a signature node banned because the user has selected some other Signature node which shares an ability score.
   * Nodes which have been purchased have already been categorized as purchased.
   * @param {CrucibleActor} actor
   * @param {Object<number,Set<CrucibleTalent>>} signatures
   * @returns {boolean}
   */
  #isBanned(actor, signatures) {
    if ( this.type !== "signature" ) return false;
    return signatures[this.tier].size >= 2;
  }

  /* -------------------------------------------- */

  #isPurchased(actor) {
    for ( const t of this.talents ) {
      if ( actor.talentIds.has(t.id) ) return true;
    }
    return false;
  }

  /* -------------------------------------------- */

  static getSignatureTalents(actor) {
    const tiers = {};
    for ( const node of CrucibleTalentNode.#signature ) {
      tiers[node.tier] ||= new Set();
      for ( const t of node.talents ) {
        if ( actor.talentIds.has(t.id) ) {
          tiers[node.tier].add(t);
        }
      }
    }
    return tiers;
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
  id: "dex0a",
  abilities: ["dexterity"],
  type: "utility",
  tier: 0,
  angle: 15,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "dex0b",
  abilities: ["dexterity"],
  type: "attack",
  tier: 0,
  angle: 45,
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
  angle: 135,
  connected: ["origin"]
});

new CrucibleTalentNode({
  id: "str0b",
  abilities: ["strength"],
  type: "utility",
  tier: 0,
  angle: 165,
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
  abilities: ["intellect", "dexterity"],
  type: "attack",
  tier: 1,
  distance: 180,
  connected: ["dex0a", "dex0b", "int0"]
});

new CrucibleTalentNode({
  id: "dex1a",
  abilities: ["dexterity"],
  type: "utility",
  tier: 1,
  connected: ["dex0a", "dex0b", "intdex1"]
});

new CrucibleTalentNode({
  id: "dex1b",
  abilities: ["dexterity"],
  type: "attack",
  tier: 1,
  connected: ["dex0a", "dex0b", "dex1a"]
});

new CrucibleTalentNode({
  id: "dextou1",
  abilities: ["dexterity", "toughness"],
  type: "move",
  tier: 1,
  distance: 180,
  connected: ["dex0a", "dex0b", "tou0", "dex1b"]
});

new CrucibleTalentNode({
  id: "tou1a",
  abilities: ["toughness"],
  type: "defense",
  tier: 1,
  connected: ["tou0", "dextou1"]
});

new CrucibleTalentNode({
  id: "tou1b",
  abilities: ["toughness"],
  type: "heal",
  tier: 1,
  connected: ["tou0", "tou1a"]
});

new CrucibleTalentNode({
  id: "toustr1",
  abilities: ["toughness", "strength"],
  type: "move",
  tier: 1,
  distance: 180,
  connected: ["tou0", "str0", "str0b", "tou1b"]
});

new CrucibleTalentNode({
  id: "str1a",
  abilities: ["strength"],
  type: "attack",
  tier: 1,
  connected: ["str0", "str0b", "toustr1"]
});

new CrucibleTalentNode({
  id: "str1b",
  abilities: ["strength"],
  type: "utility",
  tier: 1,
  connected: ["str0", "str0b", "str1a"]
});

new CrucibleTalentNode({
  id: "strwis1",
  abilities: ["strength", "wisdom"],
  type: "attack",
  tier: 1,
  distance: 180,
  connected: ["str0", "str0b", "wis0", "str1b"]
});

new CrucibleTalentNode({
  id: "wis1a",
  abilities: ["wisdom"],
  type: "magic",
  tier: 1,
  connected: ["wis0", "strwis1"]
});

new CrucibleTalentNode({
  id: "wis1b",
  abilities: ["wisdom"],
  type: "utility",
  tier: 1,
  connected: ["wis0", "wis1a"]
});

new CrucibleTalentNode({
  id: "wispre1",
  abilities: ["wisdom", "presence"],
  type: "magic",
  tier: 1,
  distance: 180,
  connected: ["wis0", "pre0", "wis1b"]
});

new CrucibleTalentNode({
  id: "pre1a",
  abilities: ["presence"],
  type: "magic",
  tier: 1,
  connected: ["pre0", "wispre1"]
});

new CrucibleTalentNode({
  id: "pre1b",
  abilities: ["presence"],
  type: "attack",
  tier: 1,
  connected: ["pre0", "pre1a"]
});

new CrucibleTalentNode({
  id: "preint1",
  abilities: ["presence", "intellect"],
  type: "magic",
  tier: 1,
  distance: 180,
  connected: ["pre0", "int0", "pre1b"]
});

new CrucibleTalentNode({
  id: "int1a",
  abilities: ["intellect"],
  type: "move",
  tier: 1,
  connected: ["int0", "preint1"]
});

const int1b = new CrucibleTalentNode({
  id: "int1b",
  abilities: ["intellect"],
  type: "magic",
  tier: 1,
  connected: ["int0", "int1a"]
});
intdex1.connect(int1b);

/* -------------------------------------------- */
/*  Tier 2: Level 3                             */
/* -------------------------------------------- */

const intdex2 = new CrucibleTalentNode({
  id: "intdex2",
  abilities: ["intellect", "dexterity"],
  type: "utility",
  tier: 2,
  distance: 180,
  connected: ["int1b", "intdex1", "dex1a"]
});

new CrucibleTalentNode({
  id: "dex2a",
  abilities: ["dexterity"],
  type: "magic",
  tier: 2,
  connected: ["dex1a", "intdex2"]
});

new CrucibleTalentNode({
  id: "dex2b",
  abilities: ["dexterity"],
  type: "attack",
  tier: 2,
  distance: 180,
  connected: ["dex1a", "dex1b", "dex2a"]
});

new CrucibleTalentNode({
  id: "dex2c",
  abilities: ["dexterity"],
  type: "move",
  tier: 2,
  connected: ["dex1b", "dex2b"]
});

new CrucibleTalentNode({
  id: "dextou2",
  abilities: ["dexterity", "toughness"],
  type: "defense",
  tier: 2,
  distance: 180,
  connected: ["dex1b", "dextou1", "tou1a", "dex2c"]
});

new CrucibleTalentNode({
  id: "tou2a",
  abilities: ["toughness"],
  type: "defense",
  tier: 2,
  connected: ["tou1a", "dextou2"]
});

new CrucibleTalentNode({
  id: "tou2b",
  abilities: ["toughness"],
  type: "magic",
  tier: 2,
  distance: 180,
  connected: ["tou1a", "tou1b", "tou2a"]
});

new CrucibleTalentNode({
  id: "tou2c",
  abilities: ["toughness"],
  type: "attack",
  tier: 2,
  connected: ["tou1b", "tou2b"]
});

new CrucibleTalentNode({
  id: "toustr2",
  abilities: ["toughness", "strength"],
  type: "defense",
  tier: 2,
  distance: 180,
  connected: ["tou1b", "toustr1", "str1a", "tou2c"]
});

new CrucibleTalentNode({
  id: "str2a",
  abilities: ["strength"],
  type: "utility",
  tier: 2,
  connected: ["str1a", "toustr2"]
});

new CrucibleTalentNode({
  id: "str2b",
  abilities: ["strength"],
  type: "attack",
  tier: 2,
  distance: 180,
  connected: ["str1a", "str1b", "str2a"]
});

new CrucibleTalentNode({
  id: "str2c",
  abilities: ["strength"],
  type: "magic",
  tier: 2,
  connected: ["str1b", "str2b"]
});

new CrucibleTalentNode({
  id: "strwis2",
  abilities: ["strength", "wisdom"],
  type: "utility",
  tier: 2,
  distance: 180,
  connected: ["str1b", "strwis1", "wis1a", "str2c"]
});

new CrucibleTalentNode({
  id: "wis2a",
  abilities: ["wisdom"],
  type: "defense",
  tier: 2,
  connected: ["wis1a", "strwis2"]
});

new CrucibleTalentNode({
  id: "wis2b",
  abilities: ["wisdom"],
  type: "magic",
  tier: 2,
  distance: 180,
  connected: ["wis1a", "wis1b", "wis2a"]
});

new CrucibleTalentNode({
  id: "wis2c",
  abilities: ["wisdom"],
  type: "heal",
  tier: 2,
  connected: ["wis1b", "wis2b"]
});

new CrucibleTalentNode({
  id: "wispre2",
  abilities: ["wisdom", "presence"],
  type: "utility",
  tier: 2,
  distance: 180,
  connected: ["wis1b", "wispre1", "pre1a", "wis2c"]
});

new CrucibleTalentNode({
  id: "pre2a",
  abilities: ["presence"],
  type: "defense",
  tier: 2,
  connected: ["pre1a", "wispre2"]
});

new CrucibleTalentNode({
  id: "pre2b",
  abilities: ["presence"],
  type: "magic",
  tier: 2,
  distance: 180,
  connected: ["pre1a", "pre1b", "pre2a"]
});

new CrucibleTalentNode({
  id: "pre2c",
  abilities: ["presence"],
  type: "magic",
  tier: 2,
  connected: ["pre1b", "pre2b"]
});

new CrucibleTalentNode({
  id: "preint2",
  abilities: ["presence", "intellect"],
  type: "utility",
  tier: 2,
  distance: 180,
  connected: ["pre1b", "preint1", "int1a", "pre2c"]
});

new CrucibleTalentNode({
  id: "int2a",
  abilities: ["intellect"],
  type: "utility",
  tier: 2,
  connected: ["int1a", "preint2"]
});

new CrucibleTalentNode({
  id: "int2b",
  abilities: ["intellect"],
  type: "magic",
  tier: 2,
  distance: 180,
  connected: ["int1a", "int1b", "int2a"]
});

const int2c = new CrucibleTalentNode({
  id: "int2c",
  abilities: ["intellect"],
  type: "heal",
  tier: 2,
  connected: ["int1b", "int2b"]
});
intdex2.connect(int2c);

/* -------------------------------------------- */
/*  Tier 3: Level 5 (Signature)                 */
/* -------------------------------------------- */

new CrucibleTalentNode({
  id: "intdex3",
  abilities: ["intellect", "dexterity"],
  type: "signature",
  tier: 3,
  connected: ["int2c", "intdex2", "dex2a"]
});

new CrucibleTalentNode({
  id: "dexstr3",
  abilities: ["dexterity", "strength"],
  type: "signature",
  tier: 3,
  connected: ["dex2a", "dex2b", "dex2c"],
  twin: "strdex3"
});

new CrucibleTalentNode({
  id: "dexwis3",
  abilities: ["dexterity", "wisdom"],
  type: "signature",
  tier: 3,
  connected: ["dex2a", "dex2b", "dex2c"],
  twin: "wisdex3"
});

new CrucibleTalentNode({
  id: "dexpre3",
  abilities: ["dexterity", "presence"],
  type: "signature",
  tier: 3,
  connected: ["dex2a", "dex2b", "dex2c"],
  twin: "predex3"
});

new CrucibleTalentNode({
  id: "dextou3",
  abilities: ["dexterity", "toughness"],
  type: "signature",
  tier: 3,
  connected: ["dex2c", "dextou2", "tou2a"]
});

new CrucibleTalentNode({
  id: "touwis3",
  abilities: ["toughness", "wisdom"],
  type: "signature",
  tier: 3,
  connected: ["tou2a", "tou2b", "tou2c"],
  twin: "wistou3"
});

new CrucibleTalentNode({
  id: "toupre3",
  abilities: ["toughness", "presence"],
  type: "signature",
  tier: 3,
  connected: ["tou2a", "tou2b", "tou2c"],
  twin: "pretou3"
});

new CrucibleTalentNode({
  id: "touint3",
  abilities: ["toughness", "intellect"],
  type: "signature",
  tier: 3,
  connected: ["tou2a", "tou2b", "tou2c"],
  twin: "inttou3"
});

new CrucibleTalentNode({
  id: "toustr3",
  abilities: ["toughness", "strength"],
  type: "signature",
  tier: 3,
  connected: ["tou2c", "toustr2", "str2a"]
});

new CrucibleTalentNode({
  id: "strpre3",
  abilities: ["strength", "presence"],
  type: "signature",
  tier: 3,
  connected: ["str2a", "str2b", "str2c"],
  twin: "prestr3"
});

new CrucibleTalentNode({
  id: "strint3",
  abilities: ["strength", "intellect"],
  type: "signature",
  tier: 3,
  connected: ["str2a", "str2b", "str2c"],
  twin: "intstr3"
});

new CrucibleTalentNode({
  id: "strdex3",
  abilities: ["strength", "dexterity"],
  type: "signature",
  tier: 3,
  connected: ["str2a", "str2b", "str2c"],
  twin: "dexstr3"
});

new CrucibleTalentNode({
  id: "strwis3",
  abilities: ["strength", "wisdom"],
  type: "signature",
  tier: 3,
  connected: ["str2c", "strwis2", "wis2a"]
});

new CrucibleTalentNode({
  id: "wisint3",
  abilities: ["wisdom", "intellect"],
  type: "signature",
  tier: 3,
  connected: ["wis2a", "wis2b", "wis2c"],
  twin: "intwis3"
});

new CrucibleTalentNode({
  id: "wisdex3",
  abilities: ["wisdom", "dexterity"],
  type: "signature",
  tier: 3,
  connected: ["wis2a", "wis2b", "wis2c"],
  twin: "dexwis3"
});

new CrucibleTalentNode({
  id: "wistou3",
  abilities: ["wisdom", "toughness"],
  type: "signature",
  tier: 3,
  connected: ["wis2a", "wis2b", "wis2c"],
  twin: "touwis3"
});

new CrucibleTalentNode({
  id: "wispre3",
  abilities: ["wisdom", "presence"],
  type: "signature",
  tier: 3,
  connected: ["wis2c", "wispre2", "pre2a"]
});

new CrucibleTalentNode({
  id: "predex3",
  abilities: ["presence", "dexterity"],
  type: "signature",
  tier: 3,
  connected: ["pre2a", "pre2b", "pre2c"],
  twin: "dexpre3"
});

new CrucibleTalentNode({
  id: "pretou3",
  abilities: ["presence", "toughness"],
  type: "signature",
  tier: 3,
  connected: ["pre2a", "pre2b", "pre2c"],
  twin: "toupre3"
});

new CrucibleTalentNode({
  id: "prestr3",
  abilities: ["presence", "strength"],
  type: "signature",
  tier: 3,
  connected: ["pre2a", "pre2b", "pre2c"],
  twin: "strpre3"
});

new CrucibleTalentNode({
  id: "preint3",
  abilities: ["presence", "intellect"],
  type: "signature",
  tier: 3,
  connected: ["pre2c", "preint2", "int2a"]
});

new CrucibleTalentNode({
  id: "inttou3",
  abilities: ["intellect", "toughness"],
  type: "signature",
  tier: 3,
  connected: ["int2a", "int2b", "int2c"],
  twin: "touint3"
});

new CrucibleTalentNode({
  id: "intstr3",
  abilities: ["intellect", "strength"],
  type: "signature",
  tier: 3,
  connected: ["int2a", "int2b", "int2c"],
  twin: "strint3"
});

new CrucibleTalentNode({
  id: "intwis3",
  abilities: ["intellect", "wisdom"],
  type: "signature",
  tier: 3,
  connected: ["int2a", "int2b", "int2c"],
  twin: "wisint3"
});
