import { method } from "happy-dom/lib/PropertySymbol.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Helpers to build fake websocket connections and inspect what was sent.
 */
function createFakeWsConnection() {
  const eventHandlersByName = new Map();

  const connection = {
    send: vi.fn(),
    sendUTF: vi.fn(),
    close: vi.fn(),
    on: vi.fn((eventName, handler) => {
      eventHandlersByName.set(eventName, handler);
    }),

    __emitMessage(payloadObject) {
      const messageHandler = eventHandlersByName.get("message");
      if (!messageHandler) throw new Error("No 'message' handler registered on connection");
      messageHandler({ utf8Data: JSON.stringify(payloadObject) });
    },

    __emitInvalidJsonMessage() {
      const messageHandler = eventHandlersByName.get("message");
      if (!messageHandler) throw new Error("No 'message' handler registered on connection");
      messageHandler({ utf8Data: "not-json" });
    },

    __emitClose() {
      const closeHandler = eventHandlersByName.get("close");
      if (!closeHandler) throw new Error("No 'close' handler registered on connection");
      closeHandler();
    },
  };

  return connection;
}

function createFakeWsRequest({ pathname = "/", origin = "http://localhost", connection }) {
  return {
    resourceURL: { pathname },
    origin,
    accept: vi.fn(() => connection),
  };
}

function parseSentJsonMessages(connection) {
  return connection.send.mock.calls.map(([jsonString]) => JSON.parse(jsonString));
}

/**
 * -------------------------
 * Module mocks (hoisted)
 * -------------------------
 */

vi.mock("http", () => {
  const httpServer = {
    listen: vi.fn((port, callback) => {
      if (typeof callback === "function") callback();
    }),
    close: vi.fn(),
  };

  return {
    default: {
      createServer: vi.fn(() => httpServer),
    },
    __getHttpServerMock: () => httpServer,
  };
});

vi.mock("express", () => {
  const appInstance = {
    use: vi.fn(),
    get: vi.fn(),
  };

  const expressFunction = vi.fn(() => appInstance);
  expressFunction.static = vi.fn(() => "STATIC_MIDDLEWARE");

  return {
    default: expressFunction,
    __getAppInstanceMock: () => appInstance,
  };
});

vi.mock("uuid", () => {
  let queuedIds = ["uuid-1", "uuid-2", "uuid-3", "uuid-4"];

  const v4Mock = vi.fn(() => {
    const nextId = queuedIds.shift();
    return nextId ?? "uuid-default";
  });

  return {
    v4: v4Mock,
    __setUuidSequence: (newSequence) => {
      queuedIds = [...newSequence];
      v4Mock.mockClear();
    },
    __getUuidMock: () => v4Mock,
  };
});

vi.mock("websocket", () => {
  let lastWsServerInstance = null;

  class WebSocketServerMock {
    constructor({ httpServer }) {
      this.httpServer = httpServer;
      this._handlers = new Map();

      this.on = vi.fn((eventName, handler) => {
        this._handlers.set(eventName, handler);
      });

      this.shutDown = vi.fn();

      lastWsServerInstance = this;
    }

    __getHandler(eventName) {
      return this._handlers.get(eventName);
    }
  }

  return {
    default: { server: WebSocketServerMock },
    __getLastWsServerInstance: () => lastWsServerInstance,
  };
});

vi.mock("chokidar", () => {
  let watcherHandlersByEvent = {};

  const watcherInstance = {
    on: vi.fn((eventName, handler) => {
      watcherHandlersByEvent[eventName] = handler;
      return watcherInstance;
    }),
  };

  return {
    default: {
      watch: vi.fn(() => watcherInstance),
    },
    __getWatcherHandlers: () => watcherHandlersByEvent,
    __resetWatcherHandlers: () => {
      watcherHandlersByEvent = {};
      watcherInstance.on.mockClear();
    },
  };
});

/**
 * IMPORTANT: This mock string must match the import specifier used in server.js:
 *   import { cardDb } from './shared/cardDb.js';
 *
 * Place this test file at the project root so './shared/cardDb.js' resolves correctly.
 */
vi.mock("../shared/cardDb.js", () => {
  return {
    cardDb: {
      // Spell that hits opponent for 3.
      lightning_bolt: {
        type: "spell",
        effectsOnResolve: [{ type: "damagePlayer", target: "opponent", amount: 3 }],
      },

      // Spell that hits self for 2 (tests "self" normalization).
      backfire: {
        type: "spell",
        effectsOnResolve: [{ type: "damagePlayer", target: "self", amount: 2 }],
      },

      // Creature for attack tests.
      grizzly_bear: { type: "creature", power: 2 },

      // Non-creature for invalid attack tests.
      mountain: { type: "land" },

      // Huge damage to test clamping at 0.
      giga_bolt: {
        type: "spell",
        effectsOnResolve: [{ type: "damagePlayer", target: "opponent", amount: 999 }],
      },
    },
  };
});

