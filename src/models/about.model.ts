import mongoose from 'mongoose';

const AboutSchema = new mongoose.Schema({
  mission: {
    heading: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  drivesUs: {
    heading: { type: String, default: '' },
    cards: [{
      icon: { type: String, default: 'Leaf' },
      title: { type: String, default: '' },
      body: { type: String, default: '' },
    }],
  },
  cta: {
    heading: { type: String, default: '' },
    subtext: { type: String, default: '' },
    primaryButtonLabel: { type: String, default: 'Shop Now' },
    primaryButtonLink: { type: String, default: '/products' },
    secondaryButtonLabel: { type: String, default: 'Our Story' },
    secondaryButtonLink: { type: String, default: '/about' },
  },
  teamPhoto: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    alt: { type: String, default: '' },
  },
  customSections: [{
    type: { type: String, enum: ['image-text-split'], default: 'image-text-split' },
    heading: { type: String, default: '' },
    body: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
    imageAlignment: { type: String, enum: ['left', 'right'], default: 'left' },
    order: { type: Number, default: 0 }
  }],
}, { collection: 'aboutpage', timestamps: true });

export default mongoose.models.AboutPage ??
  mongoose.model('AboutPage', AboutSchema);
