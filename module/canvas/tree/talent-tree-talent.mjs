import CrucibleTalentIcon from "./talent-icon.mjs";


export default class CrucibleTalentTreeTalent extends CrucibleTalentIcon {
  constructor(node, talent, position) {
    super();
    this.node = node;
    this.talent = talent;
    this.position.set(position.x, position.y);
  }

  /* -------------------------------------------- */

  /**
   * Whether this talent's description should be locked
   * @type {boolean}
   */
  #locked = false;

  /**
   * Whether this talent's description would be displayed if not locked
   * @type {boolean}
   */
  #showIfUnlocked = false;

  /**
   * Whether this talent's description is locked
   * @type {boolean}
   */
  get isLocked() {
    return this.#locked;
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
    const shape = this.config.shape;
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

  /**
   * Toggle description lock state. If unlocking & not still hovered, act as if hovered out
   */
  toggleLock() {
    this.#locked = !this.#locked;
    crucible.tree.hud.classList.toggle("locked", this.#locked);
    if ( !this.#locked && !this.#showIfUnlocked ) {
      this.scale.set(1.0, 1.0);
      crucible.tree.hud.clear();
    }
  }

  /* -------------------------------------------- */

  #activateInteraction() {
    this.removeAllListeners();
    this.on("pointerover", this.#onPointerOver.bind(this));
    this.on("pointerout", this.#onPointerOut.bind(this));
    this.on("pointerdown", this.#onPointerDown.bind(this));
    this.on("rightdown", this.#onClickRight.bind(this));
    this.eventMode = "static";
    this.cursor = "pointer";
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click or middle-click events on a Talent icon to lock description or add talent to Actor.
   * @param {PIXI.InteractionEvent} event
   */
  async #onPointerDown(event) {
    event.stopPropagation();
    switch ( event.data.originalEvent.button ) {
      case 0:
        this.#onClickLeft(event);
        break;
      case 1:
        if ( crucible.tree.hud.target === this ) this.toggleLock();
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events on a Talent icon to add that talent to the Actor.
   * @param {PIXI.InteractionEvent} event
   * @returns {Promise<void>}
   */
  async #onClickLeft(event) {
    const tree = game.system.tree;

    // If a talent description is locked, unlock it, and do nothing more if that talent isn't the clicked one
    if ( tree.hud.target?.isLocked ) {
      const lockedTalent = tree.hud.target;
      lockedTalent.toggleLock();
      this.#onPointerOver(event);
      if ( lockedTalent !== this ) return;
    }
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
    if ( (event.nativeEvent.target !== tree.canvas) ) return;
    if ( tree.hud.target?.isLocked ) return;
    event.stopPropagation();
    this.#showIfUnlocked = true;
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
    this.#showIfUnlocked = false;
    if ( crucible.tree.hud.target?.isLocked ) return;
    this.scale.set(1.0, 1.0);
    game.system.tree.hud.clear();
  }
}

