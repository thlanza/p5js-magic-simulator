import { expect, it } from "vitest";
import { Game } from "../js/Models/Game";

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

