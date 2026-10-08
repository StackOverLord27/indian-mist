import mongoose from 'mongoose';

const ImageSchema = {
  url: { type: String, default: '' },
  publicId: { type: String, default: '' },
  alt: { type: String, default: '' },
};

const AboutSchema = new mongoose.Schema({
  hero: {
    eyebrow: { type: String, default: '' },
    headline: { type: String, default: '' },
    lead: { type: String, default: '' },
  },
  story: {
    eyebrow: { type: String, default: '' },
    heading: { type: String, default: '' },
    body: { type: String, default: '' },
    image: ImageSchema,
  },
  gallery: {
    isVisible: { type: Boolean, default: true },
    eyebrow: { type: String, default: '' },
    heading: { type: String, default: '' },
    linkLabel: { type: String, default: '' },
    linkHref: { type: String, default: '' },
    images: [ImageSchema],
  },
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

// In development the compiled model stays cached between code reloads, so a changed schema
// would be ignored and new fields silently dropped on save. Rebuild it when not in production.
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.AboutPage;
}

export default mongoose.models.AboutPage ??
  mongoose.model('AboutPage', AboutSchema);
