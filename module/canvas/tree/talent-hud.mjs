import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";
import CrucibleTalentNode from "../../const/talent-node.mjs";
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
   * @returns {Promise<object>}
   */
  async #getNodeContext() {
    const actor = game.system.tree.actor;
    const node = this.target.node;
    const state = game.system.tree.state.get(node);
    const tagGroups = [];

    // Node tags
    const nodeTags = [{label: `Tier ${node.tier}`}, {label: node.id}];
    if ( state.banned ) nodeTags.push({label: "Banned", class: "unmet"});
    else if ( !state.unlocked ) nodeTags.push({label: "Locked", class: "unmet"});
    if ( !node.talents.size ) nodeTags.push({label: "Empty", class: "unmet"});
    const nodeType = game.i18n.localize(`TALENT.NODES.${node.type.toUpperCase()}`);
    tagGroups.push({
      id: node.type,
      label: `${nodeType} Node`,
      tags: nodeTags
    });

    // Prerequisite tags
    const requirements = CrucibleTalentNode.preparePrerequisites(node.requirements);
    const reqTags = CrucibleTalentItem.testPrerequisites(actor, requirements);
    for ( const tag of Object.values(reqTags) ) {
      tag.label = tag.tag;
      tag.cssClass = tag.met ? "met" : "unmet";
    }
    tagGroups.push({
      id: "prerequisites",
      label: "Prerequisites",
      tags: reqTags
    })
    return {id: node.id, tagGroups};
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Talent.
   * @returns {Promise<object>}
   */
  async #getTalentContext() {
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
      descriptionHTML: await CONFIG.ux.TextEditor.enrichHTML(talent.system.description, {relativeTo: talent}),
      actions: await CrucibleTalentItemSheet.prepareActions(talent),
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
    const existing = document.getElementById(content.id);
    if ( existing ) {
      content.replaceChildren(); // Always clear
      return super._replaceHTML(result, content, options);
    }
    const hud = document.getElementById("hud");
    hud.appendChild(content);
  }

  /* -------------------------------------------- */

  /** @override */
  _updatePosition({left, top}={}) {
    return {width: "auto", height: "auto", left, top, scale: 1.0};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
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
