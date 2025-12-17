export class Game {
  constructor() {
    this.landsPlayedThisTurn = { Player1: 0, Player2: 0 };
    this.activePlayerOrder = null;

    this.cardDb = {
      mountain: { type: "land", produces: { red: 1 } },
      forest: { type: "land", produces: { green: 1 } },

      lightning_bolt: { type: "spell", cost: { red: 1 } },

      grizzly_bear: { type: "creature", cost: { green: 1, generic: 1 } },
    };
  }

  setActivePlayerOrder(activePlayerOrder) {
    const previousOrder = this.activePlayerOrder;
    this.activePlayerOrder = activePlayerOrder;

    if (previousOrder !== activePlayerOrder) {
      const owner = this.ownerFromOrder(activePlayerOrder);
      if (owner) this.landsPlayedThisTurn[owner] = 0;
    }
  }

  ownerFromOrder(order) {
    if (order === "1") return "Player1";
    if (order === "2") return "Player2";
    return null;
  }

  canPlayCard({
    order,
    activePlayerOrder,
    gameReadyToStart,
    owner,
    cardName,
    battlefieldCardsForOwner,
  }) {
    if (!order) return { ok: false, reason: "not_connected" };
    if (!gameReadyToStart) return { ok: false, reason: "not_ready" };
    if (activePlayerOrder !== order) return { ok: false, reason: "not_your_turn" };

    const cardInfo = this.cardDb[cardName];
    if (!cardInfo) return { ok: false, reason: "unknown_card" };

    if (cardInfo.type === "land") {
      if (this.landsPlayedThisTurn[owner] >= 1) {
        return { ok: false, reason: "land_limit" };
      }

      return {
        ok: true,
        effects: [{ type: "incrementLandPlayed", owner, amount: 1 }],
      };
    }

    const payment = this.computeManaPayment({
      owner,
      cardName,
      battlefieldCardsForOwner,
    });

    if (!payment.ok) return payment;

    return {
      ok: true,
      effects: [...payment.effects],
    };
  }

  computeManaPayment({ owner, cardName, battlefieldCardsForOwner }) {
    const cardInfo = this.cardDb[cardName];
    const cost = cardInfo?.cost;

    if (!cost) return { ok: true, effects: [] };

    const landCards = battlefieldCardsForOwner.filter((cardInstance) => {
      const isOnBattlefield = cardInstance.enteredBattlefield === true;
      const isLand = this.cardDb[cardInstance.name]?.type === "land";
      const isOwner = cardInstance.owner === owner;
      return isOnBattlefield && isOwner && isLand;
    });

    const untappedLands = landCards.filter((cardInstance) => cardInstance.rotated !== true);

    if (cost.red === 1) {
      const untappedMountain = untappedLands.find((cardInstance) => cardInstance.name === "mountain");
      if (!untappedMountain) return { ok: false, reason: "no_red_mana" };

      return { ok: true, effects: [{ type: "tap", cards: [untappedMountain] }] };
    }

    if (cost.green === 1 && cost.generic === 1) {
      const untappedForest = untappedLands.find((cardInstance) => cardInstance.name === "forest");
      if (!untappedForest) return { ok: false, reason: "no_green_mana" };

      const otherUntappedLand = untappedLands.find((cardInstance) => cardInstance !== untappedForest);
      if (!otherUntappedLand) return { ok: false, reason: "no_generic_mana" };

      return { ok: true, effects: [{ type: "tap", cards: [untappedForest, otherUntappedLand] }] };
    }

    return { ok: false, reason: "unsupported_cost" };
  }

  applyEffects(effects) {
    if (!effects) return;

    for (const effect of effects) {
      if (effect.type === "incrementLandPlayed") {
        this.landsPlayedThisTurn[effect.owner] += effect.amount;
        continue;
      }

      if (effect.type === "tap") {
        for (const cardInstance of effect.cards) {
          cardInstance.rotated = true;
        }
      }
    }
  }
}
