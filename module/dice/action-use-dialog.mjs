import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * Prompt the user to activate an action which may involve the rolling of a standard dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {
  constructor({action, actor, targets, ...options}) {
    super(options);
    this.action = action;
    this.actor = actor;
    this.targets = targets;
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["action-roll"],
    position: {
      width: 400
    },
    window: {
      minimizable: true
    },
    actions: {
      placeTemplate: ActionUseDialog.#onPlaceTemplate
    }
  };

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/action-use-dialog.hbs";

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

  /**
   * The Action being performed
   * @type {CrucibleAction}
   */
  action;

  /**
   * The Actor performing the action.
   * @type {CrucibleActor}
   */
  actor;

  /**
   * The Tokens which are targeted by the action.
   * @type {CrucibleToken[]}
   */
  targets;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[${this.actor.name}] ${this.action.name}`
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tags = this._getTags();
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[this.action.target.type];
    this.#requiresTemplate = !!targetConfig?.template && !this.action.template
    return foundry.utils.mergeObject(context, {
      action: this.action,
      actor: this.actor,
      activationTags: tags.activation,
      actionTags: tags.action,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      hasContextTags: this.action.usage.context?.tags.size > 0,
      hasDice: this.action.usage.hasDice ?? false,
      hasTargets: !["self", "none"].includes(this.action.target.type),
      requiresTemplate: this.#requiresTemplate,
      targets: this.#prepareTargets()
    });
  }

  /* -------------------------------------------- */

  /**
   *
   * @returns {ActionUseTarget[]}
   */
  #prepareTargets() {
    const targets = this.#targetTemplate.targets ?? this.action.acquireTargets({strict: false});
    for ( const t of targets ) {
      t.cssClass = t.error ? "unmet" : "";
      t.tooltip = t.error ?? null;
    }
    return targets;
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
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Resolve dialog submission to enact a Roll.
   * @returns {StandardCheck}
   * @protected
   */
  _onRoll(_event, _button, _dialog) {
    this.action.usage.rollMode = this.rollMode;
    if ( "special" in this.roll.data.boons ) this.action.usage.boons.special = this.roll.data.boons.special;
    if ( "special" in this.roll.data.banes ) this.action.usage.banes.special = this.roll.data.banes.special;
    return this.action;
  }

  /* -------------------------------------------- */
  /*  Target Management                           */
  /* -------------------------------------------- */

  /**
   * Respond when the set of User Targets changes by re-rendering currently visible action use apps.
   */
  static debounceChangeTarget = foundry.utils.debounce(() => {
    for ( const app of foundry.applications.instances.values() ) {
      if ( app instanceof ActionUseDialog ) app.render();
    }
  }, 20);

  /* -------------------------------------------- */
  /*  Measured Template Management                */
  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the template targeting workflow
   * @this {ActionUseDialog}
   * @param {Event} event
   * @returns {Promise<void>}
   */
  static async #onPlaceTemplate(event) {

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
    const minimizedWindows = [];
    for ( const app of Object.values(ui.windows) ) {
      if ( !app.minimized ) {
        app.minimize();
        minimizedWindows.push(app);
      }
    }
    for ( const app of foundry.applications.instances.values() ) {
      if ( !app.minimized ) {
        app.minimize();
        minimizedWindows.push(app);
      }
    }

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
    const targets = this.#targetTemplate.targets = this.action.acquireTargets({strict: false});
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
