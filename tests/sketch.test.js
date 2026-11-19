import { describe, it, expect, vi, afterEach } from "vitest";
import { loadSketch } from "./test-utils/sketch-harness.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("sketch: what the turn banner is told", () => {
  it("tells the banner the room is full when the server rejects the connection", async () => {
    const sketch = await loadSketch();

    sketch.receive("roomFull");
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomFull: true })
    );
  });

  it("tells the banner the game is not ready while waiting for an opponent", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 1 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: "1", gameReadyToStart: false })
    );
  });

  it("tells the banner the game is ready when both players are connected", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 2 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameReadyToStart: true })
    );
  });

  it("goes back to 'not ready' when the opponent leaves", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 2 });
    sketch.receive("numPlayers", { number: 1 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameReadyToStart: false })
    );
  });
});