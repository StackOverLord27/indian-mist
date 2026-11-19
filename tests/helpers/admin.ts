import { NextRequest } from "next/server";

export type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Calls an admin route handler directly, as the proxy would after authenticating an admin. */
export function adminCall(
  handler: Handler,
  opts: { method?: string; json?: unknown; form?: FormData; rawBody?: string; contentType?: string; role?: string },
  params: Record<string, string> = {},
) {
  const headers = new Headers({ "x-user-role": opts.role ?? "admin", "x-user-id": "u1", "x-user-email": "a@b.c" });
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers.set("content-type", "application/json");
  } else if (opts.form) {
    body = opts.form;
  } else if (opts.rawBody !== undefined) {
    body = opts.rawBody;
    headers.set("content-type", opts.contentType ?? "application/json");
  }
  const req = new NextRequest("http://localhost/api/test", { method: opts.method ?? "POST", headers, body });
  return handler(req, { params: Promise.resolve(params) });
}

/** A real 1x1 PNG so validateImageFile accepts it */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);
export const pngFile = (name = "photo.png") => new File([PNG_BYTES], name, { type: "image/png" });

export const formOf = (fields: Record<string, string>, files: Record<string, File | File[]> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, v] of Object.entries(files)) for (const f of Array.isArray(v) ? v : [v]) fd.append(k, f);
  return fd;
};
