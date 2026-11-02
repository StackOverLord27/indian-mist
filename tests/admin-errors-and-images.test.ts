import { describe, expect, it } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { getApiErrorMessage } from "@/lib/admin-error";
import { SafeImage } from "@/components/ui/SafeImage";

const axiosError = (data: unknown, status = 400) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, { status, data } as AxiosResponse);

describe("getApiErrorMessage shows what the admin routes send", () => {
  it("message only", () => {
    expect(getApiErrorMessage(axiosError({ message: "Product not found" }))).toBe("Product not found");
  });

  it("validation errors: message plus the first field problem", () => {
    expect(getApiErrorMessage(axiosError({ message: "Validation failed", errors: { price: "Price must be a positive number", name: "Name is required" } })))
      .toBe("Validation failed: Price must be a positive number");
  });

  it("the older { error } shape and plain errors still work", () => {
    expect(getApiErrorMessage(axiosError({ error: "Too many requests" }, 429))).toBe("Too many requests");
    expect(getApiErrorMessage(new Error("boom"))).toBe("boom");
    expect(getApiErrorMessage("weird", "fallback")).toBe("fallback");
  });
});

describe("SafeImage", () => {
  it("shows the neutral placeholder (same box) when there is no image address", () => {
    const html = renderToStaticMarkup(createElement(SafeImage, { src: "", alt: "Olive Tee" }));
    expect(html).toContain("IM");
    expect(html).toContain('aria-label="Olive Tee"');
    expect(html).not.toContain("<img");
  });

  it("renders the image when there is an address", () => {
    const html = renderToStaticMarkup(createElement(SafeImage, { src: "https://res.cloudinary.com/x/y.jpg", alt: "Olive Tee" }));
    expect(html).toContain("<img");
  });

  it("uses a custom fallback when given", () => {
    const html = renderToStaticMarkup(createElement(SafeImage, { src: null, alt: "x", fallback: createElement("span", null, "no photo") }));
    expect(html).toContain("no photo");
  });
});
