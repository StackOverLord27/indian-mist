/** Text safety helpers for everything that ends up in an e-mail. No dependencies. */

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Control characters (CR, LF, NUL, tab...), DEL and the Unicode line/paragraph separators have no
// place in a header value or a name.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
// Same, but a line break is kept (the message body).
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]+/g;

/** Cut to `max` characters, counting an emoji as one (never splits a surrogate pair). */
export const truncate = (value: string, max: number) => {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("");
};

/** One-line text for a header or a name: control characters become a space, length capped. */
export const singleLine = (value: string, max: number) => truncate(value.replace(CONTROL_CHARS, " ").trim(), max);

/** A multi-line body: line breaks normalised, other control characters removed, length capped. */
export const bodyText = (value: string, max: number) =>
  truncate(value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_KEEP_NEWLINE, " "), max);

/** A plain address only: no whitespace, control characters, quotes, commas or angle brackets. */
export const SAFE_ADDRESS = /^[^\s\u0000-\u001f\u007f<>",;()\\]+@[^\s\u0000-\u001f\u007f<>",;()\\]+$/;

export const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1);
