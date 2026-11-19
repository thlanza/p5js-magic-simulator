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

describe("seats and connections", () => {
  it("assigns order '1' to the first player and '2' to the second, and broadcasts numPlayers/turn", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = connectPlayer(requestHandler);
    expect(parseSentJsonMessages(connectionPlayer1)).toContainEqual(
      expect.objectContaining({ method: "connect", playerId: "uuid-1", order: "1" })
    );

    const connectionPlayer2 = connectPlayer(requestHandler);
    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);
    expect(messagesPlayer2).toContainEqual(
      expect.objectContaining({ method: "connect", playerId: "uuid-2", order: "2" })
    );
    expect(messagesPlayer2).toContainEqual({ method: "numPlayers", number: 2 });

    const messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);
    expect(messagesPlayer1).toContainEqual({ method: "numPlayers", number: 2 });
    expect(messagesPlayer1).toContainEqual({ method: "turn", activePlayer: "1" });
  });

  it("rejects a 3rd connection with roomFull and closes it", async () => {
    const { requestHandler } = await importFreshServerModule();
    connectTwoPlayers(requestHandler);

    const connectionPlayer3 = connectPlayer(requestHandler);

    expect(parseSentJsonMessages(connectionPlayer3)).toContainEqual({ method: "roomFull" });
    expect(connectionPlayer3.close).toHaveBeenCalledTimes(1);
  });

  it("assigns the free seat: after Player1 leaves, the next player gets order '1'", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1 } = connectTwoPlayers(requestHandler);

    // Player1 leaves; Player2 keeps seat "2"
    connectionPlayer1.__emitClose();

    // A new player joins and must take the free seat "1"
    const connectionPlayer3 = connectPlayer(requestHandler);
    expect(parseSentJsonMessages(connectionPlayer3)).toContainEqual(
      expect.objectContaining({ method: "connect", playerId: "uuid-3", order: "1" })
    );
  });

  it("disconnect removes the player, gives the turn to the remaining seat and broadcasts turn/numPlayers", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    connectionPlayer1.__emitClose();

    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);
    expect(messagesPlayer2).toContainEqual(expect.objectContaining({ method: "disconnect" }));
    expect(messagesPlayer2).toContainEqual({ method: "numPlayers", number: 1 });
    expect(messagesPlayer2).toContainEqual({ method: "turn", activePlayer: "2" });

    // The leaving player receives nothing after removal
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
  });

  it("ends the game when a player leaves: nothing carries over to the next game", async () => {
    const { requestHandler } = await importFreshServerModule();
    const { connectionPlayer1, connectionPlayer2 } = connectTwoPlayers(requestHandler);

    // Game in progress: Player2 takes 3 damage (20 -> 17)
    connectionPlayer1.__emitMessage({ method: "playCard", owner: "Player1", name: "lightning_bolt" });

    // Player1 leaves -> the game ends
    // (today immediately; after D1, when the reconnect timeout expires)
    connectionPlayer2.send.mockClear();
    connectionPlayer1.__emitClose();
    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 20 });

    // A NEW game starts with a new opponent: Player2 must go 20 -> 17 (not 17 -> 14)
    const connectionPlayer3 = connectPlayer(requestHandler);
    connectionPlayer2.send.mockClear();
    connectionPlayer3.__emitMessage({ method: "playCard", owner: "Player1", name: "lightning_bolt" });

    expect(lastMessageOf(connectionPlayer2, "life").lifeTotals).toEqual({ Player1: 20, Player2: 17 });
  });
});