import { describe, it, expect, vi, afterEach } from "vitest";
import {
  importFreshServerModule,
  connectPlayer,
  parseSentJsonMessages,
} from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("hand count", () => {
  it("caches and forwards handCount; cached counts are sent to a late-joining opponent", async () => {
    const { requestHandler } = await importFreshServerModule();

    // Player1 connects alone and reports handCount=7: nobody to forward to yet
    const connectionPlayer1 = connectPlayer(requestHandler);
    connectionPlayer1.send.mockClear();
    connectionPlayer1.__emitMessage({ method: "handCount", owner: "Player1", count: 7 });
    expect(connectionPlayer1.send).not.toHaveBeenCalled();

    // Player2 joins later and receives the cached count of Player1
    const connectionPlayer2 = connectPlayer(requestHandler);
    expect(parseSentJsonMessages(connectionPlayer2)).toContainEqual({
      method: "opponentHandCount",
      owner: "Player1",
      count: 7,
    });

    // Player2 reports handCount=5 -> forwarded to Player1
    connectionPlayer1.send.mockClear();
    connectionPlayer2.__emitMessage({ method: "handCount", owner: "Player2", count: 5 });
    expect(parseSentJsonMessages(connectionPlayer1)).toContainEqual({
      method: "opponentHandCount",
      owner: "Player2",
      count: 5,
    });
  });

  it("ends the game when a player leaves: the next game does not inherit their hand count", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = connectPlayer(requestHandler);
    connectionPlayer1.__emitMessage({ method: "handCount", owner: "Player1", count: 7 });
    const connectionPlayer2 = connectPlayer(requestHandler);

    connectionPlayer1.__emitClose();

    // A new player takes seat "1": Player2 must not receive the old player's count
    connectionPlayer2.send.mockClear();
    connectPlayer(requestHandler);

    expect(parseSentJsonMessages(connectionPlayer2)).not.toContainEqual(
      expect.objectContaining({ method: "opponentHandCount", owner: "Player1", count: 7 })
    );
  });
});