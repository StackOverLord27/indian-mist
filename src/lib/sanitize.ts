import sanitizeHtml from "sanitize-html";

// Rich text written in the admin editor is cleaned before it is shown to visitors.
export function sanitizeRichText(html: string | undefined | null): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr", "blockquote", "pre", "code",
      "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
      "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class", "style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\([\d\s,]+\)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  });
}
