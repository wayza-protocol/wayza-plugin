// The shell commands the mod asks a person about before they run: the ones that are hard to take back or reach
// outside this machine. Each rule's name finishes "OK for Claude Code to ...?", the ask the person sees.
export const RISKY: readonly { name: string; test: RegExp }[] = [
  { name: 'force push', test: /\bgit\b[^;&|]*\bpush\b[^;&|]*(\s--force(-with-lease)?\b|\s-[a-zA-Z]*f\b|\s\+\S)/ },
  { name: 'push to main', test: /\bgit\b[^;&|]*\bpush\b[^;&|]*\s(\S+:)?(main|master)\b/ },
  { name: 'throw away work in git', test: /\bgit\b[^;&|]*\b(reset\s+--hard|clean\s+-[a-zA-Z]*f|branch\s+-D|checkout\s+--\s+\.|restore\s+(--staged\s+)?\.)/ },
  { name: 'delete files recursively', test: /\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/ },
  { name: 'publish a package', test: /\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgem\s+push\b/ },
  { name: 'deploy', test: /\b(wrangler\s+(deploy|publish)|vercel\b[^;&|]*--prod|netlify\s+deploy\b[^;&|]*--prod|fly\s+deploy|firebase\s+deploy|serverless\s+deploy|sls\s+deploy|cdk\s+deploy)\b/ },
  { name: 'change infrastructure', test: /\b(terraform|tofu)\s+(apply|destroy)\b|\bkubectl\s+(apply|delete|scale|rollout)\b|\bhelm\s+(install|upgrade|uninstall)\b|\bdocker\s+push\b/ },
  { name: 'merge or release on GitHub', test: /\bgh\s+(pr\s+merge|release\s+create|repo\s+delete)\b/ },
  { name: 'drop database data', test: /\b(drop\s+(table|database|schema)|truncate\s+table)\b/i },
]

// The rule a command matches, or null. `extra` is the person's own pattern (the also_ask_for option).
export function riskOf(command: string, extra?: string): string | null {
  for (const r of RISKY) if (r.test.test(command)) return r.name
  if (extra) {
    try { if (new RegExp(extra).test(command)) return 'run a command you asked to be asked about' } catch { /* a bad pattern never blocks */ }
  }
  return null
}
