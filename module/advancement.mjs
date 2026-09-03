/**
 * Shared advancement mathematics used to award automatic progression to Actors which do not allocate their own points.
 */

/**
 * @typedef CrucibleAllocationOptions
 * @property {Record<string, number>} [caps]   The greatest number of points any one key may receive
 * @property {string[]} [order]                Keys in descending priority, consulted only to break an exact tie
 */

/**
 * Distribute whole points across weighted keys using the highest-averages method, awarding each point in turn to
 * whichever key has the lowest allocation relative to its weight.
 *
 * This is the D'Hondt method, also known as Jefferson's method, long used to apportion legislative seats among
 * parties in proportion to their votes. Adopting it wholesale buys the property that the equivalent hand-rolled
 * approach kept getting wrong, since freedom from the Alabama paradox is precisely the monotonicity wanted here.
 *
 * The result is therefore monotonic in `budget` by construction rather than by tuning: each award depends only on
 * the allocation so far, never on the budget, so the awards made for any budget are a prefix of those made for a
 * larger one and no key can ever lose ground as an Actor advances. Quotients are compared by cross-multiplication
 * rather than division, which is exact for integer weights and keeps ties genuinely tied instead of subject to
 * floating point drift.
 *
 * @see {@link https://en.wikipedia.org/wiki/D%27Hondt_method}
 * @see {@link https://en.wikipedia.org/wiki/Apportionment_paradox#Alabama_paradox}
 * @param {number} budget                    How many points to distribute
 * @param {Record<string, number>} weights   Relative preference per key; keys weighted zero or less are never awarded
 * @param {CrucibleAllocationOptions} [options]
 * @returns {Record<string, number>}         Points awarded per key, with an entry for every key in `weights`
 *
 * @example Award eleven points to a creature which strongly prefers Toughness
 * ```js
 * allocatePoints(11, {toughness: 3, strength: 2, dexterity: 1}, {caps: {dexterity: 1}});
 * // {toughness: 6, strength: 4, dexterity: 1}
 * ```
 */
export function allocatePoints(budget, weights, {caps={}, order}={}) {
  const allocation = {};
  const pool = [];
  for ( const [key, weight] of Object.entries(weights) ) {
    allocation[key] = 0;
    if ( weight > 0 ) pool.push(key);
  }
  if ( !(budget > 0) || !pool.length ) return allocation;

  // An earlier key wins an exact tie, so an unordered record still yields a stable, locale-independent result
  const rank = {};
  (order ?? Object.keys(weights)).forEach((key, i) => rank[key] = i);

  for ( let spent = 0; spent < budget; spent++ ) {
    let best = null;
    for ( const key of pool ) {
      if ( allocation[key] >= (caps[key] ?? Infinity) ) continue; // Saturated keys yield their share to the rest
      if ( best === null ) {
        best = key;
        continue;
      }
      const lhs = weights[key] * (allocation[best] + 1);
      const rhs = weights[best] * (allocation[key] + 1);
      if ( (lhs > rhs) || ((lhs === rhs) && ((rank[key] ?? Infinity) < (rank[best] ?? Infinity))) ) best = key;
    }
    if ( best === null ) break; // Every weighted key has reached its cap
    allocation[best] += 1;
  }
  return allocation;
}
