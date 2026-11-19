import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { setupTestDb } from "./helpers/mongo";
import { adminCall } from "./helpers/admin";

// Like cold-instance-profile.test.ts: this file must not import the Product model itself (and no
// other route that does), because a real server instance only knows the models its routes import.
import * as collectionById from "@/app/api/admin/collections/[id]/route";

setupTestDb();

const col = (name: string) => mongoose.connection.db!.collection(name);
const oid = () => new mongoose.Types.ObjectId();

describe("the admin collection route on a cold instance (it populates products)", () => {
  it("answers 200 with its products (it used to answer 500)", async () => {
    const productId = oid();
    await col("products").insertOne({ _id: productId, name: "Cap", slug: "cap", category: "x", images: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }] });
    const _id = oid();
    await col("collections").insertOne({ _id, name: "Summer", slug: "summer", products: [productId], isActive: true });
    const res = await adminCall(collectionById.GET, { method: "GET" }, { id: String(_id) });
    expect(res.status).toBe(200);
    const product = (await res.json()).collection.products[0];
    expect(product).toMatchObject({ name: "Cap" });
    expect(product.images).toHaveLength(1);
  });
});
