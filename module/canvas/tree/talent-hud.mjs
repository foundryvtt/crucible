import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";
import CrucibleTalentNode from "../../config/talent-node.mjs";
import CrucibleTalentItem from "../../models/item-talent.mjs";
import CrucibleTalentItemSheet from "../../applications/sheets/item-talent-sheet.mjs";
const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * An Application instance that renders a HUD tooltip in the CrucibleTalentTree
 */
export default class CrucibleTalentHUD extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "crucible-talent-hud",
    classes: ["crucible", "hud"],
    tag: "aside",
    window: {
      frame: false
    }
  }

  /** @override */
  static PARTS = {
    node: {
      template: "systems/crucible/templates/hud/talent-tree-node.hbs"
    },
    talent: {
      template: "systems/crucible/templates/hud/talent-tree-talent.hbs",
      templates: ["systems/crucible/templates/sheets/item/talent-summary.hbs"]
    }
  };

  /**
   * The target of the HUD, either a Node or a Talent
   * @type {CrucibleTalentTreeNode|CrucibleTalentTreeTalent}
   */
  target;

  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(options) {
    const parts = foundry.utils.deepClone(this.constructor.PARTS);
    if ( this.target instanceof CrucibleTalentTreeNode ) delete parts.talent;
    else delete parts.node;
    return parts;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options) {
    if ( this.target instanceof CrucibleTalentTreeNode ) return this.#getNodeContext();
    else return this.#getTalentContext();
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Node.
   * @returns {object}
   */
  #getNodeContext() {
    const actor = game.system.tree.actor;
    const node = this.target.node;
    const state = game.system.tree.state.get(node);
    const tags = [
      {label: `Tier ${node.tier}`},
      {label: game.i18n.localize(`TALENT.NODES.${node.type.toUpperCase()}`)}
    ];
    if ( state.banned ) tags.push({label: "Banned", class: "unmet"});
    else if ( !state.unlocked ) tags.push({label: "Locked", class: "unmet"});
    if ( !node.talents.size ) tags.push({label: "Empty", class: "unmet"});
    const reqs = CrucibleTalentNode.preparePrerequisites(node.requirements);
    return {
      id: node.id,
      tags,
      prerequisites: CrucibleTalentItem.testPrerequisites(actor, reqs)
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Talent.
   * @returns {object}
   */
  #getTalentContext() {
    const actor = game.system.tree.actor;
    const talent = this.target.talent;

    // Talent Tags
    const reqs = CrucibleTalentItem.testPrerequisites(actor, talent.system.prerequisites);

    // Banned Signature
    if ( talent.system.isSignature ) {
      for ( const node of talent.system.nodes ) {
        const state = game.system.tree.state.get(node);
        if ( state.banned && !state.purchased ) reqs.signature = {tag: "Banned", met: false};
      }
    }

    // Return context
    return {
      source: talent.toObject(),
      actions: CrucibleTalentItemSheet.prepareActions(talent.system.actions),
      prerequisites: reqs
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if ( existing ) existing.replaceWith(element);
    const hud = document.getElementById("hud");
    hud.appendChild(element);
  }

  /* -------------------------------------------- */

  /** @override */
  _replaceHTML(result, content, options) {
    content.replaceChildren(); // Always clear
    super._replaceHTML(result, content, options);
  }

  /* -------------------------------------------- */

  /** @override */
  _updatePosition({left, top}={}) {
    return {width: "auto", height: "auto", left, top, scale: 1.0};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(options) {
    super._onRender(options);
    this.element.classList.remove("hidden");
  }

  /* -------------------------------------------- */

  /**
   * Activate this HUD element, binding it to a target.
   * @param {CrucibleTalentTreeNode|CrucibleTalentTreeTalent} target    The target for the HUD
   * @returns {Promise<*>}
   */
  async activate(target) {
    this.target = target;
    const position = {
      left: target.x + (target.width / 2) + 10,
      top: target.y + - (target.height / 2)
    };
    if ( target instanceof CrucibleTalentTreeTalent ) {
      position.left += target.node.x;
      position.top += target.node.y;
    }
    return this.render({force: true, position});
  }

  /* -------------------------------------------- */

  /**
   * Temporarily hide the HUD element.
   */
  clear() {
    if ( !this.rendered ) return;
    this.element.classList.add("hidden");
  }
}