/**
 * Utility: fresh-import server.js each test (because it has module-level state).
 */
async function importFreshServerModule() {
  vi.resetModules();

  const chokidarMock = await import("chokidar");
  chokidarMock.__resetWatcherHandlers();

  const uuidMock = await import("uuid");
  uuidMock.__setUuidSequence(["uuid-1", "uuid-2", "uuid-3", "uuid-4"]);

  // Silence noisy logs from module import.
  vi.spyOn(console, "log").mockImplementation(() => {});

  const serverModule = await import("../server.js");
  const websocketMock = await import("websocket");

  const wsServerInstance = websocketMock.__getLastWsServerInstance();
  if (!wsServerInstance) throw new Error("WebSocket server mock instance was not created");

  const requestHandler = wsServerInstance.__getHandler("request");
  if (!requestHandler) throw new Error("No 'request' handler registered on wsServer.on('request', ...)");

  const watcherHandlers = chokidarMock.__getWatcherHandlers();

  return { serverModule, requestHandler, wsServerInstance, watcherHandlers };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("server.js (unit)", () => {
  it("accepts /livereload sockets and pingReload sends reload messages to them", async () => {
    const { requestHandler, watcherHandlers } = await importFreshServerModule();

    const livereloadConnection = createFakeWsConnection();
    const livereloadRequest = createFakeWsRequest({
      pathname: "/livereload",
      connection: livereloadConnection,
    });

    requestHandler(livereloadRequest);

    // chokidar should have registered add/change/unlink listeners
    expect(typeof watcherHandlers.add).toBe("function");
    expect(typeof watcherHandlers.change).toBe("function");
    expect(typeof watcherHandlers.unlink).toBe("function");

    // Trigger a file change -> should send UTF reload to livereload client
    watcherHandlers.change("/some/file.js");

    expect(livereloadConnection.sendUTF).toHaveBeenCalledTimes(1);
    const sentPayload = JSON.parse(livereloadConnection.sendUTF.mock.calls[0][0]);
    expect(sentPayload).toEqual({ type: "reload", file: "/some/file.js" });
  });

  it("assigns order '1' to first player and '2' to second, and broadcasts numPlayers/turn", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);

    // First should receive connect with order 1 and uuid-1
    expect(messagesPlayer1).toContainEqual(
      expect.objectContaining({ method: "connect", playerId: "uuid-1", order: "1" })
    );

    // Second player connects
    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);
    expect(messagesPlayer2).toContainEqual(
      expect.objectContaining({ method: "connect", playerId: "uuid-2", order: "2" })
    );

    // After second connect, both players should get numPlayers=2 and a turn broadcast
    expect(messagesPlayer2).toContainEqual({ method: "numPlayers", number: 2 });
    expect(messagesPlayer1).toContainEqual({ method: "turn", activePlayer: "1" });

    const messagesPlayer1AfterSecondConnect = parseSentJsonMessages(connectionPlayer1);
    expect(messagesPlayer1AfterSecondConnect).toContainEqual({ method: "numPlayers", number: 2 });
    expect(messagesPlayer1AfterSecondConnect).toContainEqual({ method: "turn", activePlayer: "1"})

  });

  it("rejects a 3rd connection with roomFull and closes it", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    const connectionPlayer3 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer3 }));

    const messagesPlayer3 = parseSentJsonMessages(connectionPlayer3);

    expect(messagesPlayer3).toContainEqual({ method: "roomFull" });
    expect(connectionPlayer3.close).toHaveBeenCalledTimes(1);
  });

  it("endTurn only works for the active player, and toggles activePlayer", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    // Clear connection send history so we only look at endTurn behavior
    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    // Player2 tries to end turn while activePlayer is '1' -> ignored  
    connectionPlayer2.__emitMessage({ method: "endTurn" });
    
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
    expect(connectionPlayer2.send).not.toHaveBeenCalled();

    // Player1 ends turn -> broadcast turn activePlayer '2'
    connectionPlayer1.__emitMessage({ method: "endTurn"});

    const messagesAfterEndTurnPlayer1 = parseSentJsonMessages(connectionPlayer1);
    const messagesAfterEndTurnPlayer2 = parseSentJsonMessages(connectionPlayer2);

    expect(messagesAfterEndTurnPlayer1).toContainEqual({ method: "turn", activePlayer: "2" });
    expect(messagesAfterEndTurnPlayer2).toContainEqual({ method: "turn", activePlayer: "2"});
  });

  it("playCard forwards cardPlayed to opponent and broadcasts updated life totals (opponent damage)", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    // Player1 plays lightning_bolt, which deals 3 to opponent (Player2)
    connectionPlayer1.__emitMessage({
        method: "playCard",
        owner: "Player1",
        name: "lightning_bolt"
    });

    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);

    // Opponent should receive cardPlayed
    expect(messagesPlayer2).toContainEqual({
        method: "cardPlayed",
        owner: "Player1",
        name: "lightning_bolt"
    });

    // Both should receive life broadcast with Player2 reduced to 17
    const messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);
    const lifeMsgPlayer1 = messagesPlayer1.find((message) => message.method === "life");
    const lifeMsgPlayer2 = messagesPlayer2.find((message) => message.method === "life");

    expect(lifeMsgPlayer1).toBeTruthy();
    expect(lifeMsgPlayer2).toBeTruthy();
    expect(lifeMsgPlayer1.lifeTotals).toEqual({ Player1: 20, Player2: 17 });
    expect(lifeMsgPlayer2.lifeTotals).toEqual({ Player1: 20, Player2: 17 })
  });

  it("playCard normalizes 'self' target correctly (owner takes damage)", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    // Player1 plays backfire -> damagePlayer target 'self' amount 2 => Player becomes 18
    connectionPlayer1.__emitMessage({
        method: "playCard",
        owner: "Player1",
        name: "backfire"
    });

    const messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);
    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);

    const lifeMsgPlayer1 = messagesPlayer1.find((message) => message.method === "life");
    const lifeMsgPlayer2 = messagesPlayer2.find((message) => message.method === "life");

    expect(lifeMsgPlayer1.lifeTotals).toEqual({ Player1: 18, Player2: 20 });
    expect(lifeMsgPlayer2.lifeTotals).toEqual({ Player1: 18, Player2: 20 });
  });

  it("attack applies creature power damage to opponent and broadcasts life; ignores invalid attacks", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    // Valid attack: Player2 attacks with grizzly_bear (power 2) => Player1 goes to 18
    connectionPlayer2.__emitMessage({
        method: "attack",
        owner: "Player2",
        name: "grizzly_bear"
    });

    let messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);
    let messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);

    let lifeMsgPlayer1 = messagesPlayer1.find((message) => message.method === "life");
    let lifeMsgPlayer2 = messagesPlayer2.find((message) => message.method === "life");

    expect(lifeMsgPlayer1.lifeTotals).toEqual({ Player1: 18, Player2: 20 });
    expect(lifeMsgPlayer2.lifeTotals).toEqual({ Player1: 18, Player2: 20 });

    // Now try invalid attack with a land => should do nothing (no new life broadcast)
    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    connectionPlayer2.__emitMessage({
        method: "attack",
        owner: "Player2",
        name: "mountain"
    });

    expect(connectionPlayer1.send).not.toHaveBeenCalled();
    expect(connectionPlayer2.send).not.toHaveBeenCalled();
  });

  it("handCount is cached and forwared; cached counts are sent to a late-joining opponent", async () => {
    const { requestHandler } = await importFreshServerModule();

    //Player1 connects alone and reports handCount=7
    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: '/', connection: connectionPlayer1 }));

    connectionPlayer1.send.mockClear();

    connectionPlayer1.__emitMessage({
        method: "handCount",
        owner: "Player1",
        count: 7
    });

    // No opponent yet, so nobody receives opponentHandCount
    expect(connectionPlayer1.send).not.toHaveBeenCalled();

    // Player2 connects later -> should receive cached opponentHandCount for Player1
    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);

    expect(messagesPlayer2).toContainEqual({
        method: "opponentHandCount",
        owner: "Player1",
        count: 7
    });

    // Now Player2 sends its handCount=5 -> Player1 should receive opponentHandCount
    connectionPlayer1.send.mockClear();
    connectionPlayer2.__emitMessage({
        method: "handCount",
        owner: "Player2",
        count: 5
    });

    const messagesPlayer1 = parseSentJsonMessages(connectionPlayer1);
    expect(messagesPlayer1).toContainEqual({
        method: "opponentHandCount",
        owner: "Player2",
        count: 5
    })
  });

  it("disconnect removes player, updates activePlayer to remaining seat, and broadcasts turn/numPlayers", async () => {
    const { requestHandler } = await importFreshServerModule();

    const connectionPlayer1 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer1 }));

    const connectionPlayer2 = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/", connection: connectionPlayer2 }));

    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();

    // Player1 leaves
    connectionPlayer1.__emitClose();

    // Only Player2 remains; they should receive disconnect + numPlayers=1 + turn activePlayer-'2'
    const messagesPlayer2 = parseSentJsonMessages(connectionPlayer2);

    expect(messagesPlayer2).toContainEqual(expect.objectContaining({ method: "disconnect" }));
    expect(messagesPlayer2).toContainEqual({ method: "numPlayers", number: 1 });
    expect(messagesPlayer2).toContainEqual({ method: "turn", activePlayer: "2" });

    // Leaing player should not receive broadcasts after removal
    expect(connectionPlayer1.send).not.toHaveBeenCalled();
  })
});