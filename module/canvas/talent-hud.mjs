import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";
import TalentData from "../data/talent.mjs";

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
    const context = {};
    const node = this.target.node;
    const prerequisites = TalentData.preparePrerequisites(node.requirements, {});
    context.node = {
      type: game.i18n.localize(`TALENT.Node${node.type.titleCase()}`),
      tier: node.tier,
      talents: node.talents.size,
    }
    context.prerequisites = {};
    for ( let [k, v] of Object.entries(prerequisites || {}) ) {
      context.prerequisites[k] = `${v.label} ${v.value}`;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Talent.
   * @returns {object}
   */
  #getTalentContext() {
    const talent = this.target.talent;
    const source = talent.toObject();
    return {
      item: talent,
      source: source,
      hasActions: talent.actions.length,
      tags: talent.getTags()
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
      width: this.target instanceof CrucibleTalentTreeNode ? 320 : 460,
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
