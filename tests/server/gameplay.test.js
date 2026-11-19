import { describe, it, expect, vi, afterEach } from "vitest";
import {
  importFreshServerModule,
  connectPlayer,
  connectTwoPlayers,
  parseSentJsonMessages,
  lastMessageOf,
} from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("turns", () => {
  it("endTurn only works for the active player, and toggles activePlayer", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    // Player2 tries to end turn while activePlayer is '1' -> ignored
    connectionPlayer2.__emitMessage({ method: "endTurn" });
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
    expect(connectionPlayer2.send).not.toHaveBeenCalled();

    // Player1 ends turn -> everyone gets activePlayer '2'
    connectionPlayer1.__emitMessage({ method: "endTurn" });
    expect(parseSentJsonMessages(connectionPlayer1)).toContainEqual({ method: "turn", activePlayer: "2" });
    expect(parseSentJsonMessages(connectionPlayer2)).toContainEqual({ method: "turn", activePlayer: "2" });
  });
});

describe("playing cards", () => {
  it("playCard forwards cardPlayed to the opponent and broadcasts updated life (opponent damage)", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "lightning_bolt" });

    expect(parseSentJsonMessages(connectionPlayer2)).toContainEqual({
      method: "cardPlayed",
      owner: "Player1",
      name: "lightning_bolt",
    });
    expect(lastMessageOf(connectionPlayer1, "life").lifeTotals).toEqual({ Player1: 20, Player2: 17 });
    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 17 });
  });

  it("playCard resolves a 'self' target as the card owner", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "backfire" });

    expect(lastMessageOf(connectionPlayer1, "life").lifeTotals).toEqual({ Player1: 18, Player2: 20 });
    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 18, Player2: 20 });
  });

  it("clamps life at 0 (never negative)", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "giga_bolt" });

    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 0 });
  });

  it("ignores playCard while there is no opponent (no damage carried into the game)", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = connectPlayer(requestHandler);
    connectionPlayer1.send.mockClear();
    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "lightning_bolt" });
    expect(connectionPlayer1.send).not.toHaveBeenCalled();

    // Opponent joins; the first real bolt must take Player2 from 20 to 17
    const connectionPlayer2 = connectPlayer(requestHandler);
    connectionPlayer2.send.mockClear();
    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "lightning_bolt" });

    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 17 });
  });
});

describe("attacking", () => {
  it("attack deals the creature's power to the opponent; attacks with non-creatures are ignored", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    // Valid attack: Player2 attacks with grizzly_bear (power 2) => Player1 goes to 18
    connectionPlayer2.__emitMessage({ method: "attack", owner: "Player2", name: "grizzly_bear" });
    expect(lastMessageOf(connectionPlayer1, "life").lifeTotals).toEqual({ Player1: 18, Player2: 20 });
    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 18, Player2: 20 });

    // Invalid attack with a land => nothing sent
    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();
    connectionPlayer2.__emitMessage({ method: "attack", owner: "Player2", name: "mountain" });
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
    expect(connectionPlayer2.send).not.toHaveBeenCalled();
  });

  it("ignores attack while there is no opponent (no damage carried into the game)", async () => {
    const { requestHandler } = await importFreshServerModule();

    // Player1 is alone: the attack must be ignored
    const connectionPlayer1 = connectPlayer(requestHandler);
    connectionPlayer1.send.mockClear();
    connectionPlayer1.__emitMessage({ method: "attack", owner: "Player1", name: "grizzly_bear" });
    expect(connectionPlayer1.send).not.toHaveBeenCalled();

    // Opponent joins; the first real attack must take Player2 from 20 to 18 (not 16)
    const connectionPlayer2 = connectPlayer(requestHandler);
    connectionPlayer2.send.mockClear();
    connectionPlayer1.__emitMessage({ method: "attack", owner: "Player1", name: "grizzly_bear" });

    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 18 });
  });
});

describe("protocol", () => {
  it("ignores invalid JSON and keeps processing later messages", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    expect(() => connectionPlayer1.__emitInvalidJsonMessage()).not.toThrow();
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
    expect(connectionPlayer2.send).not.toHaveBeenCalled();

    // The connection still works afterwards
    connectionPlayer1.__emitMessage({ method: "endTurn" });
    expect(parseSentJsonMessages(connectionPlayer2)).toContainEqual({ method: "turn", activePlayer: "2" });
  });
});