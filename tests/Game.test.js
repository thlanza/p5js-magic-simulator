import { expect, it } from "vitest";
import { Game } from "../js/Models/Game";


function onBattlefield(name, { owner = "Player1", tapped = false } = {}) {
    return { name, owner, enteredBattlefield: true, rotated: tapped };
}

function playArgs(overrides = {}) {
    return {
        order: "1",
        activePlayOrder: "1",
        gameReadyToStart: true,
        owner: "Player1",
        cardName: "mountain",
        battlefieldCardsForOwner: [],
        ...overrides
    }
}

describe("Game.canPlayCard: preconditions", () => {
    it("refuses when the player is not connected yet (no order)", () => {
        const decision = new Game().canPlayCard(playArgs({ order: null }));
        expect(decision).toEqual({ ok: false, reason: "not_connected" });
    });

    it("refuses when the game is not ready (waiting for the opponent)", () => {
        const decision = new Game().canPlayCard(playArgs({ gameReadyToStart: false }));
        expect(decision).toEqual({ ok: false, reason: 'not_ready' });
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

describe("Game.canPlayCard: lands", () => {
    it("allows the first land of the turn, producing an incrementLandPlayed effect", () => {
        const game = new Game();
        game.setActivePlayerOrder("1");

        const decision = game.canPlayCard(playArgs({ cardName: "mountain" }));

        expect(decision)
    })
})














it('constructor() initializes default game state', () => {
    const game = new Game();

    expect(game.landsPlayedThisTurn).toEqual({ Player1: 0, Player2: 0 });
    expect(game.activePlayerOrder).toBe(null);
    expect(game.lifeTotals).toEqual({ Player1: 20, Player2: 20 });
    expect(game.cardDb).toBeDefined();
});

it('ownerFromOrder() maps "1" to Player1', () => {
    const game = new Game();
    expect(game.ownerFromOrder("1")).toBe("Player1");
});

it('ownerFromOrder() maps "2" to Player2', () => {
    const game = new Game();
    expect(game.ownerFromOrder("2")).toBe("Player2");
});

it('ownerFromOrder() returns null for invalid order', () => {
    const game = new Game();
    expect(game.ownerFromOrder("3")).toBe(null);
    expect(game.ownerFromOrder(null)).toBe(null);
});

it('otherOwner() swaps Player1 and Player2', () => {
    const game = new Game();

    expect(game.otherOwner("Player1")).toBe("Player2");
    expect(game.otherOwner("Player2")).toBe("Player1");
});

