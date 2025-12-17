export const cardDb = {
  mountain: { type: "land", produces: { red: 1 } },
  forest: { type: "land", produces: { green: 1 } },

  lightning_bolt: {
    type: "spell",
    cost: { red: 1 },
    effectsOnResolve: [{ type: "damagePlayer", target: "opponent", amount: 3 }],
  },

  grizzly_bear: {
    type: "creature",
    cost: { green: 1, generic: 1 },
    power: 2,
    toughness: 2,
  },
};
