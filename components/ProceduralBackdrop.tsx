/**
 * MOCK_MODE backdrop. Index cards pinned to a board, connected with thin
 * lines, in the restrained mono aesthetic. Looks intentional. No animation —
 * deadpan stillness.
 *
 * This is a fallback for MOCK_MODE only. The real image pillar is the
 * Gemini Nano Banana set; this is what gets shown when there is no key
 * available for a dry-run.
 */
export default function ProceduralBackdrop({
  scenarioTitle,
}: {
  scenarioTitle?: string;
}) {
  // Cards on an invisible grid. (x, y, label).
  const CARDS: Array<{ x: number; y: number; label: string }> = [
    { x: 32, y: 60, label: "OPENING" },
    { x: 160, y: 100, label: "PAUSE" },
    { x: 286, y: 60, label: "RESPONSE A" },
    { x: 286, y: 200, label: "RESPONSE B" },
    { x: 160, y: 260, label: "REBUTTAL" },
    { x: 32, y: 300, label: "FALLBACK" },
    { x: 286, y: 360, label: "EXIT" },
  ];

  // Lines connecting them (start, end indexes into CARDS).
  const EDGES: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
    [4, 5],
    [3, 6],
  ];

  const CARD_W = 84;
  const CARD_H = 36;

  const center = (i: number) => ({
    x: CARDS[i]!.x + CARD_W / 2,
    y: CARDS[i]!.y + CARD_H / 2,
  });

  return (
    <div className="w-full h-full bg-neutral-950 relative">
      <svg
        viewBox="0 0 400 440"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* corkboard noise */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#171717"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="400" height="440" fill="url(#grid)" />

        {/* string between cards */}
        {EDGES.map(([a, b], i) => {
          const A = center(a);
          const B = center(b);
          return (
            <line
              key={i}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#404040"
              strokeWidth="0.75"
              strokeDasharray="2 3"
            />
          );
        })}

        {/* cards */}
        {CARDS.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x}
              y={c.y}
              width={CARD_W}
              height={CARD_H}
              fill="#0a0a0a"
              stroke="#525252"
              strokeWidth="0.75"
            />
            {/* pin */}
            <circle
              cx={c.x + CARD_W / 2}
              cy={c.y + 4}
              r="1.5"
              fill="#737373"
            />
            <text
              x={c.x + CARD_W / 2}
              y={c.y + CARD_H / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill="#a3a3a3"
              letterSpacing="0.1em"
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* caption */}
        <text
          x="200"
          y="424"
          textAnchor="middle"
          fontSize="8"
          fontFamily="var(--font-mono)"
          fill="#525252"
          letterSpacing="0.2em"
        >
          MOCK SET — {scenarioTitle ? truncate(scenarioTitle, 38) : "REHEARSAL"}
        </text>
      </svg>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s.toUpperCase();
  return (s.slice(0, max - 1) + "…").toUpperCase();
}
