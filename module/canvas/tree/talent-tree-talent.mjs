import CrucibleTalentIcon from "./talent-icon.mjs";


export default class CrucibleTalentTreeTalent extends CrucibleTalentIcon {
  constructor(node, talent, position, config) {
    super(config);
    this.node = node;
    this.talent = talent;
    this.position.set(position.x, position.y);
  }

  /** @override */
  async draw({active, accessible, ...config}={}) {

    // Style
    const {actions, rune, gesture, inflection, iconicSpells, training} = this.talent.system;
    if ( actions.length ) {
      this.config.shape = "rect";
      this.config.borderRadius = this.config.size / 6;
    }
    else if ( rune || gesture || inflection || iconicSpells ) {
      this.config.shape = "hex";
    }
    else if ( training.type && training.rank ) {
      this.config.shape = "hex";
    }
    else this.config.shape = "circle";

    // Talent State
    config.borderColor = active ? this.node.node.color : 0x444444;
    config.alpha = active ? 1.0 : 0.6;

    // Draw Icon
    await super.draw(config);
    this.icon.filters = accessible ? [] : [this.constructor.greyscaleFilter];
    this.#activateInteraction();
  }

  /* -------------------------------------------- */

  #activateInteraction() {
    this.removeAllListeners();
    this.on("pointerover", this.#onPointerOver.bind(this));
    this.on("pointerout", this.#onPointerOut.bind(this));
    this.on("pointerdown", this.#onClickLeft.bind(this));
    this.on("rightdown", this.#onClickRight.bind(this));
    this.eventMode = "static";
    this.cursor = "pointer";
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events on a Talent icon to add that talent to the Actor.
   * @param {PIXI.InteractionEvent} event
   * @returns {Promise<void>}
   */
  async #onClickLeft(event) {
    event.stopPropagation();
    if ( event.data.originalEvent.button !== 0 ) return; // Only support standard left-click
    const tree = game.system.tree;
    const actor = tree.actor;
    if ( !actor ) return;
    if ( !actor || actor.talentIds.has(this.talent.id) ) return;
    const response = await actor.addTalent(this.talent, {dialog: true, warnUnusable: true});
    if ( response ) crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */
  /**
   * Handle right-click events on a Talent icon to remove that talent from the Actor.
   * @param {PIXI.InteractionEvent} event
   * @returns {Promise<void>}
   */
  async #onClickRight(event) {
    event.stopPropagation();
    const tree = game.system.tree;
    const actor = tree.actor;
    if ( !actor ) return;
    if ( !actor.system.talentIds.has(this.talent.id) || actor.system.permanentTalentIds.has(this.talent.id) ) return;
    const response = await actor.removeTalent(this.talent, {dialog: true});
    if ( response ) crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Handle pointer-over events entering a talent icon within an expanded wheel.
   * @param {PIXI.InteractionEvent} event
   */
  #onPointerOver(event) {
    const tree = crucible.tree;
    if ( event.nativeEvent.target !== tree.canvas ) return;
    event.stopPropagation();
    this.scale.set(1.2, 1.2);
    tree.hud.activate(this);
  }

  /* -------------------------------------------- */

  /**
   * Handle pointer-out events leaving a talent icon within an expanded wheel.
   * @param {PIXI.InteractionEvent} event
   */
  #onPointerOut(event) {
    event.stopPropagation();
    this.scale.set(1.0, 1.0);
    game.system.tree.hud.clear();
  }
}

