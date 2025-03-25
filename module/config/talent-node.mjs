import CrucibleTalentItem from "../models/item-talent.mjs";
import {ABILITIES} from "./attributes.mjs";

/**
 * @typedef TalentNodeConfig
 * @property {string} id
 * @property {number|"root"} tier
 * @property {string} type
 * @property {string[]} abilities
 * @property {string[]} connected
 * @property {number} distance
 * @property {number} angle
 * @property {null|Record<string, {abilities: string[], teleport: string}>} [group=null]
 */

/**
 * A class which manages the data structure for each node on the Crucible talent tree.
 */
export default class CrucibleTalentNode {
  /**
   * Construct a talent node by providing its configuration data.
   * @param {TalentNodeConfig} config
   */
  constructor(config) {
    if ( CrucibleTalentNode.#nodes.has(config.id) ) {
      throw new Error(`CrucibleTalentNode id "${config.id}" is already defined.`);
    }
    this.#initializeNode(config);
  }

  static TIER_LEVELS = Object.freeze({
    0: 0,
    1: 0,
    2: 2,
    3: 3,
    4: 5,
  });

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

  /**
   * Initialize configuration data for the node.
   * @param {TalentNodeConfig} config
   */
  #initializeNode({id, tier=0, type="utility", abilities=[], connected=[], groups=null, angle, distance}={}) {

    // Node type and tier configuration
    const nodeType = SYSTEM.TALENT.NODE_TYPES[type];
    if ( !nodeType ) throw new Error(`Invalid talent node type "${type}" for node "${id}"`);
    const nodeTier = SYSTEM.TALENT.NODE_TIERS[tier];
    if ( !nodeTier ) throw new Error(`Invalid talent node tier "${tier}" for node "${id}"`);

    // Verify connections
    for ( const node of connected ) {
      const n = CrucibleTalentNode.#nodes.get(node);
      if ( !n ) throw new Error(`CrucibleTalentNode parent "${node}" has not yet been defined`);
      n.connect(this);
    }

