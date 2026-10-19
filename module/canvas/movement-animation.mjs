/*
 * Orchestration of token movement animation: the gait, footfalls, and (later) the movement timeline.
 * The decisions (CrucibleTokenObject#_getFootfalls) are system logic which survive V15 as overrides of core.
 * Everything in this file is interim support which core is expected to provide in V15, so it can be deleted then:
 * finding the material underfoot, editing materials on core Surface behaviors, and the movement animation manager.
 *
 * Intended core design for V15 (core#14852), which this implementation prototypes:
 * - Materials: core Surface behaviors (defineSurface) gain `material` and `materialVolume` fields, migrated from the
 *   `flags.core.material` and `flags.core.materialVolume` written here. One material applies to every plane the
 *   behavior places; `materialVolume` means the material fills the Region's elevation range (water), not only its
 *   planes. A registry of material ids and labels (here `crucible.CONFIG.footfalls.materials`) moves to core CONFIG.
 * - Finding the material underfoot: a material volume containing the token's foot, else a plane at exactly the
 *   foot's elevation, else nothing. Absent material is silence, so pits and open air make no footfalls.
 * - Waypoint splitting: core splits movement animations at the boundaries of Regions whose Surface behaviors have a
 *   material (by subscribing them to TOKEN_ANIMATE_IN/OUT when a material is set, or by including them directly when
 *   building the animation path), treating a material plane at a Region's top as inside even when the top is
 *   exclusive. The material is then found once per waypoint. Until then it is found per footfall here, which can lag a
 *   boundary by up to one footfall.
 * - Decision: a protected `Token#_getFootfalls(from, changes, options)`, called by core as each movement waypoint
 *   starts (as `_prepareAnimation` does here), returns null by default (opt-in). Systems override it to choose the
 *   mover, stride, hearing radius, and volume, as CrucibleTokenObject does. Modules need a hook or registration point
 *   to opt tokens in, since they cannot override a system's token class.
 * - Sounds: a core registry of sound sets for a (material, mover) pair, with a null material matching any material,
 *   and a playback strategy: individual footfalls (here) or a continuous loop (for example a galloping horse).
 * - Movement animation: footfalls are paced by distance walked, not time: a footfall lands each stride the token
 *   actually moves, measured from core's animated position each frame (here via `_onAnimationUpdate`), so speed
 *   changes and interruptions need no special handling. Core exposes this as `Token#movementAnimation` (as
 *   CrucibleTokenObject#movementAnimation does here) with a continuous `phase` in footfalls, so presentation layers
 *   such as Ember's dynamic token walk cycle follow the same rhythm as the sound. Playback is positional (walls,
 *   hearing radius) and silent for hidden tokens.
 * - Later: a movement timeline whose axis is distance walked, with labels at waypoints, Region crossings, and
 *   footfalls, so effects can attach to movement milestones; in V15 core may drive token movement itself from it.
 */

/**
 * @import {ElevatedPoint} from "@common/_types.mjs";
 * @import {RegionSurface} from "@client/documents/_types.mjs";
 * @import {CrucibleFootfallSound} from "../const/footfalls.mjs";
 * @import CrucibleTokenObject from "./token.mjs";
 */

/**
 * @typedef CrucibleFootfalls
 * @property {string} mover           The kind of mover, such as "footsteps"
 * @property {number} stride          The distance in distance units walked per footfall
 * @property {number} radius          The radius in distance units within which footfalls can be heard
 * @property {number} volume          A multiplier applied to the volume of each footfall
 */

/* -------------------------------------------- */

/**
 * Orchestrate the look and feel of a token's movement animation: its gait, footfalls, and movement timeline.
 * Sound, character animation, and effects all follow the distance the token actually walks, so they stay in step.
 */
export class CrucibleTokenMovementAnimation {
  /**
   * @param {CrucibleTokenObject} token   The token whose movement animation is tracked
   */
  constructor(token) {
    this.#token = token;
  }

  /**
   * The fields which edit the material of a core Surface behavior, localized on first use.
   * @type {foundry.data.fields.SchemaField}
   */
  static #materialSchema;

  /**
   * The token whose movement animation is tracked.
   * @type {CrucibleTokenObject}
   */
  #token;

  /**
   * The token's position when the movement animation last followed it.
   * @type {{x: number, y: number}}
   */
  #position = {x: 0, y: 0};

  /**
   * Is the token currently walking with footfalls?
   * @type {boolean}
   */
  get active() {
    return !!this.#footfalls;
  }

