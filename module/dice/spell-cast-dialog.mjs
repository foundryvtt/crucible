import {SYSTEM} from "../config/system.js";
import ActionUseDialog from "./action-use-dialog.mjs";

/**
 * Prompt the user to configure a spell they wish to cast.
 */
export default class SpellCastDialog extends ActionUseDialog {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `systems/${SYSTEM.id}/templates/dice/spell-cast-dialog.hbs`,
      classes: [SYSTEM.id, "sheet", "roll", "spell"]
    });
  }

  /**
   * Track data related to a MeasuredTemplate preview for this Action.
   * TODO: this should be moved and generalized to the parent ActionUseDialog class.
   * @type {{object: MeasuredTemplate, activeLayer: CanvasLayer, minimizedSheets: Application[], config: object}}
   */
  #template = {
    activeLayer: undefined,
    object: undefined,
    minimizedSheets: [],
  }

  /**
   * Is a MeasuredTemplate required before this dialog can be submitted?
   * TODO: this should be moved and generalized to the parent ActionUseDialog class.
   * @type {boolean}
   */
  #requiresTemplate = false;

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options) {
    const spell = this.action;
    const actor = spell.actor;

    // Spellcraft Components
    const runes = Array.from(actor.grimoire.runes);
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures);
    gestures.sort((a, b) => a.name.localeCompare(b.name));
    const inflections = Array.from(actor.grimoire.inflections);
    inflections.sort((a, b) => a.name.localeCompare(b.name));

    // Scaling
    const ability = actor.getAbilityBonus([...spell.scaling]);

    // Target Type
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[spell.target.type];
    const targets = spell.acquireTargets();
    this.#requiresTemplate = !!targetConfig?.template && !spell.template;

    // Merge context
    const context = await super.getData(options);
    return foundry.utils.mergeObject(context, {
      ability, runes, gestures, inflections,
      chooseDamageType: spell.rune.id === "kinesis",
      damageTypes: {
        bludgeoning: SYSTEM.DAMAGE_TYPES.bludgeoning.label,
        piercing: SYSTEM.DAMAGE_TYPES.piercing.label,
        slashing: SYSTEM.DAMAGE_TYPES.slashing.label,
      },
      requiresTemplate: this.#requiresTemplate,
      targets
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("select.component").change(this.#onChangeComponent.bind(this));
    html.find("button.place-template").click(this.#onPlaceTemplate.bind(this));
    for ( const button of html.find(".dialog-button") ) {
      if ( this.#requiresTemplate ) button.disabled = true;
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the dialog when spell components are changed.
   * @param {Event} event     The input change event
   */
  #onChangeComponent(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const form = select.form;
    const fd = (new FormDataExtended(form)).object;
    this.action.updateSource(fd);
    this.render(true, {height: "auto"});
  }

  /* -------------------------------------------- */

  async #onPlaceTemplate(event) {
    event.preventDefault();

    // Deactivate any previous template preview
    this.#deactivateTemplate(event);

    // Reference required data
    const {actor, target} = this.action;
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[target.type]?.template;
    if ( !targetConfig ) return;
    const tokens = actor.getActiveTokens();
    const activeLayer = canvas.activeLayer;

    // Create a temporary Measured Template document and PlaceableObject
    const {x, y} = tokens.length ? tokens[0].center : {x: 1000, y: 1000}; // TODO cursor position?
    const {id: userId, color: fillColor} = game.user;
    const distance = target.distance + targetConfig.distanceOffset;
    const templateData = {user: userId, x, y, fillColor, distance, ...targetConfig};
    const template = await canvas.templates._createPreview(templateData, {renderSheet: false});

    // Minimize open windows
    const minimizedWindows = Object.values(ui.windows).reduce((arr, app) => {
      if ( !app.minimized ) {
        app.minimize();
        arr.push(app);
      }
      return arr;
    }, []);

    // Store preview template data
    this.#template = {
      activeLayer,
      config: targetConfig,
      object: template,
      minimizedWindows
    }
    this.#activateTemplate(template);

    // Activate interaction handlers
    return this.#template;
  }

  /* -------------------------------------------- */
  /*  Preview Template Management                 */
  /* -------------------------------------------- */

  #activateTemplate() {
    this.#template.events = {
      contextmenu: this.#cancelTemplate.bind(this),
      mousedown: this.#confirmTemplate.bind(this),
      mousemove: this.#moveTemplate.bind(this),
    }
    canvas.stage.on("mousemove", this.#template.events.mousemove);
    canvas.stage.on("mousedown", this.#template.events.mousedown);
    canvas.app.view.addEventListener("contextmenu", this.#template.events.contextmenu);
  }

  /* -------------------------------------------- */

  /**
   * Deactivate the preview template placement workflow.
   * @param {Event} event     An initiating event that leads to workflow deactivation
   */
  #deactivateTemplate(event) {
    const {object, events, activeLayer} = this.#template;
    if ( !object ) return;
    canvas.templates._onDragLeftCancel(event);
    canvas.stage.off("mousemove", events.mousemove);
    canvas.stage.off("mousedown", events.mousedown);
    canvas.app.view.oncontextmenu = null;

    // Activate the original canvas layer
    activeLayer.activate(event);

    // Maximize prior UI windows
    for ( const app of this.#template.minimizedWindows ) app.maximize();
    this.#template = {};
  }

  /* -------------------------------------------- */

  /**
   * Cancel the template placement workflow on right-click.
   * @param {Event} event     The contextmenu event
   */
  #cancelTemplate(event) {
    event.preventDefault();
    this.#deactivateTemplate(event);
  }

  /* -------------------------------------------- */

  /**
   * Conclude the template placement workflow on left-click.
   * @param {Event} event     The mousedown eventt
   */
  #confirmTemplate(event) {
    event.stopPropagation();
    this.action.template = this.#template.object;
    const targets = this.action.acquireTargets(); // TODO this is clunky, core should provide a bulk setTargets method
    if ( targets.length ) {
      for ( const [i, {token}] of targets.entries() ) {
        token.setTarget(true, {releaseOthers: i === 0, groupSelection: i < targets.length - 1});
      }
    } else game.user.targets.clear();
    this.#deactivateTemplate(event);

  }

  /* -------------------------------------------- */

  #moveTemplate(event) {
    event.stopPropagation();
    const {config, moveTime, object} = this.#template;
    const doc = object.document;

    // Apply a 16ms throttle
    const now = Date.now();
    if ( now - (moveTime || 0) <= 16 ) return;
    this.#template.moveTime = now;

    // Apply mouse cursor position
    const cursor = event.getLocalPosition(canvas.templates);
    const [x, y] = canvas.grid.getCenter(cursor.x, cursor.y);

    // Determine template direction
    const update = {};
    if ( config.anchor !== "self" ) Object.assign(update, {x, y});
    if ( config.directionDelta ) {
      const r = new Ray({x: doc.x, y: doc.y}, {x, y});
      update.direction = Math.toDegrees(r.angle).toNearest(config.directionDelta);
    }
    object.document.updateSource(update);
    object.renderFlags.set({refreshShape: true});
  }
}
