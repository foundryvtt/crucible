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

    // Talent State
    config.borderRadius = 8;
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

  async #onClickLeft(event) {
    event.stopPropagation();
    if ( event.data.originalEvent.button !== 0 ) return; // Only support standard left-click
    const tree = game.system.tree;
    if ( !tree.actor || tree.actor.talentIds.has(this.talent.id) ) return;
    const response = await tree.actor.addTalent(this.talent, {dialog: true});
    if ( response ) tree.playClick();
  }

  /* -------------------------------------------- */

  async #onClickRight(event) {
    event.stopPropagation();
    const tree = game.system.tree;
    const actor = tree.actor;
    if ( !actor || !actor.talentIds.has(this.talent.id) || actor.permanentTalentIds.has(this.talent.id) ) return;
    const talent = tree.actor.items.get(this.talent.id);
    const response = await talent.deleteDialog();
    if ( response ) tree.playClick();
  }

  /* -------------------------------------------- */

  #onPointerOver(event) {
    event.stopPropagation();
    this.scale.set(1.2, 1.2);
    game.system.tree.hud.activate(this);
  }

  /* -------------------------------------------- */

  #onPointerOut(event) {
    event.stopPropagation();
    this.scale.set(1.0, 1.0);
    game.system.tree.hud.clear();
  }
}

