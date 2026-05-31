"use client";

import { useState } from "react";
import Onboarding from "./Onboarding";
import Recorder from "./Recorder";
import type { Scenario } from "@/lib/scenario";

type Phase = "onboarding" | "recording";

export default function App() {
  const [phase, setPhase] = useState<Phase>("onboarding");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [setImageUrl, setSetImageUrl] = useState<string | null>(null);

  if (phase === "onboarding" || !scenario) {
    return (
      <Onboarding
        onDone={({ scenario: s, imageUrl }) => {
          setScenario(s);
          setSetImageUrl(imageUrl);
          setPhase("recording");
        }}
      />
    );
  }

  return <Recorder scenario={scenario} setImageUrl={setImageUrl} />;
}