  /**
   * The footfalls of the movement waypoint currently animating, or null if the token is not making footfalls.
   * @type {CrucibleFootfalls|null}
   */
  get footfalls() {
    return this.#footfalls;
  }

  #footfalls = null;

  /**
   * The footfalls walked so far, continuous: a footfall lands each time it passes a whole number.
   * @type {number}
   */
  get phase() {
    return this.#phase;
  }

  #phase = 0;

  /* -------------------------------------------- */
  /*  Movement Animation                          */
  /* -------------------------------------------- */

  /**
   * Begin animating a movement waypoint, with the footfalls it makes or null for a silent one.
   * A footfall lands as soon as the token starts walking.
   * @param {CrucibleFootfalls|null} footfalls
   */
  beginWaypoint(footfalls) {
    const starting = footfalls && !this.#footfalls;
    this.#footfalls = footfalls;
    const {x, y} = this.#token.document;
    this.#position = {x, y};
    if ( !starting ) return;
    this.#phase = Math.ceil(this.#phase);
    this.#playFootfall();
  }

  /* -------------------------------------------- */

  /**
   * Finish animating the movement, once it completes or is interrupted.
   */
  endMovement() {
    this.#footfalls = null;
  }

  /* -------------------------------------------- */

  /**
   * Follow the token's animated position, advancing the phase by the distance moved and playing each footfall passed.
   */
  updatePosition() {
    if ( !this.#footfalls ) return;
    const {x, y} = this.#token.document;
    const moved = Math.hypot(x - this.#position.x, y - this.#position.y) / canvas.dimensions.distancePixels;
    this.#position = {x, y};
    const prior = this.#phase;
    this.#phase += moved / this.#footfalls.stride;
    if ( Math.floor(this.#phase) > Math.floor(prior) ) this.#playFootfall();
  }

  /* -------------------------------------------- */

  /**
   * Play a random sound for the mover and the material underfoot at the token's current position.
   * The material is found per footfall because core only splits movement animations at some Region boundaries.
   */
  #playFootfall() {
    const document = this.#token.document;
    if ( game.audio.locked || document.hidden ) return;
    const point = document.getCenterPoint();
    const material = CrucibleTokenMovementAnimation.getMaterial(document.parent, {...point, level: document.level});
    if ( !material ) return;
    const {mover, radius, volume} = this.#footfalls;
    const sound = CrucibleTokenMovementAnimation.getSound(material, mover);
    if ( sound?.playback !== "footfalls" ) return;
    const src = sound.src[Math.floor(Math.random() * sound.src.length)];
    // noinspection ES6MissingAwait
    canvas.sounds.playAtPosition(src, point, radius, {
      volume: volume * (0.5 + (Math.random() * 0.5)),
      easing: true,
      walls: true,
      gmAlways: false
    });
  }

  /* -------------------------------------------- */
  /*  Materials                                   */
  /* -------------------------------------------- */

  /**
   * Find the material underfoot at a point: a material volume containing it, else the surface it stands on.
   * The material is stored on core Surface behaviors as flags.core.material, which core is expected to migrate in V15.
   * @param {Scene} scene                               The scene containing the point
   * @param {ElevatedPoint & {level?: string}} point    The point underfoot
   * @returns {string|null}
   */
  static getMaterial(scene, point) {
    let material;

    // Volumes, whose material fills their whole elevation range, take precedence over surfaces
    for ( const region of scene.regions ) {
      if ( region.hidden || (point.level && !region.includedInLevel(point.level)) ) continue;
      material = CrucibleTokenMovementAnimation.#getVolumeMaterial(region, point);
      if ( material ) return material;
    }

    // The surface whose elevation is exactly that of the point
    for ( const surface of scene.getSurfaces({level: point.level, type: "move"}) ) {
      if ( surface.elevation !== point.elevation ) continue;
      if ( !surface.region.polygonTree.testPoint(point) ) continue;
      material = CrucibleTokenMovementAnimation.#getSurfaceMaterial(surface);
      if ( material ) return material;
    }

    // Legacy Ember surface material
    return CrucibleTokenMovementAnimation.#getEmberMaterial(scene, point);
  }

  /* -------------------------------------------- */

  /**
   * Add material controls to the configuration of core Surface behaviors.
   * @param {foundry.applications.sheets.RegionBehaviorConfig} app
   * @param {HTMLElement} element
   */
  static onRenderRegionBehaviorConfig(app, element) {
    const behavior = app.document;
    if ( behavior.type !== "defineSurface" ) return;
    const form = element.querySelector("[data-application-part=form]");
    if ( !form || form.querySelector("fieldset.crucible-footfalls") ) return;
    const schema = CrucibleTokenMovementAnimation.#getMaterialSchema();
    const fieldset = document.createElement("fieldset");
    fieldset.className = "crucible-footfalls";
    const legend = document.createElement("legend");
    legend.textContent = _loc("FOOTFALLS.Legend");
    fieldset.append(legend);
    const inputOptions = {material: {blank: ""}};
    for ( const [name, field] of Object.entries(schema.fields) ) {
      const value = behavior._source.flags.core?.[name] ?? field.initial;
      fieldset.append(field.toFormGroup({}, {name: `flags.core.${name}`, value, ...inputOptions[name]}));
    }
    form.append(fieldset);
  }

  /* -------------------------------------------- */

  /**
   * Get the material of Ember's legacy footstep data, for Ember scenes which do not yet use Surface behavior materials.
   * TODO: remove once Ember migrates its scenes to Surface behavior materials in V15.
   * @param {Scene} scene
   * @param {ElevatedPoint & {level?: string}} point
   * @returns {string|null}
   */
  static #getEmberMaterial(scene, point) {
    if ( !game.modules.get("ember")?.active ) return null;

    // An ember.footstepSurface Region containing the point, at any elevation
    for ( const region of scene.regions ) {
      if ( point.level && !region.includedInLevel(point.level) ) continue;
      const behavior = region.behaviors.find(b => !b.disabled && (b.type === "ember.footstepSurface"));
      if ( behavior?.system.material && region.polygonTree.testPoint(point) ) return behavior.system.material;
    }

    // The footstep surface configured for an Ember-managed scene
    return globalThis.ember.scene?.config.footstepSurface ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Get the fields which edit the material of a core Surface behavior, localized on first use.
   * @returns {foundry.data.fields.SchemaField}
   */
  static #getMaterialSchema() {
    if ( CrucibleTokenMovementAnimation.#materialSchema ) return CrucibleTokenMovementAnimation.#materialSchema;
    const {BooleanField, SchemaField, StringField} = foundry.data.fields;
    const schema = new SchemaField({
      material: new StringField({required: true, blank: true, initial: "",
        choices: () => crucible.CONFIG.footfalls.materials}),
      materialVolume: new BooleanField({initial: false})
    });
    foundry.helpers.Localization.localizeSchema(schema, ["FOOTFALLS"]);
    return CrucibleTokenMovementAnimation.#materialSchema = schema;
  }

  /* -------------------------------------------- */

  /**
   * Get the material of a surface from the Surface behavior of its Region which places it.
   * @param {RegionSurface} surface
   * @returns {string|null}
   */
  static #getSurfaceMaterial(surface) {
    const {bottom, top} = surface.region.elevation;
    const flat = bottom === top;
    const placements = surface.elevation === bottom ? ["bottom", "both"] : ["top", "both"];
    const behavior = surface.region.behaviors.find(b => !b.disabled && (b.type === "defineSurface")
      && b.flags.core?.material && (flat || placements.includes(b.system.placement)));
    return behavior?.flags.core.material ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Get the material of a Region volume which contains a point, inclusive of its bottom and top.
   * @param {RegionDocument} region
   * @param {ElevatedPoint} point
   * @returns {string|null}
   */
  static #getVolumeMaterial(region, point) {
    const {bottom, top} = region.elevation;
    if ( (point.elevation < bottom) || (point.elevation > top) ) return null;
    const behavior = region.behaviors.find(b => !b.disabled && (b.type === "defineSurface")
      && b.flags.core?.materialVolume && b.flags.core.material);
    if ( !behavior || !region.polygonTree.testPoint(point) ) return null;
    return behavior.flags.core.material;
  }

  /* -------------------------------------------- */
  /*  Sounds                                      */
  /* -------------------------------------------- */

  /**
   * Find the sound a mover makes on a material, falling back to a sound the mover makes on any material.
   * @param {string} material   The material underfoot
   * @param {string} mover      The kind of mover
   * @returns {CrucibleFootfallSound|null}
   */
  static getSound(material, mover) {
    let anyMaterial = null;
    for ( const sound of Object.values(crucible.CONFIG.footfalls.sounds) ) {
      if ( sound.mover !== mover ) continue;
      if ( sound.material === material ) return sound;
      if ( sound.material === null ) anyMaterial ??= sound;
    }
    return anyMaterial;
  }
}
