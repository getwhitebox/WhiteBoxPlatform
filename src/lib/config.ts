// =============================================================================
// Checks the site's required settings (environment variables) are present and
// in the right format. Problems are reported by setting NAME only – values are
// never shown.
// =============================================================================

export type ConfigProblem = { name: string; problem: string };

export function checkSupabaseConfig(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    problems.push({ name: "NEXT_PUBLIC_SUPABASE_URL", problem: "is missing" });
  } else if (/["'\s]/.test(url)) {
    problems.push({ name: "NEXT_PUBLIC_SUPABASE_URL", problem: "contains quote marks or spaces" });
  } else if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
    problems.push({
      name: "NEXT_PUBLIC_SUPABASE_URL",
      problem: "should look exactly like https://xxxx.supabase.co (nothing after .co)",
    });
  }

  if (!key) {
    problems.push({ name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: "is missing" });
  } else if (/["'\s]/.test(key)) {
    problems.push({ name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: "contains quote marks or spaces" });
  } else if (key.startsWith("sb_secret_")) {
    problems.push({
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      problem: "is a SECRET key – use the publishable key instead, and treat this secret key as exposed",
    });
  } else if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ")) {
    problems.push({
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      problem: "should start with sb_publishable_",
    });
  }

  return problems;
}

/** A plain page listing configuration problems (names only, no values). */
export function configProblemPage(problems: ConfigProblem[]) {
  const items = problems
    .map((p) => `<li><code>${p.name}</code> ${p.problem}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup problem</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1>Site setup problem</h1>
<p>The site can't start because of these settings (Vercel → Settings → Environments → Production):</p>
<ul>${items}</ul>
<p>After fixing them, redeploy the site.</p>
</body></html>`;
}
