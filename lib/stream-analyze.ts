/**
 * ISOLATED, UNTESTED. Phase 4 scaffold.
 *
 * Browser-side client for Interhuman /v1/stream/analyze. Per the skills guide:
 *   - URL: wss://api.interhuman.ai/v1/stream/analyze
 *   - Auth: the browser cannot set Authorization on a WS handshake, so the
 *     key is passed as the WebSocket subprotocol. This exposes the key
 *     client-side. Acceptable for an internal demo only.
 *   - Workflow: connect → (optional) send session-config JSON text frame →
 *     send binary video segments (each ≥3s, ≤32MB) → receive JSON envelopes.
 *
 * Envelope shape: { type, timestamp, correlation_id, data }
 *
 * This module is NOT imported from any UI surface in the working spine.
 * The corresponding component (StreamTicker) is also flag-gated by
 * NEXT_PUBLIC_ENABLE_STREAM and currently unused.
 */

export type StreamSignalEvent = {
  type: "signal.detected";
  timestamp: string;
  correlation_id: string;
  data: { signal_type: string; probability?: "low" | "medium" | "high" };
};

export type StreamEngagementEvent = {
  type: "engagement.updated";
  timestamp: string;
  correlation_id: string;
  data: { state: string; start?: number; end?: number };
};

export type StreamCQIEvent = {
  type: "conversation_quality.updated";
  timestamp: string;
  correlation_id: string;
  data: Record<string, unknown>;
};

export type StreamErrorEvent = {
  type: "error";
  timestamp: string;
  correlation_id: string;
  data: { code: string; message: string; link?: string; segment?: unknown };
};

export type StreamEnvelope =
  | StreamSignalEvent
  | StreamEngagementEvent
  | StreamCQIEvent
  | StreamErrorEvent
  | { type: string; timestamp: string; correlation_id: string; data: unknown };

export type StreamClientHandlers = {
  onEvent?: (env: StreamEnvelope) => void;
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onSocketError?: (ev: Event) => void;
};

export type StreamClient = {
  send: (segment: Blob | ArrayBuffer) => void;
  updateConfig: (cfg: Record<string, unknown>) => void;
  close: () => void;
};

const URL = "wss://api.interhuman.ai/v1/stream/analyze";

export function createStreamClient(
  apiKey: string,
  handlers: StreamClientHandlers = {},
  initialConfig?: { include?: string[] }
): StreamClient {
  // Subprotocol carries the API key (browser can't set Authorization header).
  const ws = new WebSocket(URL, apiKey);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    if (initialConfig) {
      try {
        ws.send(JSON.stringify(initialConfig));
      } catch (e) {
        console.error("[stream] send config failed", e);
      }
    }
    handlers.onOpen?.();
  });

  ws.addEventListener("message", (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      const env = JSON.parse(ev.data) as StreamEnvelope;
      handlers.onEvent?.(env);
    } catch (e) {
      console.error("[stream] non-JSON text frame", e, ev.data);
    }
  });

  ws.addEventListener("error", (ev) => handlers.onSocketError?.(ev));
  ws.addEventListener("close", (ev) => handlers.onClose?.(ev));

  return {
    send(segment: Blob | ArrayBuffer) {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (segment instanceof Blob) {
        void segment.arrayBuffer().then((buf) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        });
      } else {
        ws.send(segment);
      }
    },
    updateConfig(cfg) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(cfg));
        } catch (e) {
          console.error("[stream] updateConfig failed", e);
        }
      }
    },
    close() {
      try {
        ws.close();
      } catch {
        // ignore
      }
    },
  };
}
