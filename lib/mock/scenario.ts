import type { Scenario } from "@/lib/scenario";

/**
 * Canned scenario for MOCK_MODE. We use the user-supplied location/description
 * to keep the title personalised, but the framing and partner line are
 * deterministic so the offline run is reproducible.
 */
export function mockScenario(args: {
  location: string;
  description: string;
}): Scenario {
  const loc = args.location.trim() || "an unspecified location";
  return {
    title: "A rehearsal of the upcoming interaction.",
    scenePartnerLine: "Hey. You wanted to speak with me about something.",
    framing: `The interaction will take place in ${loc}. The rehearsal will proceed in private until adequacy is reached.`,
  };
}
