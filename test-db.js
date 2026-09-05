const mongoose = require('mongoose');
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection failed:");
    console.error(err);
    process.exit(1);
  });
