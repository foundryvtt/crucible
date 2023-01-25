import CrucibleTalentNode from "../config/talent-tree.mjs";

/**
 * An Application instance that renders a HUD tooltip in the CrucibleTalentTree
 */
export default class CrucibleTalentHUD extends Application {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "crucible-talent-hud",
      template: "systems/crucible/templates/hud/talent-hud.hbs",
      width: 460,
      height: "auto",
      popOut: false
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options = {}) {
    const source = this.talent.toObject();
    return {
      item: this.talent,
      source: source,
      hasActions: this.talent.actions.length,
      tags: this.talent.getTags()
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
      width: this.options.width,
      height: undefined,
      left: left,
      top: top
    };
    this.element.css(position);
  }

  /* -------------------------------------------- */

  async activate(talentIcon) {
    this.talent = talentIcon.talent;
    const options = {
      left: talentIcon.node.x + talentIcon.x + (talentIcon.width / 2) + 10,
      top: talentIcon.node.y + talentIcon.y - (talentIcon.height / 2)};
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
