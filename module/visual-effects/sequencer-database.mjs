/**
 * A customized Sequencer database mapping designed specifically for the Crucible game system.
 * Lines which are commented out still need to be implemented.
 */
export default {
  spell: {
    arrow: {
      _hitTiming: 500,
      // control: "",
      death: "jb2a.fire_bolt.purple",
      earth: "jb2a.fire_bolt.blue",
      flame: "jb2a.fire_bolt.orange",
      frost: "jb2a.fire_bolt.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    aspect: {
      // control: "",
      death: "jb2a.divine_smite.caster.dark_purple",
      earth: "jb2a.divine_smite.caster.yellowwhite",
      flame: "jb2a.divine_smite.caster.reversed.orange",
      frost: "jb2a.divine_smite.caster.blueyellow",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    create: {
      // control: "",
      death: {
        portal: "jb2a.portals.horizontal.vortex_masked.purple",
        background: "jb2a.arms_of_hadar.dark_purple",
      },
      earth: {
        portal: "jb2a.portals.horizontal.vortex_masked.green",
        background: "jb2a.scorched_earth.green",
      },
      flame: {
        portal: "jb2a.portals.horizontal.vortex_masked.orange",
        background: "jb2a.braziers.orange.hard_edge.02",
      },
      frost: {
        portal: "jb2a.portals.horizontal.vortex_masked.blue",
        background: "jb2a.impact.frost.blue.01",
      },
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    fan: {
      // control: "",
      death: "jb2a.breath_weapons02.burst.cone.fire.orange.01",
      earth: "jb2a.ice_spikes.wall.burst.red",
      flame: "jb2a.breath_weapons02.burst.cone.fire.orange.01",
      frost: "jb2a.cone_of_cold.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    influence: {
      // control: "",
      death: {
        cast: "jb2a.eldritch_blast.dark_purple",
        target: "jb2a.toll_the_dead.purple.skull_smoke"
      },
      earth: {
        cast: "jb2a.melee_generic.bludgeoning.one_handed",
        target: "jb2a.impact.white.0"
      },
      flame: {
        cast: "jb2a.disintegrate.orangepink.05ft",
        target: "jb2a.flames.orange.03.1x1.0"
      },
      frost: {
        cast: "jb2a.ray_of_frost.blue",
        target: "jb2a.impact.frost.blue.01"
      },
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    pulse: {
      // control: "",
      death: {
        primary: "jb2a.toll_the_dead.grey.shockwave",
        secondary: "jb2a.toll_the_dead.grey.skull_smoke"
      },
      earth: {
        primary: "jb2a.impact.boulder.02",
        secondary: "jb2a.impact.ground_crack.still_frame.01"
      },
      flame: "jb2a.fireball.explosion.orange",
      frost: "jb2a.impact.ground_crack.frost.01.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    ray: {
      // control: "",
      death: "jb2a.energy_strands.range.multiple.dark_purplered.02",
      earth: {
        primary: "jb2a.impact.boulder.02",
        secondary: "jb2a.impact.ground_crack.still_frame.01"
      },
      flame: "jb2a.breath_weapons.fire.line.orange",
      frost: "jb2a.breath_weapons.fire.line.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    step: {
      // control: "",
      death: {
        origin: "jb2a.misty_step.01.dark_black",
        line: "jb2a.gust_of_wind.veryfast"
      },
      earth: {
        origin: "jb2a.impact.ground_crack.white.01",
        line: "jb2a.gust_of_wind.veryfast"
      },
      flame: {
        origin: "jb2a.misty_step.01.orange",
        line: "jb2a.gust_of_wind.veryfast"
      },
      frost: {
        origin: "jb2a.misty_step.01.blue",
        line: "jb2a.gust_of_wind.veryfast"
      },
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    strike: {
      // control: "",
      death: "jb2a.melee_generic.slash.01.bluepurple.0",
      earth: "jb2a.melee_generic.bludgeoning.one_handed",
      flame: "jb2a.melee_generic.slash.01.orange.0",
      frost: "jb2a.melee_generic.slash.01.bluepurple.0",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    touch: {
      // control: "",
      death: "jb2a.toll_the_dead.grey.skull_smoke",
      earth: "jb2a.impact.ground_crack.white.01",
      flame: "jb2a.impact.003.orange",
      frost: "jb2a.impact.004.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    },
    ward: {
      // control: "",
      death: "jb2a.ward.skull.dark_purple.02",
      earth: "jb2a.shield_themed.above.molten_earth.03.orange",
      flame: "jb2a.shield_themed.above.fire.03.orange",
      frost: "jb2a.shield_themed.above.ice.03.blue",
      // illumination: "",
      // kinesis: "",
      // life: "",
      // lightning: "",
      // shadow: "",
      // spirit: "",
      // stasis: "",
    }
  }
};
