import CrucibleTalent from "../models/talent.mjs";
import {ABILITIES} from "./attributes.mjs";

export default class CrucibleTalentNode {
  constructor({id, tier=0, type="choice", abilities=[], angle, distance=200, connected=[], groups=null, point}={}) {
    if ( CrucibleTalentNode.#nodes.has(id) ) {
      throw new Error(`CrucibleTalentNode id "${id}" is already defined.`);
    }
    this.#initializeNode({id, tier, type, abilities, angle, distance, connected, point, groups});
  }

  static #counters = {};

  static TIER_LEVELS = Object.freeze({
    0: 0,
    1: 0,
    2: 2,
    3: 3,
    4: 5,
  });

  static TIER_ANGLES = {
    0: 60,
    1: 20,
    2: 15,
    3: 15,
    4: 12
  };

  /**
   * TODO remove this
   */
  static SIGNATURE_GROUPS = {
    3: {
      dexterity: "sig3.dexterity",
      toughness: "sig3.toughness",
      strength: "sig3.strength",
      wisdom: "sig3.wisdom",
      presence: "sig3.presence",
      intellect: "sig3.intellect"
    }
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
   * Get the valid node identifiers which can be referenced by a Talent.
   * @returns {FormSelectOption[]}
   */
  static getChoices() {
    const choices = {};
    for ( const {id, groups} of this.#nodes.values() ) {
      if ( groups ) {
        for ( const g of Object.keys(groups) ) {
          choices[g] = g;
        }
      }
      else choices[id] = id;
    }
    return choices;
  }

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

  /**
   * The minimum character requirements needed to unlock this Talent.
   * @type {Object<string, number>}
   */
  get requirements() {
    const reqs = {
      "advancement.level": CrucibleTalentNode.TIER_LEVELS[this.tier]
    }
    const ad = this.groups ? 1 : this.abilities.size - 1;
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
    const packs = [SYSTEM.COMPENDIUM_PACKS.talent, SYSTEM.COMPENDIUM_PACKS.talentExtensions];
    for ( const packId of packs ) {
      if ( !packId ) continue;
      const pack = game.packs.get(packId);
      const talents = await pack.getDocuments();
      for ( const talent of talents ) {
        if ( talent.type !== "talent" ) continue;
        try {
          talent.system.initializeTree();
        } catch(err) {
          console.warn(err);
        }
      }
    }
  }

  /* -------------------------------------------- */

  #initializeNode({id, tier, type, abilities, angle, distance, connected, point, groups}) {
    for ( const node of connected ) {
      const n = CrucibleTalentNode.#nodes.get(node);
      if ( !n ) throw new Error(`CrucibleTalentNode parent "${node}" has not yet been defined`);
      n.connect(this);
    }

    // Determine the angle
    CrucibleTalentNode.#counters[tier] ??= 0;
    const n = CrucibleTalentNode.#counters[tier]++;
    angle ??= n * CrucibleTalentNode.TIER_ANGLES[tier];

    // Create a Ray
    if ( !point ) point = Ray.fromAngle(0, 0, Math.toRadians(angle), distance * (tier + 1)).B;

    // Define node attributes
    Object.defineProperties(this, {
      id: {value: id, writable: false, enumerable: true},
      tier: {value: tier, writable: false, enumerable: true},
      type: {value: type, writable: false, enumerable: true},
      abilities: {value: new Set(abilities), writable: false, enumerable: true},
      point: {value: point, writable: false, enumerable: true},
      groups: {value: groups, writable: false, enumerable: true}
    });

    // Node color
    for ( const ability of this.abilities ) {
      if ( !this.color ) this.color = ABILITIES[ability].color;
      else {
        const c2 = ABILITIES[ability].color.maximize(0.5);
        this.color = this.color.mix(c2, 0.5);
      }
    }

    // Define prerequisites
    this.prerequisites = CrucibleTalentNode.preparePrerequisites(this.requirements);

    // Standard Nodes
    CrucibleTalentNode.#nodes.set(id, this);
    if ( this.type === "signature" ) {
      CrucibleTalentNode.#signature.add(this);
      if ( this.groups ) {
        for ( const groupId of Object.keys(this.groups) ) {
          CrucibleTalentNode.#nodes.set(groupId, this);
        }
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
   * @param {Object<number,Set<CrucibleTalent>>} [signatures]
   * @returns {CrucibleTalentNodeState}
   */
  getState(actor, signatures) {
    signatures ||= CrucibleTalentNode.getSignatureTalents(actor);
    const purchased = this._isPurchased(actor);
    const banned = this.#isBanned(actor, signatures);
    const unlocked = Object.values(CrucibleTalent.testPrerequisites(actor, this.prerequisites)).every(r => r.met);
    return {accessible: undefined, purchased, banned, unlocked};
  }

  /* -------------------------------------------- */

  /**
   * Is this Node connected and eligible to be acquired by an Actor?
   * @param {CrucibleActor} actor         The Actor being tested
   * @returns {boolean}                   Is the node connected?
   */
  isConnected(actor) {
    for ( const c of this.connected ) if ( c._isPurchased(actor) ) return true;
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
    if ( this.type !== "signature" ) return false;  // Only signature talents get banned
    const purchased = signatures[this.tier];
    if ( purchased.size >= 2 ) return true;         // Already purchased 2 signatures at this tier
    for ( const t of this.talents ) {
      if ( purchased.has(t) ) return true;          // Already purchased a signature from this node
    }
    return false;
  }

  /* -------------------------------------------- */

  _isPurchased(actor) {
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

  /* -------------------------------------------- */

  /**
   * Test whether two ability score quadrants are adjacent on the tree.
   * @param ability1
   * @param ability2
   * @returns {-1|0|1} Is ability1 counter-clockwise of ability2 (-1), clockwise of ability2 (1), or not adjacent (0)
   */
  static areAbilitiesAdjacent(ability1, ability2) {
    const abilities = Object.keys(SYSTEM.ABILITIES);
    abilities.push(abilities[0]);
    const idx = abilities.findIndex(a => a === ability1);
    if ( abilities[idx+1] === ability2 ) return 1;
    if ( abilities[idx-1] === ability2 ) return -1;
    return 0;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure of talent prerequisites
   * @param {AdvancementPrerequisites} requirements
   * @returns {AdvancementPrerequisites}
   */
  static preparePrerequisites(requirements={}) {
    return Object.entries(foundry.utils.flattenObject(requirements)).reduce((obj, r) => {
      const [k, v] = r;
      const o = obj[k] = {value: v};
      if ( k.startsWith("abilities.") ) o.label = SYSTEM.ABILITIES[k.split(".")[1]].label;
      else if ( k === "advancement.level" ) o.label = "Level"
      else if ( k.startsWith("skills.") ) o.label = SYSTEM.SKILLS[k.split(".")[1]].label;
      else o.label = k;
      o.tag = `${o.label} ${o.value}`;
      return obj;
    }, {});
  }

  /* -------------------------------------------- */

  /**
   * Define the talent tree nodes used by the system.
   */
  static defineTree() {

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
      angle: 75,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "tou0b",
      abilities: ["toughness"],
      type: "attack",
      tier: 0,
      angle: 105,
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
      type: "utility",
      tier: 0,
      angle: 195,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "wis0b",
      abilities: ["wisdom"],
      type: "magic",
      tier: 0,
      angle: 225,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "pre0",
      abilities: ["presence"],
      type: "attack",
      tier: 0,
      angle: 255,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "pre0b",
      abilities: ["presence"],
      type: "magic",
      tier: 0,
      angle: 285,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "int0",
      abilities: ["intellect"],
      type: "magic",
      tier: 0,
      angle: 315,
      connected: ["origin"]
    });

    new CrucibleTalentNode({
      id: "int0b",
      abilities: ["intellect"],
      type: "utility",
      tier: 0,
      angle: 345,
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
      connected: ["dex0a", "int0b"]
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
      connected: ["dex0b", "tou0", "dex1b"]
    });

    new CrucibleTalentNode({
      id: "tou1a",
      abilities: ["toughness"],
      type: "defense",
      tier: 1,
      connected: ["tou0", "tou0b", "dextou1"]
    });

    new CrucibleTalentNode({
      id: "tou1b",
      abilities: ["toughness"],
      type: "heal",
      tier: 1,
      connected: ["tou0", "tou0b", "tou1a"]
    });

    new CrucibleTalentNode({
      id: "toustr1",
      abilities: ["toughness", "strength"],
      type: "move",
      tier: 1,
      connected: ["tou0b", "str0", "tou1b"]
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
      connected: ["str0b", "wis0", "str1b"]
    });

    new CrucibleTalentNode({
      id: "wis1a",
      abilities: ["wisdom"],
      type: "utility",
      tier: 1,
      connected: ["wis0", "wis0b", "strwis1"]
    });

    new CrucibleTalentNode({
      id: "wis1b",
      abilities: ["wisdom"],
      type: "magic",
      tier: 1,
      connected: ["wis0", "wis0b", "wis1a"]
    });

    new CrucibleTalentNode({
      id: "wispre1",
      abilities: ["wisdom", "presence"],
      type: "magic",
      tier: 1,
      connected: ["wis0b", "pre0", "wis1b"]
    });

    new CrucibleTalentNode({
      id: "pre1a",
      abilities: ["presence"],
      type: "heal",
      tier: 1,
      connected: ["pre0", "pre0b", "wispre1"]
    });

    new CrucibleTalentNode({
      id: "pre1b",
      abilities: ["presence"],
      type: "magic",
      tier: 1,
      connected: ["pre0", "pre0b", "pre1a"]
    });

    new CrucibleTalentNode({
      id: "preint1",
      abilities: ["presence", "intellect"],
      type: "magic",
      tier: 1,
      connected: ["pre0b", "int0", "pre1b"]
    });

    new CrucibleTalentNode({
      id: "int1a",
      abilities: ["intellect"],
      type: "magic",
      tier: 1,
      connected: ["int0", "int0b", "preint1"]
    });

    const int1b = new CrucibleTalentNode({
      id: "int1b",
      abilities: ["intellect"],
      type: "move",
      tier: 1,
      connected: ["int0", "int0b", "int1a"]
    });
    intdex1.connect(int1b);

    /* -------------------------------------------- */
    /*  Tier 2: Level 2                             */
    /* -------------------------------------------- */

    const intdex2 = new CrucibleTalentNode({
      id: "intdex2",
      abilities: ["intellect", "dexterity"],
      type: "utility",
      tier: 2,
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
    /*  Tier 3: Level 3 (Signature)                 */
    /* -------------------------------------------- */

    // Dexterity Quadrant
    const sig3intdex = new CrucibleTalentNode({id: "sig3.intellect.dexterity", abilities: ["intellect", "dexterity"],
      type: "signature", tier: 3, connected: ["int2c", "intdex2", "dex2a"]});
    new CrucibleTalentNode({id: "dex3a", type: "attack", abilities: ["dexterity"], tier: 3,
      connected: ["intdex2", "dex2a", "dex2b", "sig3.intellect.dexterity"]});
    new CrucibleTalentNode({id: "sig3.dexterity", type: "signature", abilities: ["dexterity"], tier: 3,
      point: {x: 692, y: 400}, teleport: true, connected: ["dex2a", "dex2b", "dex2c", "dex3a"], groups: {
        "sig3.dexterity.strength": {abilities: ["dexterity", "strength"], teleport: "sig3.strength"},
        "sig3.dexterity.wisdom": {abilities: ["dexterity", "wisdom"], teleport: "sig3.wisdom"},
        "sig3.dexterity.presence": {abilities: ["dexterity", "presence"], teleport: "sig3.presence"}
      }});
    new CrucibleTalentNode({id: "dex3b", type: "attack", abilities: ["dexterity"], tier: 3,
      connected: ["dex2b", "dex2c", "dextou2", "sig3.dexterity"]})

    // Toughness Quadrant
    new CrucibleTalentNode({id: "sig3.dexterity.toughness", abilities: ["dexterity", "toughness"], type: "signature",
      tier: 3, connected: ["dex2c", "dextou2", "tou2a", "dex3b"]});
    new CrucibleTalentNode({id: "tou3a", type: "attack", abilities: ["toughness"], tier: 3,
      connected: ["dextou2", "tou2a", "tou2b", "sig3.dexterity.toughness"]});
    new CrucibleTalentNode({id: "sig3.toughness", type: "signature", abilities: ["toughness"], tier: 3, point: {x: 0, y: 800},
      teleport: true, connected: ["tou2a", "tou2b", "tou2c", "tou3a"], groups: {
        "sig3.toughness.wisdom": {abilities: ["toughness", "wisdom"], teleport: "sig3.wisdom"},
        "sig3.toughness.presence": {abilities: ["toughness", "presence"], teleport: "sig3.presence"},
        "sig3.toughness.intellect": {abilities: ["toughness", "intellect"], teleport: "sig3.intellect"}
      }});
    new CrucibleTalentNode({id: "tou3b", type: "defense", abilities: ["toughness"], tier: 3,
      connected: ["tou2b", "tou2c", "toustr2", "sig3.toughness"]})

    // Strength Quadrant
    new CrucibleTalentNode({id: "sig3.toughness.strength", abilities: ["toughness", "strength"], type: "signature",
      tier: 3, connected: ["tou2c", "toustr2", "str2a", "tou3b"]});
    new CrucibleTalentNode({id: "str3a", type: "attack", abilities: ["strength"], tier: 3,
      connected: ["toustr2", "str2a", "str2b", "sig3.toughness.strength"]});
    new CrucibleTalentNode({id: "sig3.strength", type: "signature", abilities: ["strength"], tier: 3,
      point: {x: -692, y: 400}, connected: ["str2a", "str2b", "str2c", "str3a"], groups: {
        "sig3.strength.presence": {abilities: ["strength", "presence"], teleport: "sig3.presence"},
        "sig3.strength.intellect": {abilities: ["strength", "intellect"], teleport: "sig3.intellect"}
      }});
    new CrucibleTalentNode({id: "str3b", type: "attack", abilities: ["strength"], tier: 3,
      connected: ["str2b", "str2c", "strwis2", "sig3.strength"]})

    // Wisdom Quadrant
    new CrucibleTalentNode({id: "sig3.strength.wisdom", abilities: ["strength", "wisdom"], type: "signature", tier: 3,
      connected: ["str2c", "strwis2", "wis2a", "str3b"]});
    new CrucibleTalentNode({id: "wis3a", type: "attack", abilities: ["wisdom"], tier: 3,
      connected: ["strwis2", "wis2a", "wis2b", "sig3.strength.wisdom"]});
    new CrucibleTalentNode({id: "sig3.wisdom", type: "signature", abilities: ["wisdom"], tier: 3, point: {x: -692, y: -400},
      connected: ["wis2a", "wis2b", "wis2c", "wis3a"], groups: {
        "sig3.wisdom.intellect": {abilities: ["wisdom", "intellect"], teleport: "sig3.intellect"},
      }});
    new CrucibleTalentNode({id: "wis3b", type: "magic", abilities: ["wisdom"], tier: 3,
      connected: ["wis2b", "wis2c", "wispre2", "sig3.wisdom"]})

    // Presence Quadrant
    new CrucibleTalentNode({id: "sig3.wisdom.presence", abilities: ["wisdom", "presence"], type: "signature", tier: 3,
      connected: ["wis2c", "wispre2", "pre2a", "wis3b"]});
    new CrucibleTalentNode({id: "pre3a", type: "attack", abilities: ["presence"], tier: 3,
      connected: ["wispre2", "pre2a", "pre2b", "sig3.wisdom.presence"]});
    new CrucibleTalentNode({id: "sig3.presence", type: "signature", abilities: ["presence"], tier: 3, point: {x: 0, y: -800},
      connected: ["pre2a", "pre2b", "pre2c", "pre3a"], groups: {}});
    new CrucibleTalentNode({id: "pre3b", type: "magic", abilities: ["presence"], tier: 3,
      connected: ["pre2b", "pre2c", "preint2", "sig3.presence"]})

    // Intellect Quadrant
    new CrucibleTalentNode({id: "sig3.presence.intellect", abilities: ["presence", "intellect"], type: "signature",
      tier: 3, connected: ["pre2c", "preint2", "int2a", "pre3b"]});
    new CrucibleTalentNode({id: "int3a", type: "magic", abilities: ["intellect"], tier: 3,
      connected: ["preint2", "int2a", "int2b", "sig3.presence.intellect"]});
    new CrucibleTalentNode({id: "sig3.intellect", type: "signature", abilities: ["intellect"], tier: 3,
      point: {x: 692, y: -400}, connected: ["int2a", "int2b", "int2c", "int3a"], groups: {}});
    const int3b = new CrucibleTalentNode({id: "int3b", type: "attack", abilities: ["intellect"], tier: 3,
      connected: ["int2b", "int2c", "intdex2", "sig3.intellect"]})
    sig3intdex.connect(int3b);

    /* -------------------------------------------- */
    /*  Tier 4: Level 5                             */
    /* -------------------------------------------- */

    const TIER_4 = [

      // Dexterity Quadrant
      {id: "intdex4", abilities: ["intellect", "dexterity"], type: "attack", connected: ["sig3.intellect.dexterity", "dex3a"]},
      {id: "dex4a", abilities: ["dexterity"], type: "attack", connected: ["sig3.intellect.dexterity", "dex3a", "sig3.dexterity", "intdex4"]},
      {id: "dex4b", abilities: ["dexterity"], type: "attack", connected: ["dex3a", "sig3.dexterity", "dex4a"]},
      {id: "dex4c", abilities: ["dexterity"], type: "attack", connected: ["sig3.dexterity", "dex3b", "dex4b"]},
      {id: "dex4d", abilities: ["dexterity"], type: "attack", connected: ["sig3.dexterity", "dex3b", "sig3.dexterity.toughness", "dex4c"]},

      // Toughness Quadrant
      {id: "dextou4", abilities: ["dexterity", "toughness"], type: "attack", connected: ["dex3b", "sig3.dexterity.toughness", "tou3a", "dex4d"]},
      {id: "tou4a", abilities: ["toughness"], type: "attack", connected: ["sig3.dexterity.toughness", "tou3a", "sig3.toughness", "dextou4"]},
      {id: "tou4b", abilities: ["toughness"], type: "attack", connected: ["tou3a", "sig3.toughness", "tou4a"]},
      {id: "tou4c", abilities: ["toughness"], type: "attack", connected: ["sig3.toughness", "tou3b", "tou4b"]},
      {id: "tou4d", abilities: ["toughness"], type: "attack", connected: ["sig3.toughness", "tou3b", "sig3.toughness.strength", "tou4c"]},

      // Strength Quadrant
      {id: "toustr4", abilities: ["toughness", "strength"], type: "attack", connected: ["tou3b", "sig3.toughness.strength", "str3a", "tou4d"]},
      {id: "str4a", abilities: ["strength"], type: "attack", connected: ["sig3.toughness.strength", "str3a", "sig3.strength", "toustr4"]},
      {id: "str4b", abilities: ["strength"], type: "attack", connected: ["str3a", "sig3.strength", "str4a"]},
      {id: "str4c", abilities: ["strength"], type: "attack", connected: ["sig3.strength", "str3b", "str4b"]},
      {id: "str4d", abilities: ["strength"], type: "attack", connected: ["sig3.strength", "str3b", "sig3.strength.wisdom", "str4c"]},

      // Wisdom Quadrant
      {id: "strwis4", abilities: ["strength", "wisdom"], type: "attack", connected: ["str3b", "sig3.strength.wisdom", "wis3a", "str4d"]},
      {id: "wis4a", abilities: ["wisdom"], type: "attack", connected: ["sig3.strength.wisdom", "wis3a", "sig3.wisdom", "strwis4"]},
      {id: "wis4b", abilities: ["wisdom"], type: "attack", connected: ["wis3a", "sig3.wisdom", "wis4a"]},
      {id: "wis4c", abilities: ["wisdom"], type: "attack", connected: ["sig3.wisdom", "wis3b", "wis4b"]},
      {id: "wis4d", abilities: ["wisdom"], type: "attack", connected: ["sig3.wisdom", "wis3b", "sig3.wisdom.presence", "wis4c"]},

      // Presence Quadrant
      {id: "wispre4", abilities: ["wisdom", "presence"], type: "magic", connected: ["wis3b", "sig3.wisdom.presence", "pre3a", "wis4d"]},
      {id: "pre4a", abilities: ["presence"], type: "attack", connected: ["sig3.wisdom.presence", "pre3a", "sig3.presence", "wispre4"]},
      {id: "pre4b", abilities: ["presence"], type: "attack", connected: ["pre3a", "sig3.presence", "pre4a"]},
      {id: "pre4c", abilities: ["presence"], type: "attack", connected: ["sig3.presence", "pre3b", "pre4b"]},
      {id: "pre4d", abilities: ["presence"], type: "attack", connected: ["sig3.presence", "pre3b", "sig3.presence.intellect", "pre4c"]},

      // Intellect Quadrant
      {id: "preint4", abilities: ["presence", "intellect"], type: "attack", connected: ["pre3b", "sig3.presence.intellect", "int3a", "pre4d"]},
      {id: "int4a", abilities: ["intellect"], type: "attack", connected: ["sig3.presence.intellect", "int3a", "sig3.intellect", "preint4"]},
      {id: "int4b", abilities: ["intellect"], type: "attack", connected: ["int3a", "sig3.intellect", "int4a"]},
      {id: "int4c", abilities: ["intellect"], type: "attack", connected: ["sig3.intellect", "int3b", "int4b"]},
      {id: "int4d", abilities: ["intellect"], type: "attack", connected: ["sig3.intellect", "int3b", "sig3.intellect.dexterity", "int4c"]},
    ];
    for ( const n of TIER_4 ) new CrucibleTalentNode({...n, tier: 4});
    CrucibleTalentNode.nodes.get("intdex4").connect(CrucibleTalentNode.nodes.get("int4d"));
  }
}
