import {getRandomSound} from "./sounds.mjs";
import {getRandomSprite} from "./sprites.mjs";

/**
 * Configure the data for a VFXEffect
 * @param {CrucibleAction} action
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const components = {};
  const timeline = [];
  const references = {tokenMesh: "^token.object.mesh"};

  // Prepare each weapon strike
  let j=1; // Target
  for ( const outcome of action.outcomes.values() ) {
    if ( outcome.target === action.actor ) continue;
    const token = outcome.token;
    const targetTokenReference = `outcome_${j}_token`;
    const targetMeshReference = `outcome_${j}_tokenMesh`;
    Object.assign(references, {
      [targetTokenReference]: `@${token.uuid}`,
      [targetMeshReference]: `^${targetTokenReference}.object.mesh`
    });
    let i=1; // Roll
    for ( const roll of outcome.rolls ) {
      const weapon = action.usage.strikes[outcome.rolls[0].data.strike];
      if ( !["projectile1", "projectile2"].includes(weapon?.category) ) continue;

      // Identify impact location
      const impact = configureImpact(outcome, roll, targetMeshReference);

      // Add the arrow projectile
      const projectileName = `arrowProjectile_${j}_${i}`;
      components[projectileName] = {
        type: "singleAttack",
        path: [{reference: "tokenMesh", deltas: {sort: 1}}, impact.position],
        charge: {
          duration: 1000,
          animations: [{function: "drawBack"}],
          sound: {
            src: getRandomSound("bow", "draw"),
            align: 2
          }
        },
        projectile: {
          texture: getRandomSprite("projectiles", "arrow"),
          animations: [{function: "followPath"}],
          size: 3, // Feet
          speed: 150 // Feet-per-second
        },
        impact: {
          texture: impact.texture,
          duration: 2000,
          sound: impact.sound ? {src: impact.sound, align: 1} : null
        }
      };
      timeline.push({component: projectileName, position: 0});
      i++;
    }
    j++;
  }
  if ( !timeline.length ) return null;

  // Validate that the effect data parses correctly
  let vfxConfig;
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({name: action.id, components, timeline});
    vfxConfig = effect.toObject();
    vfxConfig.references = references;
  } catch(cause) {
    console.error(new Error(`Strike VFX configuration failed for Action "${this.id}"`, {cause}));
  }
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Get a referenced impact position for a target Token and a given AttackRoll.
 * @param {CrucibleActionOutcome} outcome
 * @param {AttackRoll} roll
 * @param {string} targetMeshReference
 * @returns {{position: {reference: string, deltas: Record<string, number>}, sound: string|null, texture: string|null}}
 * @internal
 */
function configureImpact(outcome, roll, targetMeshReference) {
  const position = {reference: targetMeshReference, deltas: {sort: 1}};
  let sound = null;
  let texture = null;
  const w = outcome.token.width * canvas.dimensions.size;
  const h = outcome.token.height * canvas.dimensions.size;
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;

  // Customize the impact depending on the roll result
  let hitRange;
  switch ( roll.data.result ) {
    case T.HIT:
      hitRange = [0, 0.1];
      sound = getRandomSound("projectile", "hitCreature");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.ARMOR:
    case T.BLOCK:
      hitRange = [0, 0.25];
      sound = getRandomSound("projectile", "block");
      break;
    case T.GLANCE:
      hitRange = [0.25, 0.5];
      sound = getRandomSound("projectile", "hitObject");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.PARRY:
      hitRange = [0.25, 0.5];
      sound = getRandomSound("projectile", "block");
      break;
    case T.DODGE:
    case T.MISS:
      hitRange = [0.5, 1.0];
      sound = getRandomSound("projectile", "miss");
      break;
  }

  // Determine position based on hit range
  position.deltas.x = Math.mix(w * hitRange[0], w * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  position.deltas.y = Math.mix(h * hitRange[0], h * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  return {position, sound, texture};
}

/* -------------------------------------------- */

