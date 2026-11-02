import { vi } from "vitest";
import { Writable } from "node:stream";

/** Records every upload/destroy so tests can assert on orphans and ordering. */
export const cloudinaryCalls = {
  uploads: [] as { publicId: string; options: Record<string, unknown>; bytes: number }[],
  destroys: [] as string[],
  failNextUpload: false,
  failNextDestroy: false,
  reset() {
    this.uploads = [];
    this.destroys = [];
    this.failNextUpload = false;
    this.failNextDestroy = false;
  },
};
let seq = 0;

export function cloudinaryModuleMock() {
  const v2 = {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn((options: Record<string, unknown>, cb: (e: unknown, r?: unknown) => void) => {
        let bytes = 0;
        return new Writable({
          write(chunk, _enc, done) { bytes += chunk.length; done(); },
          final(done) {
            if (cloudinaryCalls.failNextUpload) {
              cloudinaryCalls.failNextUpload = false;
              cb(new Error("mock upload failure"));
            } else {
              const folder = (options.folder as string) ?? "";
              const publicId = (options.public_id as string) ?? `${folder}/mock_${++seq}`;
              cloudinaryCalls.uploads.push({ publicId, options, bytes });
              cb(null, { public_id: publicId, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.jpg` });
            }
            done();
          },
        });
      }),
      destroy: vi.fn(async (publicId: string) => {
        if (cloudinaryCalls.failNextDestroy) {
          cloudinaryCalls.failNextDestroy = false;
          throw new Error("mock destroy failure");
        }
        cloudinaryCalls.destroys.push(publicId);
        return { result: "ok" };
      }),
    },
  };
  return { v2, default: { v2 } };
}

/* vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock()); */
