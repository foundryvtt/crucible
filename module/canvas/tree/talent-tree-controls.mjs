/**
 * An Application instance that renders the talent tree controls UI element.
 */
export default class CrucibleTalentTreeControls extends Application {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "crucible-talent-controls",
      template: "systems/crucible/templates/hud/talent-tree-controls.hbs",
      popOut: false
    });
  }

  /* -------------------------------------------- */

  /**
   * A convenience reference to the tree instance.
   * @returns {CrucibleTalentTree}
   */
  get tree() {
    return game.system.tree;
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options = {}) {
    return {
      actor: this.tree.actor,
      cssClass: this.options.classes.join(" ")
    };
  }

  /* -------------------------------------------- */

  _replaceHTML(element, html) {
    super._replaceHTML(element, html);
    crucible.tree.canvas.insertAdjacentElement("afterend", this._element[0]);
  }

  /* -------------------------------------------- */

  _injectHTML(html) {
    this._element = html;
    crucible.tree.canvas.insertAdjacentElement("afterend", this._element[0]);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    html.find("button.reset").click(() => this.tree.actor.resetTalents({dialog: true}));
    html.find("button.close").click(() => this.tree.close());
  }
}
