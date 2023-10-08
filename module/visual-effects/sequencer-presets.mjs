
export default {

  /* -------------------------------------------- */
  /*  Gesture: Arrow                              */
  /* -------------------------------------------- */

  "crucible.spell.arrow": (effect, {rune, source, target, missed=false}={}) => {
    const spellPath = `crucible.spell.arrow.${rune}`;
    const dbEntry = Sequencer.Database.getEntry(spellPath);
    if ( !dbEntry ) {
      console.warn(`Expected Sequencer database entry for "${spellPath}" was not found.`);
      return effect;
    }

    // Standard Arrow effect
    effect.file(spellPath)
      .atLocation(source)
      .stretchTo(target)
      .missed(missed)

    // Custom delay
    if ( dbEntry.metadata.hitTiming ) effect.wait(dbEntry.metadata.hitTiming);

    // Rune-specific overrides
    if ( rune === "death" ) effect.filter("ColorMatrix", {brightness: 0.1});
    else if ( rune === "earth" ) effect.filter("ColorMatrix", {saturate: -0.9});
    return effect;
  },

  /* -------------------------------------------- */
  /*  Gesture: Fan                              */
  /* -------------------------------------------- */

  "crucible.spell.fan": (effect, {rune, template}={}) => {
    const spellPath = `crucible.spell.fan.${rune}`;
    const dbEntry = Sequencer.Database.getEntry(spellPath);
    if ( !dbEntry ) {
      console.warn(`Expected Sequencer database entry for "${spellPath}" was not found.`);
      return effect;
    }

    // Standard Fan effect
    effect.file(spellPath)
      .atLocation({x: template.x, y: template.y}, {cacheLocation: true})
      .rotate(template.direction - 90)
      .size({ width: canvas.grid.size*2, height: canvas.grid.size*3 })
      .playbackRate(2);

    // Custom delay
    if ( dbEntry.metadata.hitTiming ) effect.wait(dbEntry.metadata.hitTiming);
    return effect;
  },
}
