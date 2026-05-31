export type Scenario = {
  title: string;
  scenePartnerLine: string;
  framing: string;
};

export const FALLBACK_SCENARIO: Scenario = {
  title: "An interaction the person has decided to prepare for.",
  scenePartnerLine: "Have a seat.",
  framing: "The details have been omitted. The rehearsal will proceed without them.",
};
