import { connect } from 'mongoose';
import { Collection } from './src/models/collection.model';
import { Product } from './src/models/product.model';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  await connect(process.env.MONGODB_URI as string);
  console.log('Connected to DB');

  const products = await Product.find().limit(10);
  if (products.length === 0) {
    console.log('No products found, please create some products first');
    process.exit(1);
  }

  console.log(`Found ${products.length} products`);

  // Create "Sustainable Living" collection
  await Collection.create({
    name: 'Sustainable Living',
    description: 'A curated selection of eco-friendly products for your everyday life.',
    products: products.slice(0, 4).map(p => p._id),
    isActive: true,
  });

  // Create "Forest Explorers" collection
  await Collection.create({
    name: 'Forest Explorers',
    description: 'Everything you need for your next adventure into the wild.',
    products: products.slice(4, 8).map(p => p._id),
    isActive: true,
  });

  // Create "Gifts for Her" collection
  await Collection.create({
    name: 'Gifts for Her',
    description: 'Thoughtful and beautiful gifts she will love.',
    products: products.slice(1, 5).map(p => p._id),
    isActive: true,
  });

  console.log('Collections seeded successfully');
  process.exit(0);
}

seed().catch(console.error);
