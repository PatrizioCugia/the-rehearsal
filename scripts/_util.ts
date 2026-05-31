export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`[${name}] missing in .env.local — set it before running.`);
    process.exit(2);
  }
  return v;
}

export function logShape(label: string, obj: unknown) {
  const text = JSON.stringify(obj, null, 2);
  const clipped = text.length > 4000 ? text.slice(0, 4000) + "\n…(truncated)" : text;
  console.log(`\n${label}:\n${clipped}\n`);
}
