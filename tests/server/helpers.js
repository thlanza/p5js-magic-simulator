import { vi } from "vitest";

/**
 * Mocks shared by all server tests.
 *
 * vi.doMock (not vi.mock): vi.mock is only hoisted inside test files.
 * doMock applies to every *dynamic* import that happens afterwards,
 * and server.js is always imported dynamically by importFreshServerModule().
 */

vi.doMock("http", () => {
  const httpServer = {
    listen: vi.fn((port, callback) => {
      if (typeof callback === "function") callback();
    }),
    close: vi.fn(),
  };

  return {
    default: { createServer: vi.fn(() => httpServer) },
    __getHttpServerMock: () => httpServer,
  };
});

vi.doMock("express", () => {
  const appInstance = { use: vi.fn(), get: vi.fn() };
  const expressFunction = vi.fn(() => appInstance);
  expressFunction.static = vi.fn(() => "STATIC_MIDDLEWARE");

  return { default: expressFunction };
});

vi.doMock("uuid", () => {
  let queuedIds = [];
  const v4Mock = vi.fn(() => queuedIds.shift() ?? "uuid-default");

  return {
    v4: v4Mock,
    __setUuidSequence: (newSequence) => {
      queuedIds = [...newSequence];
      v4Mock.mockClear();
    },
  };
});

vi.doMock("websocket", () => {
  let lastWsServerInstance = null;

  class WebSocketServerMock {
    constructor({ httpServer }) {
      this.httpServer = httpServer;
      this._handlers = new Map();
      this.on = vi.fn((eventName, handler) => this._handlers.set(eventName, handler));
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

vi.doMock("chokidar", () => {
  let watcherHandlersByEvent = {};

  const watcherInstance = {
    on: vi.fn((eventName, handler) => {
      watcherHandlersByEvent[eventName] = handler;
      return watcherInstance;
    }),
  };

  return {
    default: { watch: vi.fn(() => watcherInstance) },
    __getWatcherHandlers: () => watcherHandlersByEvent,
    __resetWatcherHandlers: () => {
      watcherHandlersByEvent = {};
      watcherInstance.on.mockClear();
    },
  };
});

// Test card database, independent from the real one.
// The path is relative to THIS file: tests/server/ -> <root>/shared/cardDb.js,
// the same module server.js imports.
vi.doMock("../../shared/cardDb.js", () => ({
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
}));

/**
 * Fake websocket connection: lets a test inject messages/close events
 * and inspect what the server sent.
 */
export function createFakeWsConnection() {
  const eventHandlersByName = new Map();

  return {
    send: vi.fn(),
    sendUTF: vi.fn(),
    close: vi.fn(),
    on: vi.fn((eventName, handler) => eventHandlersByName.set(eventName, handler)),

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
}

export function createFakeWsRequest({ pathname = "/", origin = "http://localhost", connection }) {
  return {
    resourceURL: { pathname },
    origin,
    accept: vi.fn(() => connection),
  };
}

export function parseSentJsonMessages(connection) {
  return connection.send.mock.calls.map(([jsonString]) => JSON.parse(jsonString));
}

/** Last message with the given method sent to this connection (or undefined). */
export function lastMessageOf(connection, method) {
  return parseSentJsonMessages(connection)
    .filter((message) => message.method === method)
    .at(-1);
}

/** Connects one player and returns its fake connection. */
export function connectPlayer(requestHandler) {
  const connection = createFakeWsConnection();
  requestHandler(createFakeWsRequest({ pathname: "/", connection }));
  return connection;
}

/**
 * Connects two players. By default clears their send history,
 * so the test only sees what happens afterwards.
 */
export function connectTwoPlayers(requestHandler, { clearHistory = true } = {}) {
  const connectionPlayer1 = connectPlayer(requestHandler);
  const connectionPlayer2 = connectPlayer(requestHandler);

  if (clearHistory) {
    connectionPlayer1.send.mockClear();
    connectionPlayer2.send.mockClear();
  }

  return { connectionPlayer1, connectionPlayer2 };
}

export async function getHttpServerMock() {
  const httpMock = await import("http");
  return httpMock.__getHttpServerMock();
}

/**
 * Fresh-imports server.js (it has module-level state),
 * with predictable ids: uuid-1, uuid-2, ...
 */
export async function importFreshServerModule() {
  vi.resetModules();

  const chokidarMock = await import("chokidar");
  chokidarMock.__resetWatcherHandlers();

  const uuidMock = await import("uuid");
  uuidMock.__setUuidSequence(["uuid-1", "uuid-2", "uuid-3", "uuid-4"]);

  // Silence noisy logs.
  vi.spyOn(console, "log").mockImplementation(() => {});

  const serverModule = await import("../../server.js");
  const websocketMock = await import("websocket");

  const wsServerInstance = websocketMock.__getLastWsServerInstance();
  if (!wsServerInstance) throw new Error("WebSocket server mock instance was not created");

  const requestHandler = wsServerInstance.__getHandler("request");
  if (!requestHandler) throw new Error("No 'request' handler registered on wsServer.on('request', ...)");

  const watcherHandlers = chokidarMock.__getWatcherHandlers();

  return { serverModule, requestHandler, wsServerInstance, watcherHandlers };
}