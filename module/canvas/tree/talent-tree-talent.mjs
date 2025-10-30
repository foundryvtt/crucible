import CrucibleTalentIcon from "./talent-icon.mjs";


export default class CrucibleTalentTreeTalent extends CrucibleTalentIcon {
  constructor(node, talent, position) {
    super();
    this.node = node;
    this.talent = talent;
    this.position.set(position.x, position.y);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configure({active, accessible, ...config}={}) {
    config = super._configure(config);
    const spritesheet = crucible.tree.spritesheet;
    const {actions, rune, gesture, inflection, iconicSpells, training} = this.talent.system;
    const nodeColor = this.node.node.color;

    // Defaults
    config.texture = foundry.canvas.getTexture(this.talent.img);
    config.alpha = active ? 1.0 : 0.6;
    config.underglowColor = active ? nodeColor : null;
    config.frameTint = active ? 0xFFFFFF : 0x7f7f7f; // 50%
    config.iconTint = active ? 0xFFFFFF : Color.fromHSL([nodeColor.hsl[0], 0.05, 0.4]);

    // Active Talents
    if ( actions.length ) {
      config.shape = "rect";
      config.borderRadius = this.config.size / 6;
    }

    // Spellcraft Talents
    else if ( rune || gesture || inflection || iconicSpells ) {
      config.shape = "hex";
    }

    // Training Talents
    else if ( training.type && training.rank ) {
      config.shape = "hex";
    }

    // Passive Talents
    else config.shape = "circle";

    // Further configuration based on shape
    let shape = this.config.shape;
    switch (shape ) {
      case "circle":
        config.shape = "circle";
        config.size = 64;
        config.frameTexture = spritesheet.FrameCircleSmallBronzeShadow;
        break;
      case "hex":
        config.shape = "hex";
        config.size = 64;
        config.frameTexture = spritesheet.FrameHexSmallBronzeShadow;
        break;
      case "rect":
        config.shape = "rect";
        config.size = 64;
        config.frameTexture = spritesheet.FrameSquareSmallBronzeShadow;
        break;
    }
    return config;
  }

  /* -------------------------------------------- */

  /** @override */
  async draw(config) {
    await super.draw(config);
    this.icon.filters = config.accessible ? [] : [this.constructor.greyscaleFilter];
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

