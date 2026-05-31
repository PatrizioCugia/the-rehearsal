"use client";

import { useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";
import type { Take } from "@/lib/session";
import Curve from "./Curve";
import TypedText from "./TypedText";

export default function Summary({
  scenario,
  takes,
  setImageUrl,
  onNewSession,
}: {
  scenario: Scenario;
  takes: Take[];
  setImageUrl: string | null;
  onNewSession: () => void;
}) {
  const [report, setReport] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    const last = takes[takes.length - 1];
    void (async () => {
      try {
        const r = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario,
            takeNumber: last?.takeNumber ?? takes.length,
            history: takes.slice(0, -1).map((t) => ({
              takeNumber: t.takeNumber,
              signals: t.signals,
              engagement: t.engagement,
              cqiOverall: t.cqiOverall,
              advice: t.advice,
            })),
            inter1: {
              signals: last?.signals ?? [],
              engagement_state: last?.engagement,
              conversation_quality: last?.cqi,
            },
            mode: "stopping",
          }),
        });
        const j = (await r.json()) as { report?: string };
        const reportText =
          j.report?.trim() ||
          "The session has concluded. The record will be retained.";
        setReport(reportText);

        const t = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reportText }),
        });
        if (t.ok) {
          const blob = await t.blob();
          setAudioUrl(URL.createObjectURL(blob));
        }
      } catch {
        setReport("The session has concluded. The record will be retained.");
      } finally {
        setComposing(false);
      }
    })();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [audioUrl]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-10 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          End of session
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">
          {scenario.title}
        </h1>
        <p className="text-sm text-neutral-400 mt-2">
          {takes.length === 1
            ? "You completed one rehearsal."
            : `You completed ${takes.length} rehearsals.`}
        </p>
      </header>

      {setImageUrl && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setImageUrl}
            alt="The rehearsal set."
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      <Curve takes={takes} />

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5 min-h-[110px]">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Final assessment
        </p>
        {composing ? (
          <p className="text-neutral-400">Composing the closing remarks.</p>
        ) : (
          <p className="text-neutral-100 leading-relaxed">
            <TypedText text={report ?? ""} />
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onNewSession}
          className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
        >
          Begin a new scenario
        </button>
      </div>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />
      )}
    </div>
  );
}
