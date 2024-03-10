import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * Prompt the user to activate an action which may involve the rolling of a dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `systems/${SYSTEM.id}/templates/dice/action-use-dialog.hbs`,
      width: 360,
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /**
   * Track data related to a MeasuredTemplate preview for this Action.
   * @type {{object: MeasuredTemplate, activeLayer: CanvasLayer, minimizedSheets: Application[], config: object}}
   */
  #targetTemplate = {
    activeLayer: undefined,
    document: undefined,
    object: undefined,
    minimizedSheets: [],
    config: undefined,
    targets: undefined
  }

  /**
   * Is a MeasuredTemplate required before this dialog can be submitted?
   * @type {boolean}
   */
  #requiresTemplate = false;

  /* -------------------------------------------- */

  /**
   * The Action being performed
   * @type {CrucibleAction}
   */
  get action() {
    return this.options.action;
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const {actor, action} = this.options;
    return `[${actor.name}] ${action.name}`
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    const {actor, action} = this.options;
    const tags = this._getTags();
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[action.target.type];
    this.#requiresTemplate = !!targetConfig?.template && !action.template
    return foundry.utils.mergeObject(context, {
      action: action,
      actor: actor,
      activationTags: tags.activation,
      actionTags: tags.action,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      hasContextTags: action.usage.context?.tags.size > 0,
      hasDice: action.usage.hasDice ?? false,
      requiresTemplate: this.#requiresTemplate,
      targets: this.#targetTemplate.targets ?? action.acquireTargets()
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the tags that apply to this dialog.
   * @returns {ActionTags}
   * @protected
   */
  _getTags() {
    return this.action.getTags();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("button.place-template").click(this.#onPlaceTemplate.bind(this));
    for ( const button of html.find(".dialog-button") ) {
      if ( this.#requiresTemplate ) button.disabled = true;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onSubmit(html) {
    const form = html.querySelector("form");
    const fd = (new FormDataExtended(form, {readonly: true})).object;
    this.action.usage.rollMode = fd.rollMode;
    if ( "special" in this.roll.data.boons ) this.action.usage.boons.special = this.roll.data.boons.special;
    if ( "special" in this.roll.data.banes ) this.action.usage.banes.special = this.roll.data.banes.special;
    return this.action;
  }

  /* -------------------------------------------- */

  /**
   * Respond when the set of User Targets changes by re-rendering currently visible action use apps.
   */
  static debounceChangeTarget = foundry.utils.debounce(() => {
    for ( const app of Object.values(ui.windows) ) {
      if ( !(app instanceof ActionUseDialog) ) continue;
      app.render();
    }
  }, 20);

  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the template targeting workflow
   * @param {Event} event      The originating click event
   */
  async #onPlaceTemplate(event) {
    event.preventDefault();

    // Deactivate any previous template preview
    this.#deactivateTemplate(event);

    // Reference required data
    const {actor, range, target} = this.action;
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[target.type]?.template;
    if ( !targetConfig ) return;
    const tokens = actor.getActiveTokens();
    const token = tokens[0] || null;
    const activeLayer = canvas.activeLayer;

    // TODO find a better place for this?
    if ( target.type === "summon" ) {
      const summon = await fromUuid(this.action.usage.summon);
      if ( summon ) {
        target.width = summon.prototypeToken.width;
        target.height = summon.prototypeToken.height;
      }
    }

    // Create a temporary Measured Template document and PlaceableObject
    const templateData = await this.#getTemplateData(token, range, target, targetConfig);
    const template = await canvas.templates._createPreview(templateData, {renderSheet: false});
    template.document._object = template; // FIXME this is a bit of a hack

    // Minimize open windows
    const minimizedWindows = Object.values(ui.windows).reduce((arr, app) => {
      if ( !app.minimized ) {
        app.minimize();
        arr.push(app);
      }
      return arr;
    }, []);

    // Store preview template data
    this.#targetTemplate = {
      activeLayer,
      config: Object.assign({}, targetConfig, target),
      document: template.document,
      object: template,
      origin: {x: template.document.x, y: template.document.y},
      minimizedWindows
    }
    this.#activateTemplate(template);
  }

  /* -------------------------------------------- */

  #getTemplateData(token, range, target, targetConfig) {
    const {x, y} = token?.center ?? canvas.dimensions.rect.center;
    const {id: userId, color: fillColor} = game.user;
    const s = canvas.dimensions.size;
    const baseSize = Math.max(token?.document.width ?? 1, token?.document.height ?? 1) * canvas.dimensions.distance;
    const distance = (range.maximum ?? 0) + (targetConfig.distanceOffset * baseSize);
    const templateData = {user: userId, x, y, fillColor, distance, ...targetConfig};
    switch ( target.type ) {
      case "blast":
        templateData.distance = target.size ?? 1;
        break;
      case "pulse":
        const shape = token.getEngagementRectangle(distance);
        Object.assign(templateData, {
          x: shape.x,
          y: shape.y,
          distance: Math.hypot(shape.width, shape.height) / s,
          direction: 45
        });
        break;
      case "ray":
        templateData.width = target.size ?? targetConfig.width;
        break;
      case "summon":
        Object.assign(templateData, {
          distance: Math.hypot(target.width, target.height),
          direction: 45
        });
        break;
      case "wall":
        templateData.width = target.size ?? targetConfig.width;
        break;
    }
    return templateData;
  }

  /* -------------------------------------------- */
  /*  Preview Template Management                 */
  /* -------------------------------------------- */

  /**
   * Register interactivity for the preview template placement
   */
  #activateTemplate() {
    this.#targetTemplate.events = {
      contextmenu: this.#cancelTemplate.bind(this),
      mousedown: this.#confirmTemplate.bind(this),
      mousemove: this.#moveTemplate.bind(this),
    }
    canvas.stage.on("mousemove", this.#targetTemplate.events.mousemove);
    canvas.stage.on("mousedown", this.#targetTemplate.events.mousedown);
    canvas.app.view.addEventListener("contextmenu", this.#targetTemplate.events.contextmenu);
  }

  /* -------------------------------------------- */

  /**
   * Deactivate the preview template placement workflow.
   * @param {Event} event     An initiating event that leads to workflow deactivation
   */
  #deactivateTemplate(event) {
    const {document, object, events, activeLayer} = this.#targetTemplate;
    if ( !object ) return;
    canvas.templates._onDragLeftCancel(event);
    document._object = object; // FIXME workaround

    // Deactivate mouse events
    canvas.stage.off("mousemove", events.mousemove);
    canvas.stage.off("mousedown", events.mousedown);
    canvas.app.view.removeEventListener("contextmenu", events.contextmenu);

    // Restore the original canvas layer
    activeLayer.activate(event);

    // Maximize prior UI windows
    for ( const app of this.#targetTemplate.minimizedWindows ) app.maximize();
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
   * @param {Event} event     The mousedown event
   */
  #confirmTemplate(event) {
    event.stopPropagation();
    this.action.template = this.#targetTemplate.document;
    const targets = this.#targetTemplate.targets = this.action.acquireTargets();
    if ( targets.length ) {
      for ( const [i, {token}] of targets.entries() ) {
        token.setTarget(true, {releaseOthers: i === 0, groupSelection: i < targets.length - 1});
      }
    } else game.user.targets.clear();
    this.#deactivateTemplate(event);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Move the position of the template during mousemove
   * @param {Event} event     The mousemove event
   */
  #moveTemplate(event) {
    event.stopPropagation();
    const {config, moveTime, object, origin} = this.#targetTemplate;
    const s = canvas.dimensions.size;
    const update = {};

    // Apply a 16ms throttle
    const now = Date.now();
    if ( now - (moveTime || 0) <= 16 ) return;
    this.#targetTemplate.moveTime = now;

    // Identify the mouse cursor position
    let cursor = event.getLocalPosition(canvas.templates);
    const ray = new Ray(origin, {x: cursor.x, y: cursor.y});
    if ( Number.isNumeric(config.distance) ) {
      const maxDistance = (config.distance * s);
      if ( ray.distance > maxDistance ) cursor = ray.project((config.distance * s) / ray.distance);
    }

    // Identify the resulting template coordinates
    let p;
    if ( config.anchor === "vertex" ) p = canvas.grid.getTopLeftPoint(cursor);
    else if ( config.anchor === "center" ) p = canvas.grid.getCenterPoint(cursor);
    if ( p !== undefined ) Object.assign(update, p);

    // Update the pending template and re-render
    if ( config.directionDelta ) update.direction = Math.toDegrees(ray.angle).toNearest(config.directionDelta);
    object.document.updateSource(update);
    object.renderFlags.set({refreshShape: true});
  }

  /* -------------------------------------------- */

  /**
   * Expose an internal method that subclasses can use to clear a target template.
   * @internal
   */
  _clearTargetTemplate() {
    if ( this.action.template ) {
      this.#targetTemplate = {};
      this.action.template = null;
      game.user.targets.clear();
    }
  }
}
