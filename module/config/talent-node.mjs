import CrucibleTalentItem from "../models/item-talent.mjs";
import {ABILITIES} from "./attributes.mjs";
import {default as TREE_CONFIG} from "./tree.mjs";

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
   * Is this node passive?
   * Passive nodes contain no Talents which provide Actions.
   * @type {boolean}
   */
  get isPassive() {
    if ( (this.type === "signature") || (this.type === "training") ) return false; // Never passive
    for ( const t of this.talents ) {
      if ( t.actions.length ) return false;
      const {rune, gesture, inflection} = t.system;
      if ( rune || gesture || inflection ) return false; // Spellcraft components count as active
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Is this node a training node?
   * @type {boolean}
   */
  get isTraining() {
    if ( this.type === "training" ) return true;
    for ( const t of this.talents ) {
      if ( t.system.training.type ) return true;
    }
    return false;
  }

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
    this.requirements = this.#getRequirements();
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

  #getRequirements() {
    const tierConfig = SYSTEM.TALENT.NODE_TIERS[this.tier];
    const reqs = {"advancement.level": tierConfig.level};
    const discount = (this.abilities.size > 1) && !this.groups ? 1 : 0;
    for ( const ability of this.abilities ) {
      reqs[`abilities.${ability}.value`] = Math.max(tierConfig.ability - discount, 1);
    }
    return reqs;
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
    if ( actor.system.talentNodes[this.id]?.size ) return true; // Purchased via an owned talent
    return actor.system.advancement.talentNodes.has(this.id);   // Purchased as an empty node
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
    for ( const {nodes, ...config} of TREE_CONFIG ) createNodes(nodes, config);

    // Empty nodes for each tier to hold placeholder talents
    for ( let i=1; i<=18; i++ ) {
      new CrucibleTalentNode({
        id: `none${i}`,
        type: "utility",
        tier: i,
        abilities: ["dexterity", "toughness", "strength", "wisdom", "presence", "intellect"],
        connected: [],
        angle: 0,
        distance: 0
      });
    }
  }
}