    // Determine the point
    const ray = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians(angle), distance);
    const point = ray.B;

    // Node color
    let color;
    for ( const ability of abilities ) {
      if ( !color ) color = ABILITIES[ability].color;
      else {
        const c2 = ABILITIES[ability].color.maximize(0.5);
        color = color.mix(c2, 0.5);
      }
    }

    // Define node attributes
    Object.defineProperties(this, {
      id: {value: id, writable: false, enumerable: true},
      tier: {value: tier, writable: false, enumerable: true},
      type: {value: type, writable: false, enumerable: true},
      typeLabel: {value: nodeType.label, writable: false, enumerable: true},
      style: {value: nodeType.style, writable: false, enumerable: true},
      iconPrefix: {value: nodeType.icon, writable: false, enumerable: true},
      abilities: {value: new Set(abilities), writable: false, enumerable: true},
      point: {value: point, writable: false, enumerable: true},
      groups: {value: groups, writable: false, enumerable: true},
      color: {value: color, writable: false, enumerable: true},
    });

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
   * @param {Object<number,Set<CrucibleTalentItem>>} [signatures]
   * @returns {CrucibleTalentNodeState}
   */
  getState(actor, signatures) {
    signatures ||= CrucibleTalentNode.getSignatureTalents(actor);
    const purchased = this.isPurchased(actor);
    const banned = this.#isBanned(actor, signatures);
    const unlocked = Object.values(CrucibleTalentItem.testPrerequisites(actor, this.prerequisites)).every(r => r.met);
    return {accessible: undefined, purchased, banned, unlocked};
  }

  /* -------------------------------------------- */

  /**
   * Is this Node connected and eligible to be acquired by an Actor?
   * @param {CrucibleActor} actor         The Actor being tested
   * @returns {boolean}                   Is the node connected?
   */
  isConnected(actor) {
    for ( const c of this.connected ) if ( c.isPurchased(actor) ) return true;
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Is a signature node banned because the user has selected some other Signature node which shares an ability score.
   * Nodes which have been purchased have already been categorized as purchased.
   * @param {CrucibleActor} actor
   * @param {Object<number,Set<CrucibleTalentItem>>} signatures
   * @returns {boolean}
   */
  #isBanned(actor, signatures) {
    if ( this.type !== "signature" ) return false;  // Only signature talents get banned
    const purchased = signatures[this.tier];
    if ( purchased.size >= 2 ) return true;         // Already purchased 2 signatures at this tier
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Has this talent node been purchased by an Actor?
   * @param {CrucibleActor} actor
   * @returns {boolean}
   */
  isPurchased(actor) {

    // Purchased as an empty node
    if ( !this.talents.size ) {
      return actor.system.advancement.talentNodes.has(this.id);
    }

    // Purchased via talents
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
    new CrucibleTalentNode(({
      id: "origin",
      type: "training",
      tier: "root",
      abilities: ["dexterity", "toughness", "strength", "wisdom", "presence", "intellect"],
      connected: [],
      group: null,
      distance: 0,
      angle: 0
    }));

    const createNodes = (nodes, {tier, angleOffset, angleDelta, distance}) => {
      let ns = -1;
      let sextant = "";
      let angle = 0;
      for ( const n of nodes ) {
        if ( n.abilities[0] !== sextant ) {
          sextant = n.abilities[0];
          ns++;
          angle = (ns * 60) + angleOffset;
        }
        new CrucibleTalentNode({...n, tier, angle, distance});
        angle += angleDelta;
      }
    };

    /* -------------------------------------------- */
    /*  Tier 0: Level 0                             */
    /* -------------------------------------------- */

    const TIER_0 = [
      {id: "dex0a", abilities: ["dexterity"], type: "training", connected: ["origin"]},
      {id: "dex0b", abilities: ["dexterity"], type: "attack", connected: ["origin"]},
      {id: "tou0a", abilities: ["toughness"], type: "training", connected: ["origin"]},
      {id: "tou0b", abilities: ["toughness"], type: "defense", connected: ["origin"]},
      {id: "str0a", abilities: ["strength"], type: "attack", connected: ["origin"]},
      {id: "str0b", abilities: ["strength"], type: "training", connected: ["origin"]},
      {id: "wis0a", abilities: ["wisdom"], type: "training", connected: ["origin"]},
      {id: "wis0b", abilities: ["wisdom"], type: "spell", connected: ["origin"]},
      {id: "pre0a", abilities: ["presence"], type: "training", connected: ["origin"]},
      {id: "pre0b", abilities: ["presence"], type: "spell", connected: ["origin"]},
      {id: "int0a", abilities: ["intellect"], type: "spell", connected: ["origin"]},
      {id: "int0b", abilities: ["intellect"], type: "training", connected: ["origin"]}
    ];
    createNodes(TIER_0, {tier: 0, angleOffset: 15, angleDelta: 30, distance: 200});

    /* -------------------------------------------- */
    /*  Tier 1: Level 1                             */
    /* -------------------------------------------- */

    const TIER_1A = [
      {id: "dex1a", abilities: ["dexterity"], type: "utility", connected: ["dex0a", "dex0b"]},
      {id: "dex1b", abilities: ["dexterity"], type: "attack", connected: ["dex0a", "dex0b", "dex1a"]},
      {id: "tou1a", abilities: ["toughness"], type: "defense", connected: ["tou0a", "tou0b"]},
      {id: "tou1b", abilities: ["toughness"], type: "heal", connected: ["tou0a", "tou0b", "tou1a"]},
      {id: "str1a", abilities: ["strength"], type: "attack", connected: ["str0a", "str0b"]},
      {id: "str1b", abilities: ["strength"], type: "utility", connected: ["str0a", "str0b", "str1a"]},
      {id: "wis1a", abilities: ["wisdom"], type: "utility", connected: ["wis0a", "wis0b"]},
      {id: "wis1b", abilities: ["wisdom"], type: "spell", connected: ["wis0a", "wis0b", "wis1a"]},
      {id: "pre1a", abilities: ["presence"], type: "heal", connected: ["pre0a", "pre0b"]},
      {id: "pre1b", abilities: ["presence"], type: "spell", connected: ["pre0a", "pre0b", "pre1a"]},
      {id: "int1a", abilities: ["intellect"], type: "spell", connected: ["int0a", "int0b"]},
      {id: "int1b", abilities: ["intellect"], type: "move", connected: ["int0a", "int0b", "int1a"]}
    ];
    createNodes(TIER_1A, {tier: 1, angleOffset: 20, angleDelta: 20, distance: 320});

    const TIER_1B = [
      {id: "intdex1", abilities: ["intellect", "dexterity"], type: "attack", connected: ["int1b", "dex1a"]},
      {id: "dextou1", abilities: ["dexterity", "toughness"], type: "move", connected: ["dex1b", "tou1a"]},
      {id: "toustr1", abilities: ["toughness", "strength"], type: "move", connected: ["tou1b", "str1a"]},
      {id: "strwis1", abilities: ["strength", "wisdom"], type: "attack", connected: ["str1b", "wis1a"]},
      {id: "wispre1", abilities: ["wisdom", "presence"], type: "spell", connected: ["wis1b", "pre1a"]},
      {id: "preint1", abilities: ["presence", "intellect"], type: "spell", connected: ["pre1b", "int1a"]},
    ];
    createNodes(TIER_1B, {tier: 1, angleOffset: 0, angleDelta: 60, distance: 360});

    /* -------------------------------------------- */
    /*  Tier 3: Level 2                             */
    /* -------------------------------------------- */

    const TIER_2A = [
      {id: "dex2a", abilities: ["dexterity"], type: "spell", connected: ["dex1a"]},
      {id: "dex2b", abilities: ["dexterity"], type: "attack", connected: ["dex1a", "dex1b", "dex2a"]},
      {id: "dex2c", abilities: ["dexterity"], type: "move", connected: ["dex1b", "dex2b"]},
      {id: "tou2a", abilities: ["toughness"], type: "defense", connected: ["tou1a"]},
      {id: "tou2b", abilities: ["toughness"], type: "spell", connected: ["tou1a", "tou1b", "tou2a"]},
      {id: "tou2c", abilities: ["toughness"], type: "attack", connected: ["tou1b", "tou2b"]},
      {id: "str2a", abilities: ["strength"], type: "utility", connected: ["str1a"]},
      {id: "str2b", abilities: ["strength"], type: "attack", connected: ["str1a", "str1b", "str2a"]},
      {id: "str2c", abilities: ["strength"], type: "spell", connected: ["str1b", "str2b"]},
      {id: "wis2a", abilities: ["wisdom"], type: "defense", connected: ["wis1a"]},
      {id: "wis2b", abilities: ["wisdom"], type: "spell", connected: ["wis1a", "wis1b", "wis2a"]},
      {id: "wis2c", abilities: ["wisdom"], type: "heal", connected: ["wis1b", "wis2b"]},
      {id: "pre2a", abilities: ["presence"], type: "defense", connected: ["pre1a"]},
      {id: "pre2b", abilities: ["presence"], type: "spell", connected: ["pre1a", "pre1b", "pre2a"]},
      {id: "pre2c", abilities: ["presence"], type: "spell", connected: ["pre1b", "pre2b"]},
      {id: "int2a", abilities: ["intellect"], type: "utility", connected: ["int1a"]},
      {id: "int2b", abilities: ["intellect"], type: "spell", connected: ["int1a", "int1b", "int2a"]},
      {id: "int2c", abilities: ["intellect"], type: "heal", connected: ["int1b", "int2b"]}
    ];
    createNodes(TIER_2A, {tier: 2, angleOffset: 15, angleDelta: 15, distance: 440});

    const TIER_2B = [
      {id: "intdex2", abilities: ["intellect", "dexterity"], type: "utility", connected: ["int2c", "dex2a"]},
      {id: "dextou2", abilities: ["dexterity", "toughness"], type: "defense", connected: ["dex2c", "tou2a"]},
      {id: "toustr2", abilities: ["toughness", "strength"], type: "defense", connected: ["tou2c", "str2a"]},
      {id: "strwis2", abilities: ["strength", "wisdom"], type: "utility", connected: ["str2c", "wis2a"]},
      {id: "wispre2", abilities: ["wisdom", "presence"], type: "utility", connected: ["wis2c", "pre2a"]},
      {id: "preint2", abilities: ["presence", "intellect"], type: "utility", connected: ["pre2c", "int2a"]}
    ];
    createNodes(TIER_2B, {tier: 2, angleOffset: 0, angleDelta: 60, distance: 480});

    /* -------------------------------------------- */
    /*  Tier 6: Level 3 (Signature)                 */
    /* -------------------------------------------- */

    // Dexterity Quadrant
    const sig3intdex = new CrucibleTalentNode({id: "sig3.intellect.dexterity", abilities: ["intellect", "dexterity"],
      type: "signature", tier: 6, connected: ["int2c", "intdex2", "dex2a"]});
    new CrucibleTalentNode({id: "dex3a", type: "attack", abilities: ["dexterity"], tier: 6,
      connected: ["intdex2", "dex2a", "dex2b", "sig3.intellect.dexterity"]});
    new CrucibleTalentNode({id: "sig3.dexterity", type: "signature", abilities: ["dexterity"], tier: 6,
      point: {x: 692, y: 400}, teleport: true, connected: ["dex2a", "dex2b", "dex2c", "dex3a"], groups: {
        "sig3.dexterity.strength": {abilities: ["dexterity", "strength"], teleport: "sig3.strength"},
        "sig3.dexterity.wisdom": {abilities: ["dexterity", "wisdom"], teleport: "sig3.wisdom"},
        "sig3.dexterity.presence": {abilities: ["dexterity", "presence"], teleport: "sig3.presence"}
      }});
    new CrucibleTalentNode({id: "dex3b", type: "attack", abilities: ["dexterity"], tier: 6,
      connected: ["dex2b", "dex2c", "dextou2", "sig3.dexterity"]})

    // Toughness Quadrant
    new CrucibleTalentNode({id: "sig3.dexterity.toughness", abilities: ["dexterity", "toughness"], type: "signature",
      tier: 6, connected: ["dex2c", "dextou2", "tou2a", "dex3b"]});
    new CrucibleTalentNode({id: "tou3a", type: "attack", abilities: ["toughness"], tier: 6,
      connected: ["dextou2", "tou2a", "tou2b", "sig3.dexterity.toughness"]});
    new CrucibleTalentNode({id: "sig3.toughness", type: "signature", abilities: ["toughness"], tier: 6, point: {x: 0, y: 800},
      teleport: true, connected: ["tou2a", "tou2b", "tou2c", "tou3a"], groups: {
        "sig3.toughness.wisdom": {abilities: ["toughness", "wisdom"], teleport: "sig3.wisdom"},
        "sig3.toughness.presence": {abilities: ["toughness", "presence"], teleport: "sig3.presence"},
        "sig3.toughness.intellect": {abilities: ["toughness", "intellect"], teleport: "sig3.intellect"}
      }});
    new CrucibleTalentNode({id: "tou3b", type: "defense", abilities: ["toughness"], tier: 6,
      connected: ["tou2b", "tou2c", "toustr2", "sig3.toughness"]})

    // Strength Quadrant
    new CrucibleTalentNode({id: "sig3.toughness.strength", abilities: ["toughness", "strength"], type: "signature",
      tier: 6, connected: ["tou2c", "toustr2", "str2a", "tou3b"]});
    new CrucibleTalentNode({id: "str3a", type: "attack", abilities: ["strength"], tier: 6,
      connected: ["toustr2", "str2a", "str2b", "sig3.toughness.strength"]});
    new CrucibleTalentNode({id: "sig3.strength", type: "signature", abilities: ["strength"], tier: 6,
      point: {x: -692, y: 400}, connected: ["str2a", "str2b", "str2c", "str3a"], groups: {
        "sig3.strength.presence": {abilities: ["strength", "presence"], teleport: "sig3.presence"},
        "sig3.strength.intellect": {abilities: ["strength", "intellect"], teleport: "sig3.intellect"}
      }});
    new CrucibleTalentNode({id: "str3b", type: "attack", abilities: ["strength"], tier: 6,
      connected: ["str2b", "str2c", "strwis2", "sig3.strength"]})

    // Wisdom Quadrant
    new CrucibleTalentNode({id: "sig3.strength.wisdom", abilities: ["strength", "wisdom"], type: "signature", tier: 6,
      connected: ["str2c", "strwis2", "wis2a", "str3b"]});
    new CrucibleTalentNode({id: "wis3a", type: "attack", abilities: ["wisdom"], tier: 6,
      connected: ["strwis2", "wis2a", "wis2b", "sig3.strength.wisdom"]});
    new CrucibleTalentNode({id: "sig3.wisdom", type: "signature", abilities: ["wisdom"], tier: 6, point: {x: -692, y: -400},
      connected: ["wis2a", "wis2b", "wis2c", "wis3a"], groups: {
        "sig3.wisdom.intellect": {abilities: ["wisdom", "intellect"], teleport: "sig3.intellect"},
      }});
    new CrucibleTalentNode({id: "wis3b", type: "spell", abilities: ["wisdom"], tier: 6,
      connected: ["wis2b", "wis2c", "wispre2", "sig3.wisdom"]})

    // Presence Quadrant
    new CrucibleTalentNode({id: "sig3.wisdom.presence", abilities: ["wisdom", "presence"], type: "signature", tier: 6,
      connected: ["wis2c", "wispre2", "pre2a", "wis3b"]});
    new CrucibleTalentNode({id: "pre3a", type: "spell", abilities: ["presence"], tier: 6,
      connected: ["wispre2", "pre2a", "pre2b", "sig3.wisdom.presence"]});
    new CrucibleTalentNode({id: "sig3.presence", type: "signature", abilities: ["presence"], tier: 6, point: {x: 0, y: -800},
      connected: ["pre2a", "pre2b", "pre2c", "pre3a"], groups: {}});
    new CrucibleTalentNode({id: "pre3b", type: "spell", abilities: ["presence"], tier: 6,
      connected: ["pre2b", "pre2c", "preint2", "sig3.presence"]})

    // Intellect Quadrant
    new CrucibleTalentNode({id: "sig3.presence.intellect", abilities: ["presence", "intellect"], type: "signature",
      tier: 6, connected: ["pre2c", "preint2", "int2a", "pre3b"]});
    new CrucibleTalentNode({id: "int3a", type: "spell", abilities: ["intellect"], tier: 6,
      connected: ["preint2", "int2a", "int2b", "sig3.presence.intellect"]});
    new CrucibleTalentNode({id: "sig3.intellect", type: "signature", abilities: ["intellect"], tier: 6,
      point: {x: 692, y: -400}, connected: ["int2a", "int2b", "int2c", "int3a"], groups: {}});
    const int3b = new CrucibleTalentNode({id: "int3b", type: "attack", abilities: ["intellect"], tier: 6,
      connected: ["int2b", "int2c", "intdex2", "sig3.intellect"]})
    sig3intdex.connect(int3b);

    /* -------------------------------------------- */
    /*  Tier 7: Level 5                             */
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
      {id: "wispre4", abilities: ["wisdom", "presence"], type: "spell", connected: ["wis3b", "sig3.wisdom.presence", "pre3a", "wis4d"]},
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
    for ( const n of TIER_4 ) new CrucibleTalentNode({...n, tier: 7});
    CrucibleTalentNode.nodes.get("intdex4").connect(CrucibleTalentNode.nodes.get("int4d"));
  }
}
