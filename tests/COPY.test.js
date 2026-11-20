import { describe } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A card on the battlefield, as a plain object (all the Game needs).
function onBattlefield(name, { owner = "Player1", tapped = false } = {}) {
  return { name, owner, enteredBattlefield: true, rotated: tapped };
}

// Arguments for canPlayCard: by default, Player1 trying to play on their own
// turn, with the game ready and an empty battlefield. Each test overrides
// only what matters to it.
function playArgs(overrides = {}) {
  return {
    order: "1",
    activePlayerOrder: "1",
    gameReadyToStart: true,
    owner: "Player1",
    cardName: "mountain",
    battlefieldCardsForOwner: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// canPlayCard: preconditions
// ---------------------------------------------------------------------------

describe("Game.canPlayCard: preconditions", () => {
  it("refuses when the player is not connected yet (no order)", () => {
    const decision = new Game().canPlayCard(playArgs({ order: null }));
    expect(decision).toEqual({ ok: false, reason: "not_connected" });
  });

  it("refuses when the game is not ready (waiting for the opponent)", () => {
    const decision = new Game().canPlayCard(playArgs({ gameReadyToStart: false }));
    expect(decision).toEqual({ ok: false, reason: "not_ready" });
  });

  it("refuses when it is not the player's turn", () => {
    const decision = new Game().canPlayCard(playArgs({ activePlayerOrder: "2" }));
    expect(decision).toEqual({ ok: false, reason: "not_your_turn" });
  });

  it("refuses a card that does not exist in the card database", () => {
    const decision = new Game().canPlayCard(playArgs({ cardName: "black_lotus" }));
    expect(decision).toEqual({ ok: false, reason: "unknown_card" });
  });
});

// ---------------------------------------------------------------------------
// canPlayCard: lands (one per turn)
// ---------------------------------------------------------------------------

describe("Game.canPlayCard: lands", () => {
  it("allows the first land of the turn, producing an incrementLandPlayed effect", () => {
    const game = new Game();
    game.setActivePlayerOrder("1");

    const decision = game.canPlayCard(playArgs({ cardName: "mountain" }));

    expect(decision).toEqual({
      ok: true,
      effects: [{ type: "incrementLandPlayed", owner: "Player1", amount: 1 }],
    });
  });

  it("refuses a second land in the same turn", () => {
    const game = new Game();
    game.setActivePlayerOrder("1");

    game.applyEffects(game.canPlayCard(playArgs({ cardName: "mountain" })).effects);
    const decision = game.canPlayCard(playArgs({ cardName: "mountain" }));

    expect(decision).toEqual({ ok: false, reason: "land_limit" });
  });

  it("allows a land again when the player's next turn starts", () => {
    const game = new Game();
    game.setActivePlayerOrder("1");
    game.applyEffects(game.canPlayCard(playArgs({ cardName: "mountain" })).effects);

    game.setActivePlayerOrder("2"); // opponent's turn
    game.setActivePlayerOrder("1"); // my turn again

    expect(game.canPlayCard(playArgs({ cardName: "mountain" })).ok).toBe(true);
  });

  it("does not reset the land counter when the same turn is announced again", () => {
    const game = new Game();
    game.setActivePlayerOrder("1");
    game.applyEffects(game.canPlayCard(playArgs({ cardName: "mountain" })).effects);

    // The server re-broadcasts 'turn' (e.g. when someone connects): still the same turn
    game.setActivePlayerOrder("1");

    expect(game.canPlayCard(playArgs({ cardName: "mountain" }))).toEqual({ ok: false, reason: "land_limit" });
  });
});

// ---------------------------------------------------------------------------
// canPlayCard: mana payment
// ---------------------------------------------------------------------------

describe("Game.canPlayCard: mana payment", () => {
  it("pays Lightning Bolt (red 1) by tapping an untapped Mountain", () => {
    const mountain = onBattlefield("mountain");

    const decision = new Game().canPlayCard(
      playArgs({ cardName: "lightning_bolt", battlefieldCardsForOwner: [mountain] })
    );

    expect(decision).toEqual({ ok: true, effects: [{ type: "tap", cards: [mountain] }] });
  });

  it("refuses Lightning Bolt without a Mountain", () => {
    const decision = new Game().canPlayCard(
      playArgs({ cardName: "lightning_bolt", battlefieldCardsForOwner: [onBattlefield("forest")] })
    );

    expect(decision).toEqual({ ok: false, reason: "no_red_mana" });
  });

  it("refuses Lightning Bolt when the only Mountain is already tapped", () => {
    const decision = new Game().canPlayCard(
      playArgs({
        cardName: "lightning_bolt",
        battlefieldCardsForOwner: [onBattlefield("mountain", { tapped: true })],
      })
    );

    expect(decision).toEqual({ ok: false, reason: "no_red_mana" });
  });

  it("pays Grizzly Bear (green 1 + generic 1) by tapping a Forest and another land", () => {
    const forest = onBattlefield("forest", { owner: "Player2" });
    const mountain = onBattlefield("mountain", { owner: "Player2" });

    const decision = new Game().canPlayCard(
      playArgs({
        order: "2",
        activePlayerOrder: "2",
        owner: "Player2",
        cardName: "grizzly_bear",
        battlefieldCardsForOwner: [forest, mountain],
      })
    );

    expect(decision).toEqual({ ok: true, effects: [{ type: "tap", cards: [forest, mountain] }] });
  });

  it("refuses Grizzly Bear with only one land (the Forest pays green, nothing pays generic)", () => {
    const decision = new Game().canPlayCard(
      playArgs({
        order: "2",
        activePlayerOrder: "2",
        owner: "Player2",
        cardName: "grizzly_bear",
        battlefieldCardsForOwner: [onBattlefield("forest", { owner: "Player2" })],
      })
    );

    expect(decision).toEqual({ ok: false, reason: "no_generic_mana" });
  });

  it("refuses Grizzly Bear without a Forest, even with other lands", () => {
    const decision = new Game().canPlayCard(
      playArgs({
        order: "2",
        activePlayerOrder: "2",
        owner: "Player2",
        cardName: "grizzly_bear",
        battlefieldCardsForOwner: [
          onBattlefield("mountain", { owner: "Player2" }),
          onBattlefield("mountain", { owner: "Player2" }),
        ],
      })
    );

    expect(decision).toEqual({ ok: false, reason: "no_green_mana" });
  });
});

// ---------------------------------------------------------------------------
// applyEffects and untapPermanentsForOwner
// ---------------------------------------------------------------------------

describe("Game.applyEffects", () => {
  it("'tap' marks the cards as rotated", () => {
    const mountain = onBattlefield("mountain");
    new Game().applyEffects([{ type: "tap", cards: [mountain] }]);
    expect(mountain.rotated).toBe(true);
  });

  it("'untap' marks the cards as not rotated", () => {
    const mountain = onBattlefield("mountain", { tapped: true });
    new Game().applyEffects([{ type: "untap", cards: [mountain] }]);
    expect(mountain.rotated).toBe(false);
  });

  it("'incrementLandPlayed' adds to the owner's land counter", () => {
    const game = new Game();
    game.applyEffects([{ type: "incrementLandPlayed", owner: "Player2", amount: 1 }]);
    expect(game.landsPlayedThisTurn).toEqual({ Player1: 0, Player2: 1 });
  });
});

describe("Game.untapPermanentsForOwner", () => {
  it("untaps tapped lands and creatures; ignores spells and cards already untapped", () => {
    const tappedMountain = onBattlefield("mountain", { tapped: true });
    const tappedBear = onBattlefield("grizzly_bear", { tapped: true });
    const untappedForest = onBattlefield("forest");
    const tappedBolt = onBattlefield("lightning_bolt", { tapped: true });

    const effects = new Game().untapPermanentsForOwner({
      owner: "Player1",
      battlefieldCardsForOwner: [tappedMountain, tappedBear, untappedForest, tappedBolt],
    });

    expect(effects).toEqual([
      { type: "untap", cards: [tappedMountain] },
      { type: "untap", cards: [tappedBear] },
    ]);
  });
});