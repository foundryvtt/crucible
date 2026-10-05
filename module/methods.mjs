import {allocatePoints} from "./advancement.mjs";
import CrucibleTalentNode from "./const/talent-node.mjs";

/**
 * Create an Archetype which reproduces the build of an advanced Hero.
 * @param {CrucibleActor} hero                    The Hero whose build is reproduced
 * @param {object} [archetypeData]                Archetype data which overrides derived values, usually a name
 * @param {object} [options]
 * @param {boolean} [options.create=true]         Create the Item, otherwise return its creation data
 * @param {boolean} [options.equipment=false]     Grant the Hero's equipped items as Archetype equipment
 * @param {boolean} [options.spells=false]        Grant the Hero's iconic spells as Archetype spells
 * @returns {Promise<CrucibleItem|object>}
 */
export async function createArchetypeFromHero(hero, archetypeData={}, {create=true, equipment=false, spells=false}={}) {
  if ( hero?.type !== "hero" ) throw new Error("createArchetypeFromHero requires a Hero Actor");
  const {abilities, training, permanentTalentIds} = hero.system;
  const getSource = (item, uuid=item._stats.compendiumSource) => {
    if ( !uuid ) console.warn(`Crucible | ${item.type} "${item.name}" has no compendium source and was omitted`);
    return uuid;
  };

  // Ability weights from player-chosen points, with any remainder past the weight cap shared evenly
  const chosen = {};
  for ( const [id, a] of Object.entries(abilities) ) chosen[id] = a.base + a.increases;
  const order = Object.keys(chosen).toSorted((a, b) => chosen[b] - chosen[a]);
  const caps = Object.fromEntries(order.map(id => [id, 6]));
  const abilityWeights = allocatePoints(12, chosen, {caps, order});
  let surplus = 12;
  for ( const id of order ) {
    surplus -= abilityWeights[id];
    caps[id] -= abilityWeights[id];
  }
  const even = allocatePoints(surplus, Object.fromEntries(order.map(id => [id, 1])), {caps, order});
  for ( const id of order ) abilityWeights[id] += even[id];

  // Proficiency ratios to the strongest preference, keeping those of at least a quarter its strength
  const {ALLOCATION_ORDER, WEIGHT_MAX} = SYSTEM.PROFICIENCY;
  const maxPoints = Math.max(1, ...Object.values(training).map(t => t.points));
  const ratios = Object.entries(training)
    .map(([id, t]) => [id, t.points / maxPoints])
    .filter(([, r]) => r >= 0.25)
    .sort((a, b) => (b[1] - a[1]) || (ALLOCATION_ORDER.indexOf(a[0]) - ALLOCATION_ORDER.indexOf(b[0])))
    .slice(0, 9);

  // Express those ratios on the smallest scale as faithful as rounding at the maximum weight
  const tolerance = 1 / (2 * WEIGHT_MAX);
  const toWeight = (r, scale) => Math.max(Math.round(scale * r), 1);
  const isFaithful = scale => ratios.every(([, r]) => Math.abs((toWeight(r, scale) / scale) - r) <= tolerance);
  let scale = 1;
  while ( (scale < WEIGHT_MAX) && !isFaithful(scale) ) scale++;
  const trainingWeights = Object.fromEntries(ratios.map(([id, r]) => [id, toWeight(r, scale)]));

  // Talents at the level of their lowest tier, or immediately if granted
  const talents = [];
  for ( const t of hero.itemTypes.talent ) {
    const item = getSource(t, t._stats.compendiumSource ?? CrucibleTalentNode.talentIds.get(t.id));
    if ( !item ) continue;
    let level = 0;
    if ( !permanentTalentIds.has(t.id) ) {
      level = Math.min(...Array.from(t.system.nodes, n => (Number.isInteger(n.tier) ? n.tier : 0)));
    }
    talents.push({item, level, name: t.name});
  }
  talents.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  // Equipment and iconic spells
  const equipmentGrants = [];
  if ( equipment ) {
    for ( const i of hero.items ) {
      if ( !i.system.equipped ) continue;
      const item = getSource(i);
      if ( item ) equipmentGrants.push({item, quantity: i.system.quantity, equipped: true, autoScale: true});
    }
  }
  const spellGrants = [];
  if ( spells ) {
    for ( const s of hero.itemTypes.spell ) {
      const item = getSource(s);
      if ( item ) spellGrants.push({item, level: 0});
    }
  }

  // Create the Archetype
  const name = archetypeData.name ?? hero.name;
  const data = foundry.utils.mergeObject({
    name,
    type: "archetype",
    system: {
      identifier: generateId(name),
      abilities: abilityWeights,
      training: trainingWeights,
      talents: talents.map(({item, level}) => ({item, level})),
      spells: spellGrants,
      equipment: equipmentGrants
    }
  }, archetypeData);
  if ( !create ) return data;
  return Item.implementation.create(data);
}

/* -------------------------------------------- */

/**
 * Generate a Crucible-standardized document ID given a provided string title.
 * @param {string} title      An input string title
 * @param {number} [length]   A maximum ID length
 * @returns {string}          A standardized camel-case ID
 */
export function generateId(title, length) {
  const id = title.split(" ").map((w, i) => {
    const p = w.slugify({replacement: "", lowercase: false, strict: true});
    return i ? p.titleCase() : (p.charAt(0).toLowerCase() + p.slice(1));
  }).join("");
  return Number.isNumeric(length) ? id.slice(0, length).padEnd(length, "0") : id;
}

/* -------------------------------------------- */

/**
 * Package all documents of a certain type into their appropriate Compendium pack
 * @param {string} documentName
 * @param {string} packName
 * @param {Folder|string} folder
 * @returns {Promise<void>}
 */
export async function packageCompendium(documentName, packName, folder) {
  const pack = game.packs.get(`crucible.${packName}`);
  if ( typeof folder === "string" ) {
    folder = game.folders.find(f => (f.type === documentName) && (f.name === folder));
  }
  if ( !(folder instanceof Folder) || (folder.type !== documentName) ) {
    throw new Error("Invalid folder provided to the packageCompendium method");
  }

  // Unlock the pack for editing
  await pack.configure({locked: false});

  // Delete all existing documents in the pack
  const cls = getDocumentClass(documentName);
  await pack.getDocuments();
  await cls.deleteDocuments([], {pack: pack.collection, deleteAll: true});
  await Folder.deleteDocuments(Array.from(pack.folders.keys()), {pack: pack.collection});

  // Export all children of the target folder
  await folder.exportToCompendium(pack, {keepId: true, keepFolders: true});

  // Re-lock the pack
  await pack.configure({locked: true});
}

/* -------------------------------------------- */

/**
 * Standardize all World item IDs
 * @returns {Promise<void>}
 */
export async function standardizeItemIds() {
  const creations = [];
  const deletions = [];
  for ( const item of game.items ) {
    const standardId = generateId(item.name, 16);
    if ( item.id === standardId ) continue;
    if ( game.items.has(standardId) ) throw new Error(`Standardized system ID ${standardId} is already in use`);
    deletions.push(item.id);
    creations.push(Object.assign(item.toObject(), {_id: standardId}));
  }
  await Item.deleteDocuments(deletions);
  await Item.createDocuments(creations, {keepId: true});
}
