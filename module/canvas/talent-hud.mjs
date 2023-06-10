import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";
import CrucibleTalent from "../data/talent.mjs";
import TalentSheet from "../applications/sheets/talent.mjs";

/**
 * An Application instance that renders a HUD tooltip in the CrucibleTalentTree
 */
export default class CrucibleTalentHUD extends Application {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "crucible-talent-hud",
      popOut: false
    });
  }

  /**
   * The target of the HUD, either a Node or a Talent
   * @type {CrucibleTalentTreeNode|CrucibleTalentTreeTalent}
   */
  target;

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/crucible/templates/hud"
    const template = this.target instanceof CrucibleTalentTreeNode ? "talent-tree-node.hbs" : "talent-tree-talent.hbs";
    return `${path}/${template}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options = {}) {
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
      {label: game.i18n.localize(`TALENT.Node${node.type.titleCase()}`)}
    ];
    if ( node.twin ) tags.push({label: "Twinned"});
    if ( state.banned ) tags.push({label: "Banned", class: "unmet"});
    else if ( !state.unlocked ) tags.push({label: "Locked", class: "unmet"});
    const reqs = CrucibleTalent.preparePrerequisites(node.requirements, {});
    return {
      id: node.id,
      tags,
      prerequisites: CrucibleTalent.testPrerequisites(actor, reqs)
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
    const node = talent.system.node;

    // Talent Tags
    const reqs = CrucibleTalent.testPrerequisites(actor, talent.system.prerequisites);
    const state = game.system.tree.state.get(node);

    // Banned Signature
    if ( node.type === "signature" ) {
      if ( (state.purchased && !actor.talentIds.has(talent.id)) || state.banned ) {
        reqs.signature = {tag: "Banned", met: false};
      }
    }

    // Return context
    return {
      source: talent.toObject(),
      actions: TalentSheet.prepareActions(talent.system.actions),
      prerequisites: reqs
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _injectHTML(html) {
    const hud = document.getElementById("hud");
    hud.appendChild(html[0]);
    this._element = html;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition({left, top}={}) {
    const position = {
      height: undefined,
      left: left,
      top: top
    };
    this.element.css(position);
  }

  /* -------------------------------------------- */

  /**
   * Activate this HUD element, binding it to a target.
   * @param {CrucibleTalentTreeNode|CrucibleTalentTreeTalent} target    The target for the HUD
   * @returns {Promise<*>}
   */
  async activate(target) {
    this.target = target;
    const options = {
      left: target.x + (target.width / 2) + 10,
      top: target.y + - (target.height / 2)
    };
    if ( target instanceof CrucibleTalentTreeTalent ) {
      options.left += target.node.x;
      options.top += target.node.y;
    }
    return this._render(true, options);
  }

  /* -------------------------------------------- */

  /**
   * Clear the HUD
   */
  clear() {
    let states = this.constructor.RENDER_STATES;
    if ( this._state <= states.NONE ) return;
    this._state = states.CLOSING;
    this.element.hide();
    this._element = null;
    this._state = states.NONE;
  }
}
