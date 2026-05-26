import type {
  DurableObjectNamespace,
  DurableObjectState,
  WebSocket as CloudflareWebSocket
} from "@cloudflare/workers-types";

declare const WebSocketPair: {
  new (): {
    0: CloudflareWebSocket;
    1: CloudflareWebSocket;
  };
};

type Env = {
  LIVE_VIEWERS: DurableObjectNamespace;
};

const ROOM_NAME = "primary-landing-page";
const WEBSOCKET_OPEN = 1;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const VIEWER_ID_MAX_LENGTH = 96;

const worker = {
  fetch(request: Request, env: Env) {
    const room = env.LIVE_VIEWERS.get(env.LIVE_VIEWERS.idFromName(ROOM_NAME));
    return room.fetch(request as unknown as Parameters<typeof room.fetch>[0]);
  }
};

export default worker;

export class LiveViewerRoom {
  constructor(private readonly state: DurableObjectState) {}

  fetch(request: Request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ viewers: this.activeViewerCount() });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [CloudflareWebSocket, CloudflareWebSocket];

    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      connectedAt: Date.now(),
      viewerId: getViewerId(request)
    });
    this.broadcastViewerCount();

    return new Response(null, {
      status: 101,
      webSocket: client
    } as ResponseInit & { webSocket: CloudflareWebSocket });
  }

  webSocketMessage(socket: CloudflareWebSocket) {
    socket.send(JSON.stringify({ type: "viewer_count", viewers: this.activeViewerCount() }));
  }

  webSocketClose() {
    this.broadcastViewerCount();
  }

  webSocketError() {
    this.broadcastViewerCount();
  }

  private activeViewerCount() {
    const uniqueViewers = new Set<string>();
    let hasAnonymousViewer = false;

    for (const socket of this.state.getWebSockets()) {
      if (socket.readyState !== WEBSOCKET_OPEN) {
        continue;
      }

      const attachment = socket.deserializeAttachment() as
        | { viewerId?: unknown }
        | undefined;

      if (typeof attachment?.viewerId === "string" && attachment.viewerId) {
        uniqueViewers.add(attachment.viewerId);
      } else {
        hasAnonymousViewer = true;
      }
    }

    return uniqueViewers.size + (hasAnonymousViewer ? 1 : 0);
  }

  private broadcastViewerCount() {
    const payload = JSON.stringify({ type: "viewer_count", viewers: this.activeViewerCount() });

    for (const socket of this.state.getWebSockets()) {
      if (socket.readyState !== WEBSOCKET_OPEN) {
        continue;
      }

      try {
        socket.send(payload);
      } catch {
        socket.close(1011, "Unable to deliver viewer count");
      }
    }
  }
}

function getViewerId(request: Request) {
  const viewerId = new URL(request.url).searchParams.get("viewerId");

  if (!viewerId || viewerId.length > VIEWER_ID_MAX_LENGTH) {
    return null;
  }

  return /^[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*$/.test(viewerId) ? viewerId : null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}
