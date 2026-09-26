import { connect } from 'mongoose';
import { Collection } from './src/models/collection.model';
import { Product } from './src/models/product.model';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  await connect(process.env.MONGODB_URI as string);
  console.log('Connected to DB');

  let products = await Product.find().limit(10);
  if (products.length === 0) {
    console.log('Creating mock products...');
    const newProducts = [
      {
        name: 'Organic Field Tee',
        slug: 'organic-field-tee',
        description: 'Organic cotton outdoor shirt',
        category: 'Apparel',
        price: 899,
        stockQuantity: 10,
        images: [{ url: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1000&auto=format&fit=crop', publicId: 'mock1', isPrimary: true }],
      },
      {
        name: 'Trailpack Canvas 22L',
        slug: 'trailpack-canvas',
        description: 'Canvas backpack for forest trails',
        category: 'Forest gear',
        price: 2499,
        stockQuantity: 5,
        badge: 'New',
        images: [{ url: 'https://images.unsplash.com/photo-1622260614153-03223fb72052?q=80&w=1000&auto=format&fit=crop', publicId: 'mock2', isPrimary: true }],
      },
      {
        name: 'Copper Leaf Pin Set',
        slug: 'copper-leaf-pin',
        description: 'Copper leaf pins on a natural surface',
        category: 'Pins',
        price: 349,
        stockQuantity: 50,
        images: [{ url: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1000&auto=format&fit=crop', publicId: 'mock3', isPrimary: true }],
      },
      {
        name: 'Recycled Trail Journal',
        slug: 'recycled-journal',
        description: 'Recycled paper journal for trail notes',
        category: 'Stationery',
        price: 599,
        stockQuantity: 20,
        images: [{ url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1000&auto=format&fit=crop', publicId: 'mock4', isPrimary: true }],
      },
      {
        name: 'Mist Shell Jacket',
        slug: 'mist-shell-jacket',
        description: 'A light recycled shell made for sudden rain and humid forest walks.',
        category: 'Apparel',
        price: 3299,
        stockQuantity: 15,
        images: [{ url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=1200&auto=format&fit=crop', publicId: 'mock5', isPrimary: true }],
      },
      {
        name: 'Rootline Daypack',
        slug: 'rootline-daypack',
        description: 'Compact storage, plant-dyed canvas, and hardware built to repair.',
        category: 'Forest gear',
        price: 2799,
        stockQuantity: 8,
        images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1200&auto=format&fit=crop', publicId: 'mock6', isPrimary: true }],
      }
    ];
    await Product.collection.insertMany(newProducts);
    products = await Product.find().limit(10);
  }

  console.log(`Found ${products.length} products`);

  // Clear existing collections to prevent duplicates
  await Collection.deleteMany({});

  // Create "Sustainable Living" collection
  await Collection.create({
    name: 'Sustainable Living',
    description: 'A curated selection of eco-friendly products for your everyday life.',
    products: products.slice(0, 3).map(p => p._id),
    isActive: true,
  });

  // Create "Forest Explorers" collection
  await Collection.create({
    name: 'Forest Explorers',
    description: 'Everything you need for your next adventure into the wild.',
    products: products.slice(2, 6).map(p => p._id),
    isActive: true,
  });

  console.log('Collections seeded successfully');
  process.exit(0);
}

seed().catch(console.error);
