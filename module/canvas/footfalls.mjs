/*
 * Footfall playback, kept apart from the decision of what footfalls a token makes.
 * The decision (CrucibleTokenObject#_getFootfalls) is system logic which survives V15 as an override of core.
 * Everything in this file is interim support which core is expected to provide in V15, so it can be deleted then:
 * finding the material underfoot, editing materials on core Surface behaviors, and playback.
 */

/**
 * @import {RegionSurface} from "@client/documents/_types.mjs";
 * @import {CrucibleFootfallSound} from "../const/footfalls.mjs";
 * @import CrucibleTokenObject from "./token.mjs";
 */

/**
 * @typedef CrucibleFootfalls
 * @property {string} material        The material underfoot
 * @property {string} mover           The kind of mover, such as "footsteps"
 * @property {number} interval        Milliseconds between footfalls
 * @property {number} radius          The radius in distance units within which footfalls can be heard
 * @property {number} volume          A multiplier applied to the volume of each footfall
 */

/* -------------------------------------------- */
/*  Materials                                   */
/* -------------------------------------------- */

/**
 * Find the material underfoot at a point: a material volume containing it, else the surface it stands on.
 * The material is stored on core Surface behaviors as flags.core.material, which core is expected to migrate in V15.
 * @param {CrucibleTokenObject} token                 The moving token
 * @param {ElevatedPoint & {level?: string}} point    The point underfoot
 * @returns {string|null}
 */
export function getMaterial(token, point) {
  const scene = token.document.parent;
  let material;

  // Volumes, whose material fills their whole elevation range, take precedence over surfaces
  for ( const region of scene.regions ) {
    if ( region.hidden || (point.level && !region.includedInLevel(point.level)) ) continue;
    material = getVolumeMaterial(region, point);
    if ( material ) return material;
  }

  // The surface whose elevation is exactly that of the point
  for ( const surface of scene.getSurfaces({level: point.level, type: "move"}) ) {
    if ( surface.elevation !== point.elevation ) continue;
    if ( !surface.region.polygonTree.testPoint(point) ) continue;
    material = getSurfaceMaterial(surface);
    if ( material ) return material;
  }

  // Legacy Ember surface material
  return getEmberMaterial(scene, point);
}

/* -------------------------------------------- */

/**
 * Add material controls to the configuration of core Surface behaviors.
 * @param {foundry.applications.sheets.RegionBehaviorConfig} app
 * @param {HTMLElement} element
 */
export function onRenderRegionBehaviorConfig(app, element) {
  const behavior = app.document;
  if ( behavior.type !== "defineSurface" ) return;
  const form = element.querySelector("[data-application-part=form]");
  if ( !form || form.querySelector("fieldset.crucible-footfalls") ) return;
  const schema = getMaterialSchema();
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
 * The fields which edit the material of a core Surface behavior.
 * @type {foundry.data.fields.SchemaField}
 */
let materialSchema;

/**
 * Get the fields which edit the material of a core Surface behavior, localized on first use.
 * @returns {foundry.data.fields.SchemaField}
 */
function getMaterialSchema() {
  if ( materialSchema ) return materialSchema;
  const {BooleanField, SchemaField, StringField} = foundry.data.fields;
  materialSchema = new SchemaField({
    material: new StringField({required: true, blank: true, initial: "",
      choices: () => crucible.CONFIG.footfalls.materials}),
    materialVolume: new BooleanField({initial: false})
  });
  foundry.helpers.Localization.localizeSchema(materialSchema, ["FOOTFALLS"]);
  return materialSchema;
}

/* -------------------------------------------- */

/**
 * Get the material of Ember's legacy footstep data, for Ember scenes which do not yet use Surface behavior materials.
 * TODO: remove once Ember migrates its scenes to Surface behavior materials in V15.
 * @param {Scene} scene
 * @param {ElevatedPoint & {level?: string}} point
 * @returns {string|null}
 */
function getEmberMaterial(scene, point) {
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
 * Get the material of a surface from the Surface behavior of its Region which places it.
 * @param {RegionSurface} surface
 * @returns {string|null}
 */
function getSurfaceMaterial(surface) {
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
function getVolumeMaterial(region, point) {
  const {bottom, top} = region.elevation;
  if ( (point.elevation < bottom) || (point.elevation > top) ) return null;
  const behavior = region.behaviors.find(b => !b.disabled && (b.type === "defineSurface")
    && b.flags.core?.materialVolume && b.flags.core.material);
  if ( !behavior || !region.polygonTree.testPoint(point) ) return null;
  return behavior.flags.core.material;
}

/* -------------------------------------------- */
/*  Playback                                    */
/* -------------------------------------------- */

/**
 * Find the sound a mover makes on a material, falling back to a sound the mover makes on any material.
 * @param {string} material   The material underfoot
 * @param {string} mover      The kind of mover
 * @returns {CrucibleFootfallSound|null}
 */
export function getSound(material, mover) {
  let anyMaterial = null;
  for ( const sound of Object.values(crucible.CONFIG.footfalls.sounds) ) {
    if ( sound.mover !== mover ) continue;
    if ( sound.material === material ) return sound;
    if ( sound.material === null ) anyMaterial ??= sound;
  }
  return anyMaterial;
}

/* -------------------------------------------- */

/**
 * Play the footfalls a token has decided to make, continuing seamlessly through the links of a chained movement.
 */
export class CrucibleFootfallPlayer {
  /**
   * @param {CrucibleTokenObject} token   The token whose footfalls are played
   */
  constructor(token) {
    this.#token = token;
  }

  /**
   * The token whose footfalls are played.
   * @type {CrucibleTokenObject}
   */
  #token;

  /**
   * The footfalls of the movement link currently animating.
   * @type {CrucibleFootfalls|null}
   */
  #footfalls = null;

  /**
   * The time at which the current movement link finishes, in milliseconds.
   * @type {number}
   */
  #until = 0;

  /**
   * Is a sequence of footfalls currently being played?
   * @type {boolean}
   */
  #playing = false;

  /* -------------------------------------------- */

  /**
   * Make footfalls for the duration of a movement animation link.
   * @param {CrucibleFootfalls} footfalls   The footfalls to make
   * @param {number} duration               The duration of the link in milliseconds
   */
  play(footfalls, duration) {
    if ( game.audio.locked ) return;
    this.#footfalls = footfalls;
    this.#until = performance.now() + duration;
    if ( this.#playing ) return;
    this.#playing = true;
    this.#step();
  }

  /* -------------------------------------------- */

  /**
   * Make one footfall and schedule the next, until the current movement link finishes.
   */
  #step() {
    if ( this.#token.destroyed || (performance.now() >= this.#until) ) {
      this.#playing = false;
      return;
    }
    this.#playFootfall();
    new foundry.audio.AudioTimeout(this.#footfalls.interval, {
      callback: () => this.#step(),
      context: game.audio.environment
    });
  }

  /* -------------------------------------------- */

  /**
   * Play a random sound for the current mover and material at the token's position.
   */
  #playFootfall() {
    const document = this.#token.document;
    if ( document.hidden ) return;
    const {material, mover, radius, volume} = this.#footfalls;
    const sound = getSound(material, mover);
    if ( sound?.playback !== "footfalls" ) return;
    const src = sound.src[Math.floor(Math.random() * sound.src.length)];
    // noinspection ES6MissingAwait
    canvas.sounds.playAtPosition(src, document.getCenterPoint(), radius, {
      volume: volume * (0.5 + (Math.random() * 0.5)),
      easing: true,
      walls: true,
      gmAlways: false
    });
  }
}
