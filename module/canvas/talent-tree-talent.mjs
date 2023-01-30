import CrucibleTalentIcon from "./talent-icon.mjs";


export default class CrucibleTalentTreeTalent extends CrucibleTalentIcon {
  constructor(node, talent, position, config) {
    super(config);

    // Node assignment
    this.node = node;
    this.talent = talent;

    // Position
    this.position.set(position.x, position.y);

    // Mouse Interaction
    this.interactionManager = new MouseInteractionManager(this, canvas.stage, {
      hoverIn: true,
      hoverOut: true
    }, {
      hoverIn: this.#onPointerOver,
      hoverOut: this.#onPointerOut,
      clickLeft: this.#onClickLeft,
      clickRight: this.#onClickRight
    });
    this.interactionManager.activate();
  }

  /** @override */
  async draw(config) {
    await super.draw(config);
    this.icon.filters = this.config.accessible ? [] : [this.constructor.greyscaleFilter];
  }

  #onClickLeft(event) {
    const tree = game.system.tree;
    if ( !tree.actor || tree.actor.talentIds.has(this.talent.id) ) return;
    tree.actor.addTalent(this.talent, {dialog: true});
  }

  #onClickRight(event) {
    const tree = game.system.tree;
    if ( !tree.actor || !tree.actor.talentIds.has(this.talent.id) ) return;
    const talent = tree.actor.items.get(this.talent.id);
    return talent.deleteDialog();
  }

  #onPointerOver(event) {
    this.scale.set(1.2, 1.2);
    game.system.tree.hud.activate(this);
  }

  #onPointerOut(event) {
    this.scale.set(1.0, 1.0);
    game.system.tree.hud.clear();
  }
}

