import { vi } from "vitest";
import { Writable } from "node:stream";

/** Records every upload/destroy so tests can assert on orphans and ordering. */
export const cloudinaryCalls = {
  uploads: [] as { publicId: string; options: Record<string, unknown>; bytes: number }[],
  destroys: [] as string[],
  /** options passed to each destroy call, in order */
  destroyOptions: [] as Record<string, unknown>[],
  failNextUpload: false,
  failNextDestroy: false,
  /** upload number (1 based) that should fail, e.g. 2 = the second upload */
  failUploadNumber: 0,
  /** destroy calls for these ids throw */
  failDestroyIds: new Set<string>(),
  /** runs at the moment a file is destroyed (lets a test look at the database at that point) */
  onDestroy: null as null | ((publicId: string) => Promise<void> | void),
  uploadCount: 0,
  reset() {
    this.uploads = [];
    this.destroys = [];
    this.destroyOptions = [];
    this.failNextUpload = false;
    this.failNextDestroy = false;
    this.failUploadNumber = 0;
    this.failDestroyIds = new Set();
    this.onDestroy = null;
    this.uploadCount = 0;
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
            cloudinaryCalls.uploadCount++;
            if (cloudinaryCalls.failNextUpload || cloudinaryCalls.failUploadNumber === cloudinaryCalls.uploadCount) {
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
      destroy: vi.fn(async (publicId: string, options?: Record<string, unknown>) => {
        await cloudinaryCalls.onDestroy?.(publicId);
        if (cloudinaryCalls.failNextDestroy || cloudinaryCalls.failDestroyIds.has(publicId)) {
          cloudinaryCalls.failNextDestroy = false;
          throw new Error("mock destroy failure");
        }
        cloudinaryCalls.destroys.push(publicId);
        cloudinaryCalls.destroyOptions.push(options ?? {});
        return { result: "ok" };
      }),
    },
  };
  return { v2, default: { v2 } };
}

/* vi.mock("cloudinary", async () => (await import("./helpers/cloudinary")).cloudinaryModuleMock()); */
