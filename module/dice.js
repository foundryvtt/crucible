
const DIE_STEP = 2;
const MIN_DIE = 4;
const MAX_DIE = 12;

/**
 * The standard 3d8 dice pool check used by the system.
 * The rolled formula is determined by:
 *
 * @param {number} boons        A number of advantageous boons, up to a maximum of 6
 * @param {number} banes        A number of disadvantageous banes, up to a maximum of 6
 * @param {number} ability      The ability score which modifies the roll, up to a maximum of 12
 * @param {number} skill        The skill bonus which modifies the roll, up to a maximum of 12
 * @param {number} enchantment  An enchantment bonus which modifies the roll, up to a maximum of 6
 *
 * @return {Roll}               A Roll instance for this pool, based on the number of boons and banes
 */
export function standardCheck({boons=0, banes=0, ability=0, skill=0, enchantment=0}={}) {

  // Construct the dice pool
  const pool = [8, 8, 8];
  boons = Math.clamped(boons, 0, 6);
  banes = Math.clamped(banes, 0, 6);
  ability = Math.clamped(ability, 0, 12);
  skill = Math.clamped(skill, 0, 12);
  enchantment = Math.clamped(enchantment, 0, 6);

  // Apply boons from the left
  let d = 0;
  for ( let i=0; i<boons; i++ ) {
    pool[d] = pool[d] + DIE_STEP;
    if ( pool[d] === MAX_DIE ) d++;
  }

  // Apply banes from the right
  d = 2;
  for ( let i=0; i<banes; i++ ) {
    pool[d] = pool[d] - DIE_STEP;
    if ( pool[d] === MIN_DIE ) d--;
  }

  // Construct the Roll object
  let parts = pool.map(p => `1d${p}`).concat(["@ability", "@skill"]);
  if ( enchantment > 0 ) parts.push("@enchantment");
  const formula = parts.join(" + ");
  return new Roll(formula, { boons, banes, ability, skill, enchantment });
}
