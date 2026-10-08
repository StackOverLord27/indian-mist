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
      console.warn(`[csp] ${String(directive)} blocked ${String(blocked)} on ${String(page)}`);
    }
  } catch {
    // Reports are best-effort; ignore anything malformed
  }
  return new Response(null, { status: 204 });
}
