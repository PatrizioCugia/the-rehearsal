"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";

type Status =
  | "idle"
  | "permission-denied"
  | "recording"
  | "analyzing"
  | "composing"
  | "voicing"
  | "playback"
  | "error";

const ANALYSIS_BEATS: Record<Status, string> = {
  idle: "",
  "permission-denied": "",
  recording: "Recording.",
  analyzing: "Analyzing the take.",
  composing: "Composing the assessment.",
  voicing: "Voicing the assessment.",
  playback: "",
  error: "",
};

type Inter1Signal = { type: string; start: number; end: number };
type Inter1Payload = {
  signals: Inter1Signal[];
  engagement_state?: Array<{ state: string; start: number; end: number }>;
  conversation_quality?: {
    overall?: Record<string, number>;
    timeline?: Array<{ start: number; end: number; values: Record<string, number> }>;
  };
};

function pickWebmMime(): string {
  const opts = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m))
      return m;
  }
  return "";
}

export default function Recorder(props: {
  scenario: Scenario;
  setImageUrl: string | null;
}) {
  const { scenario, setImageUrl } = props;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [takeNumber, setTakeNumber] = useState<number>(1);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [report, setReport] = useState<string | null>(null);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [inter1, setInter1] = useState<Inter1Payload | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("the-rehearsal:takeNumber")
        : null;
    if (stored) {
      const n = parseInt(stored, 10);
      if (Number.isFinite(n) && n > 0) setTakeNumber(n);
    }
  }, []);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      setErrorMessage(
        "Camera or microphone access was denied. The rehearsal cannot begin."
      );
      setStatus("permission-denied");
      console.error(e);
      return null;
    }
  }, []);

  useEffect(() => {
    ensureStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (tickRef.current !== null) cancelAnimationFrame(tickRef.current);
      if (replayUrl) URL.revokeObjectURL(replayUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "playback") return;
    const v = replayVideoRef.current;
    const a = audioRef.current;
    if (!v || !a) return;
    v.currentTime = 0;
    a.currentTime = 0;
    v.muted = true;
    v.play().catch(() => {});
    a.play().catch(() => {});
  }, [status, replayUrl, audioUrl]);

  const tick = useCallback(() => {
    setElapsedMs(Date.now() - startedAtRef.current);
    tickRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setReport(null);
    setInter1(null);
    if (replayUrl) {
      URL.revokeObjectURL(replayUrl);
      setReplayUrl(null);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    const stream = await ensureStream();
    if (!stream) return;

    const mimeType = pickWebmMime();
    let rec: MediaRecorder;
    try {
      rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      console.error(e);
      setErrorMessage("This browser does not support recording.");
      setStatus("error");
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      if (tickRef.current !== null) cancelAnimationFrame(tickRef.current);
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      void analyze(blob);
    };
    recorderRef.current = rec;
    rec.start(1000);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    tickRef.current = requestAnimationFrame(tick);
    setStatus("recording");
  }, [ensureStream, replayUrl, audioUrl, tick]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const analyze = useCallback(
    async (blob: Blob) => {
      try {
        setStatus("analyzing");

        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("file", blob, `take-${takeNumber}.${ext}`);
        const r1 = await fetch("/api/analyze", { method: "POST", body: form });
        if (!r1.ok) throw new Error(`analyze failed: ${r1.status}`);
        const inter1Payload = (await r1.json()) as Inter1Payload;
        setInter1(inter1Payload);

        setStatus("composing");
        const r2 = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioTitle: scenario.title,
            takeNumber,
            inter1: inter1Payload,
          }),
        });
        if (!r2.ok) throw new Error(`coach failed: ${r2.status}`);
        const { report: reportText } = (await r2.json()) as { report: string };

        setStatus("voicing");
        const r3 = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reportText }),
        });
        if (!r3.ok) throw new Error(`tts failed: ${r3.status}`);
        const audioBlob = await r3.blob();

        setReplayUrl(URL.createObjectURL(blob));
        setAudioUrl(URL.createObjectURL(audioBlob));
        setReport(reportText);
        setStatus("playback");
      } catch (e) {
        console.error(e);
        setErrorMessage(
          "The assessment could not be completed. The rehearsal will pause."
        );
        setStatus("error");
      }
    },
    [takeNumber, scenario.title]
  );

  const nextTake = useCallback(() => {
    const n = takeNumber + 1;
    setTakeNumber(n);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("the-rehearsal:takeNumber", String(n));
    }
    setReport(null);
    setInter1(null);
    if (replayUrl) URL.revokeObjectURL(replayUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setReplayUrl(null);
    setAudioUrl(null);
    setStatus("idle");
  }, [takeNumber, replayUrl, audioUrl]);

  const beat = ANALYSIS_BEATS[status];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 md:p-10 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            Rehearsal #{takeNumber}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1 leading-tight">
            {scenario.title}
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">{scenario.framing}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Set image */}
        <div className="aspect-[4/5] md:aspect-auto md:h-full rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden relative">
          {setImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={setImageUrl}
              alt="The rehearsal set."
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-neutral-500 text-xs leading-relaxed">
                The set could not be constructed.
                <br />
                We proceed without it.
              </p>
            </div>
          )}
        </div>

        {/* Webcam + corner signal panel */}
        <div className="aspect-video md:aspect-auto md:h-full relative rounded-lg border border-neutral-800 bg-black overflow-hidden">
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              status === "playback" ? "hidden" : "block"
            }`}
          />
          {replayUrl && (
            <video
              ref={replayVideoRef}
              src={replayUrl}
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${
                status === "playback" ? "block" : "hidden"
              }`}
            />
          )}
          {status === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/70 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}
          {(status === "analyzing" ||
            status === "composing" ||
            status === "voicing") && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-neutral-200 text-lg">{beat}</p>
                <p className="text-neutral-600 text-xs uppercase tracking-widest">
                  Please wait.
                </p>
              </div>
            </div>
          )}
          <SignalPanel inter1={inter1} visible={status === "playback"} />
        </div>
      </div>

      {/* Scene partner line */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Scene partner
        </p>
        <p className="text-neutral-200">&ldquo;{scenario.scenePartnerLine}&rdquo;</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {status === "idle" && (
          <button
            onClick={startRecording}
            className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
          >
            Begin take {takeNumber}
          </button>
        )}
        {status === "recording" && (
          <button
            onClick={stopRecording}
            className="px-5 py-2.5 rounded bg-red-600 text-white font-medium hover:bg-red-500"
          >
            End take
          </button>
        )}
        {status === "playback" && (
          <>
            <button
              onClick={nextTake}
              className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
            >
              Rehearse again
            </button>
            {audioUrl && (
              <button
                onClick={() => {
                  const v = replayVideoRef.current;
                  const a = audioRef.current;
                  if (v) {
                    v.currentTime = 0;
                    v.play().catch(() => {});
                  }
                  if (a) {
                    a.currentTime = 0;
                    a.play().catch(() => {});
                  }
                }}
                className="px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
              >
                Replay
              </button>
            )}
          </>
        )}
        {(status === "error" || status === "permission-denied") && (
          <button
            onClick={() => {
              setStatus("idle");
              setErrorMessage(null);
            }}
            className="px-5 py-2.5 rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          >
            Try again
          </button>
        )}
      </div>

      {errorMessage && <p className="text-sm text-neutral-400">{errorMessage}</p>}

      {report && status === "playback" && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Rehearsal Report — take {takeNumber}
          </p>
          <p className="text-neutral-100 leading-relaxed whitespace-pre-wrap">
            {report}
          </p>
        </div>
      )}

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />
      )}
    </div>
  );
}

function SignalPanel({
  inter1,
  visible,
}: {
  inter1: Inter1Payload | null;
  visible: boolean;
}) {
  if (!visible || !inter1) return null;
  const cqi = inter1.conversation_quality?.overall?.quality_index;
  const signals = inter1.signals.slice(0, 6);
  return (
    <div className="absolute bottom-3 right-3 w-[44%] max-w-[260px] rounded-md bg-black/85 border border-neutral-700 backdrop-blur-sm p-3 text-[11px] leading-snug">
      <div className="flex items-center justify-between mb-1.5">
        <span className="uppercase tracking-widest text-neutral-500">Signals</span>
        {typeof cqi === "number" && (
          <span className="text-neutral-300">CQI {cqi.toFixed(0)}</span>
        )}
      </div>
      {signals.length === 0 ? (
        <p className="text-neutral-500">None detected.</p>
      ) : (
        <ul className="space-y-0.5">
          {signals.map((s, i) => (
            <li key={i} className="flex justify-between text-neutral-300">
              <span>{s.type}</span>
              <span className="text-neutral-500 tabular-nums">
                {s.start.toFixed(0)}–{s.end.toFixed(0)}s
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
