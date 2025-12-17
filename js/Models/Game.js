import { cardDb } from "/shared/cardDb.js";


export class Game {
  constructor() {
    this.landsPlayedThisTurn = { Player1: 0, Player2: 0 };
    this.activePlayerOrder = null;

    this.lifeTotals = { Player1: 20, Player2: 20 };

    this.cardDb = cardDb;
  }

  untapPermanentsForOwner({ owner, battlefieldCardsForOwner }) {
    const effects = [];

    for (const cardInstance of battlefieldCardsForOwner) {
      const cardInfo = this.cardDb?.[cardInstance.name];
      if (!cardInfo) continue;

      const isPermanent = cardInfo.type === "land" || cardInfo.type === "creature";
      
      if (!isPermanent) continue;

      if (cardInstance.rotated === true) {
        effects.push({ type: "untap", cards: [cardInstance] });
      }
    }
    return effects;
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

  otherOwner(owner) {
    return owner === "Player1" ? "Player2" : "Player1";
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

  resolvePlayEffects({ owner, cardName }) {
    const cardInfo = this.cardDb[cardName];
    if (!cardInfo) return [];

    if (!Array.isArray(cardInfo.effectsOnResolve)) return [];

    const effects = [];

    for (const effect of cardInfo.effectsOnResolve) {
      if (effect.type === "damagePlayer") {
        const resolvedTarget =
          effect.target === "opponent" ? this.otherOwner(owner): effect.target;

        effects.push({
          type: "damagePlayer",
          target: resolvedTarget,
          amount: effect.amount,
          source: cardName,
          owner
        });
        continue;
    }
    effects.push(effect);
    }
    return effects;
  }

  resolveAttackEffects({ owner, cardName }) {
    const cardInfo = this.cardDb[cardName];
    if (!cardInfo) return { ok: false, reason: "unknown_card", effects: [] };
    if (cardInfo.type !== "creature") return { ok: false, reason: "not_a_creature", effects: [] };

    const damageAmount = Number(cardInfo.power ?? 0);
    if (damageAmount <= 0) return { ok: false, reason: "no_power", effects: [] };

    return {
      ok: true,
      effects: [{
        type: "damagePlayer",
        target: this.otherOwner(owner),
        amount: damageAmount,
        source: cardName,
        owner
      }]
    }
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
        };
        continue;
      }

      if (effect.type === "untap") {
        for (const cardInstance of effect.cards) {
          cardInstance.rotated = false;
        }
        continue;
      }

      if (effect.type === "damagePlayer") {
        const targetOwner = effect.target;
        const amount = Number(effect.amount ?? 0);
        if (!targetOwner || amount <= 0) continue;

        this.lifeTotals[targetOwner] = Math.max(0, (this.lifeTotals[targetOwner] ?? 20) - amount);
        continue;
    }
  }
}
}