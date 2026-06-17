import {getRandomSound} from "./sounds.mjs";
import {getRandomSprite} from "./sprites.mjs";
import {computeAttackOffset, pushActorScrollingText, pushTargetScrollingText, tokenCenter} from "./helpers.mjs";

/**
 * Configure the data for a VFXEffect
 * @param {CrucibleAction} action
 * @param {object|null} vfxConfig       The current VFX configuration from prior hooks, if any.
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action, vfxConfig) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const components = {};
  const timeline = [];
  const references = {tokenMesh: "^token.object.mesh"};
  const casterCenter = action.token ? tokenCenter(action.token) : null;
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const PROJECTILE_SPEED = 150; // Feet-per-second
  const CHARGE_DURATION = 1000;
  const STICK_DURATION = 2000; // Milliseconds a landed projectile lingers in the target before fading

  let j = 1; // Target
  for ( const [actor, group] of action.eventsByTarget ) {
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const targetTokenReference = `target_${j}_token`;
    const targetMeshReference = `target_${j}_tokenMesh`;
    Object.assign(references, {
      [targetTokenReference]: `@${token.uuid}`,
      [targetMeshReference]: `^${targetTokenReference}.object.mesh`
    });

    // Schedule impact for when the projectile lands
    const targetCenter = tokenCenter(token);
    const distPx = casterCenter ? Math.hypot(targetCenter.x - casterCenter.x, targetCenter.y - casterCenter.y) : 0;
    const flightMS = (distPx * 1000) / (PROJECTILE_SPEED * canvas.dimensions.distancePixels);
    const impactStart = CHARGE_DURATION + flightMS;

    let i = 1; // Roll
    let textComponent = null;
    for ( const event of group.roll ) {
      const roll = event.roll;
      const weapon = action.usage.strikes[roll.data.strike];
      if ( !["projectile1", "projectile2"].includes(weapon?.category) ) continue;

      // Configure impact
      const impact = configureImpact(token, roll, targetMeshReference);
      const projectileName = `arrowProjectile_${j}_${i}`;
      const isHit = (roll.data.result === T.HIT) || (roll.data.result === T.GLANCE);
      const stick = isHit ? STICK_DURATION : 0;
      const impactAnimations = [];
      if ( impact.texture ) {
        impactAnimations.push({function: "impactSpriteBurst",
          params: {texture: impact.texture, size: 3, duration: stick || 1000}});
      }
      if ( isHit ) impactAnimations.push({function: roll.isCriticalSuccess ? "impactSpriteShake" : "impactSpriteRecoil"});

      // Register the component
      components[projectileName] = {
        type: "crucibleProjectile",
        originMesh: {reference: "tokenMesh"},
        targetMeshes: [{reference: targetMeshReference}],
        path: [{reference: "tokenMesh", deltas: {sort: 1}}, impact.position],
        pathType: {type: "linear", params: {}},
        charge: {
          duration: CHARGE_DURATION,
          animations: [{function: "chargeDrawBack"}],
          sound: {src: getRandomSound("bow", "draw"), align: 2}
        },
        delivery: {
          texture: getRandomSprite("projectiles", "arrow"),
          size: 3,
          speed: PROJECTILE_SPEED,
          animations: [{function: "deliveryProjectileFlight", params: {returnAnchor: true}}]
        },
        impacts: [{
          result: roll.data.result,
          id: token.id,
          stick,
          sound: impact.sound ? {src: impact.sound, align: 1} : null,
          animations: impactAnimations
        }],
        scrollingText: []
      };
      timeline.push({component: projectileName, position: 0});
      textComponent ??= components[projectileName];
      i++;
    }

    // Schedule scrolling text for the impact timing
    if ( textComponent ) {
      pushTargetScrollingText(textComponent.scrollingText, action, actor, group.all, targetMeshReference, impactStart);
    }
    j++;
  }
  if ( !timeline.length ) return null;

  // Caster activation-cost text rides the first projectile at the start of the sequence
  const firstComponent = components[timeline[0].component];
  if ( firstComponent ) pushActorScrollingText(firstComponent.scrollingText, action, "tokenMesh");

  // Validate the constructed effect and return its configuration
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({name: action.id, components, timeline});
    vfxConfig = effect.toObject();
    vfxConfig.references = references;
  } catch(cause) {
    console.error(new Error(`Strike VFX configuration failed for Action "${action.id}"`, {cause}));
  }
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Get a referenced impact position for a target Token and a given AttackRoll.
 * @param {CrucibleToken} token
 * @param {AttackRoll} roll
 * @param {string} targetMeshReference
 * @returns {{position: {reference: string, deltas: Record<string, number>}, sound: string|null, texture: string|null}}
 * @internal
 */
function configureImpact(token, roll, targetMeshReference) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let sound = null;
  let texture = null;

  // Result-specific sound and impact texture; positional offset is shared via computeAttackOffset
  switch ( roll.data.result ) {
    case T.HIT:
      sound = getRandomSound("projectile", "hitCreature");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.ARMOR:
    case T.BLOCK:
      sound = getRandomSound("projectile", "block");
      break;
    case T.GLANCE:
      sound = getRandomSound("projectile", "hitObject");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.PARRY:
      sound = getRandomSound("projectile", "block");
      break;
    case T.DODGE:
    case T.MISS:
      sound = getRandomSound("projectile", "miss");
      break;
  }

  const offset = computeAttackOffset(token, roll.data.result);
  const position = {reference: targetMeshReference, deltas: {sort: 1, x: offset.x, y: offset.y}};
  return {position, sound, texture};
}

/* -------------------------------------------- */

