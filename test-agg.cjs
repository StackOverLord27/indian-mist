/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Product = mongoose.models.Product || mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  try {
    const result = await Product.aggregate([
      { $match: {} },
      {
        $facet: {
          data: [{ $sort: { createdAt: -1 } }, { $skip: 0 }, { $limit: 12 }],
          totalCount: [{ $count: "count" }],
          categories: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
          badges: [{ $group: { _id: "$badge", count: { $sum: 1 } } }]
        }
      }
    ]);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("AGG ERROR", err);
  }
  process.exit();
});
