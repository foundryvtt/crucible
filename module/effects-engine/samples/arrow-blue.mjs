/** @import {RawAnimationConfig} from '../animation-system.mjs'  */

/**
 *
 * @type {RawAnimationConfig}
 */
export const arrowBlueConfig = {
  name: "ArrowBlue",
  paths: {
    arrowPath: {
      type: "cubic",
      controlA: { shift: 0.33, offset: 300 },
      controlB: { shift: 0.5, offset: -150 },
    },
  },
  components: [
    {
      name: "arrowContainer",
      type: "container",
      scale: 0.15,
      pivot: { x: -100 },
      children: [
        {
          type: "container",
          name: "arrowOffsetContainer",
          children: [
            {
              type: "sprite",
              name: "glow",
              tint: [0.5, 1.5, 1.5],
              texture: "systems/crucible/assets/vfx/arrow/arrow-glow.png",
              mode: PIXI.BLEND_MODES.ADD,
              anchor: { x: 1, y: 0.5 },
              position: { x: 78 },
              behaviors: [
                {
                  type: "animate",
                  key: "alpha",
                  values: [
                    { value: 0, time: 0 },
                    { value: 1, time: 750 },
                  ],
                  handlers: [{ event: "afterHit", action: "reset" }],
                },
                {
                  type: "set",
                  key: "alpha",
                  value: 0,
                  startTime: { event: "hit" },
                },
              ],
            },
            {
              type: "sprite",
              name: "arrow",
              texture: "systems/crucible/assets/vfx/arrow/arrow-wood.png",
              anchor: { x: 1, y: 0.5 },
              behaviors: [
                {
                  type: "animate",
                  key: "alpha",
                  values: [
                    { value: 1, time: 1000 },
                    { value: 0, time: 1800 },
                  ],
                  startTime: { event: "hit" },
                },
                {
                  type: "set",
                  key: "alpha",
                  value: 1,
                  startTime: { event: "afterHit" },
                },
              ],
            },
          ],
        },
      ],
      behaviors: [
        {
          type: "animate",
          key: "pivot",
          values: [
            { value: { x: -160 }, time: 0 },
            { value: { x: -100 }, time: 800 },
          ],
          easing: "easeOutCirc",
          handlers: [{ event: "afterHit", action: "reset" }],
        },
        {
          type: "followPath",
          path: "arrowPath",
          // speed: { type: "constant", value: 3000 },
          // speed: {
          //   type: "linear",
          //   initial: 200,
          //   acceleration: 15000,
          //   max: 15000,
          // },
          speed: {
            type: "custom",
            values: [
              { time: 0, value: 50 },
              { time: 600, value: 1000 },
              { time: 800, value: 200 },
              { time: 1200, value: 200 },
              { time: 2000, value: 20000 },
            ],
          },
          startTime: 1500,
          offsetStart: 0,
          offsetEnd: 20,
          triggers: [
            {
              name: "triggerExplosion",
              key: "distanceToEnd",
              cmp: "lte",
              value: 100,
              limit: 1,
            },
            {
              name: "hit",
              key: "state",
              value: "stopped",
            },
            {
              name: "afterHit",
              key: "state",
              value: "stopped",
              delay: 2000,
            },
          ],
          handlers: [{ event: "afterHit", action: "reset" }],
        },
      ],
    },
    {
      type: "sprite",
      texture: "systems/crucible/assets/vfx/arrow/explosion.json",
      position: { type: "variable", key: "target" },
      alpha: 0,
      mode: PIXI.BLEND_MODES.ADD,
      tint: [2, 2, 2],
      anchor: { x: 0.5, y: 0.5 },
      behaviors: [
        {
          type: "spritesheetAnimation",
          animation: "explosion",
          startTime: { event: "triggerExplosion" },
          triggers: [{ name: "completed", key: "event", value: "completed" }],
        },
        {
          type: "set",
          key: "alpha",
          value: 1,
          startTime: { event: "triggerExplosion" },
        },
        {
          type: "set",
          key: "alpha",
          value: 0,
          startTime: { event: "completed" },
        },
      ],
    },
  ],
}
