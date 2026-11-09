import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  tagline: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    youtube: { type: String, default: '' },
  },
  footerNote: { type: String, default: '' },
  sizeChart: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
  },
  // No invented content in here. Every text below starts EMPTY: the storefront shows only what
  // the admin has typed, and a section with nothing in it is not shown. (Defaults used to be
  // written into the database by the first settings save; see docs/work-log.md.)
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  heroSettings: {
    subtitle: { type: String, default: '' },
    titleLine1: { type: String, default: '' },
    titleLine2: { type: String, default: '' },
    description: { type: String, default: '' },
    primaryButtonText: { type: String, default: '' },
    primaryButtonLink: { type: String, default: '' },
    secondaryButtonText: { type: String, default: '' },
    secondaryButtonLink: { type: String, default: '' },
    theme: { type: String, enum: ['forest', 'midnight', 'sunlit'], default: 'forest' },
    ecoBadge: {
      text: { type: String, default: '' },
      subtext: { type: String, default: '' },
      isVisible: { type: Boolean, default: true },
    },
  },
  brandStorySettings: {
    subtitle: { type: String, default: '' },
    titleLine1: { type: String, default: '' },
    titleLine2: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: { type: String, default: '' },
    buttonText: { type: String, default: '' },
    buttonLink: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    // Cloudinary id of the image, so replacing it can delete the old file. Missing on old documents.
    imagePublicId: { type: String, default: '' },
  },
  trustStripSettings: {
    items: {
      type: [{
        icon: { type: String, default: 'Leaf' },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
      }],
      default: [],
    }
  },
  ecoCommitmentSettings: {
    subtitle: { type: String, default: '' },
    titleLine1: { type: String, default: '' },
    titleLine2: { type: String, default: '' },
    items: {
      type: [{
        icon: { type: String, default: 'TreePine' },
        number: { type: String, default: '' },
        label: { type: String, default: '' },
        description: { type: String, default: '' },
      }],
      default: [],
    }
  },
  pricingSettings: {
    shippingCost: { type: Number, default: 99 },
    freeShippingThreshold: { type: Number, default: 999 },
    gstRate: { type: Number, default: 0 },
    showPricesInclusiveOfGst: { type: Boolean, default: false },
    promoCodes: {
      type: [{
        code: { type: String, required: true },
        discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
        discountValue: { type: Number, required: true },
        isActive: { type: Boolean, default: true },
        minOrderValue: { type: Number, default: 0 },
        maxUses: { type: Number, default: 0 },          // 0 = unlimited
        maxUsesPerUser: { type: Number, default: 1 },    // default 1 use per user
        description: { type: String, default: '' },
        expiresAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
      }],
      default: []
    },
  },
  // Header of the /blogs page. Deliberately NO defaults: "never saved" (a missing field) shows the
  // wording kept in src/lib/blog-page-header.ts, "saved empty" hides the line, and an upsert made
  // by another page's save must not turn the first into the second.
  blogPageSettings: {
    eyebrow: { type: String },
    heading: { type: String },
    subtitle: { type: String },
  },
  contactPageSettings: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    businessHours: { type: String, default: '' },
    faqs: {
      type: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
      default: [],
    },
  }
}, { collection: 'sitesettings', timestamps: true });

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.SiteSettings;
}

export default mongoose.models.SiteSettings ??
  mongoose.model('SiteSettings', SettingsSchema);
