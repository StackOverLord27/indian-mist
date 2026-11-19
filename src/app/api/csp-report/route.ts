// Anyone can post here, so what is written to the log is cut short and has no line breaks or
// other control characters (which could forge extra log lines).
const clean = (value: unknown) => String(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);

// Browsers send a short report here whenever the content security policy blocks (or would block) something.
export async function POST(req: Request) {
  try {
    const text = (await req.text()).slice(0, 4000);
    const report = JSON.parse(text);
    const entries: Record<string, unknown>[] = Array.isArray(report)
      ? report.map((r) => r?.body ?? r)
      : [report["csp-report"] ?? report];

    for (const e of entries.slice(0, 5)) {
      const blocked = e["blocked-uri"] ?? e.blockedURL ?? e["blockedURL"];
      const directive = e["violated-directive"] ?? e.effectiveDirective ?? e["effective-directive"];
      const page = e["document-uri"] ?? e.documentURL;
      console.warn(`[csp] ${clean(directive)} blocked ${clean(blocked)} on ${clean(page)}`);
    }
  } catch {
    // Reports are best-effort; ignore anything malformed
  }
  return new Response(null, { status: 204 });
}
