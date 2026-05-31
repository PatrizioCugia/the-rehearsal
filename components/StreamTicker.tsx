"use client";

/**
 * ISOLATED, UNTESTED, FLAG-OFF.
 *
 * Reads NEXT_PUBLIC_ENABLE_STREAM at build time; renders nothing when off.
 * Intentionally NOT imported by the Recorder or any other spine surface.
 * When (later) wired in, this component would sit over the live webcam panel
 * and show the most recent signal/engagement update from the WebSocket.
 *
 * Browser testing required before integration — see SESSION_NOTES.md.
 */

import { useEffect, useState } from "react";
import {
  createStreamClient,
  type StreamClient,
  type StreamEnvelope,
} from "@/lib/stream-analyze";

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_STREAM === "true";

export default function StreamTicker(props: {
  /** Provide segments from a separate MediaRecorder (3s+ each). */
  segmentSource?: (cb: (segment: Blob) => void) => () => void;
  /** Provide the key via a server endpoint to avoid baking into the bundle. */
  fetchKey?: () => Promise<string | null>;
}) {
  const [latest, setLatest] = useState<{
    type: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    let client: StreamClient | null = null;
    let stopSegments: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const key = props.fetchKey
        ? await props.fetchKey()
        : process.env.NEXT_PUBLIC_INTERHUMAN_API_KEY ?? null;
      if (!key || cancelled) return;

      client = createStreamClient(
        key,
        {
          onEvent: (env: StreamEnvelope) => {
            if (env.type === "signal.detected") {
              const d = env.data as {
                signal_type: string;
                probability?: string;
              };
              setLatest({
                type: "signal",
                label: `${d.signal_type}${d.probability ? " · " + d.probability : ""}`,
              });
            } else if (env.type === "engagement.updated") {
              const d = env.data as { state: string };
              setLatest({ type: "engagement", label: d.state });
            }
          },
        },
        { include: ["conversation_quality_overall"] }
      );

      if (props.segmentSource && client) {
        const c = client;
        stopSegments = props.segmentSource((segment) => {
          c.send(segment);
        });
      }
    })();

    return () => {
      cancelled = true;
      stopSegments?.();
      client?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ENABLED) return null;
  return (
    <div className="absolute top-3 right-3 rounded-md bg-black/85 border border-neutral-700 backdrop-blur-sm px-3 py-1.5 text-[11px] font-mono">
      <span className="text-neutral-500 uppercase tracking-widest mr-2">live</span>
      <span className="text-neutral-200">{latest?.label ?? "—"}</span>
    </div>
  );
}
