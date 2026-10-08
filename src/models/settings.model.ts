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
  metaTitle: { type: String, default: 'Indian Mist' },
  metaDescription: { type: String, default: '' },
  heroSettings: {
    subtitle: { type: String, default: 'Summer 2026 Collection' },
    titleLine1: { type: String, default: 'Born from the forest,' },
    titleLine2: { type: String, default: 'made for the wild.' },
    description: { type: String, default: 'Slow-made forest gear, apparel, and everyday eco goods for trails, travel, and the rituals that bring you back outside.' },
    primaryButtonText: { type: String, default: 'Shop the collection →' },
    primaryButtonLink: { type: String, default: '/products' },
    secondaryButtonText: { type: String, default: 'Our story' },
    secondaryButtonLink: { type: String, default: '/about' },
    theme: { type: String, enum: ['forest', 'midnight', 'sunlit'], default: 'forest' },
    ecoBadge: {
      text: { type: String, default: '100%' },
      subtext: { type: String, default: 'Eco materials' },
      isVisible: { type: Boolean, default: true },
    },
  },
  brandStorySettings: {
    subtitle: { type: String, default: 'OUR ROOTS' },
    titleLine1: { type: String, default: 'We make things the forest would ' },
    titleLine2: { type: String, default: 'keep.' },
    description: { type: String, default: 'Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.' },
    tags: { type: String, default: 'Organic cotton, Natural dyes, Zero plastic, Fair trade' },
    buttonText: { type: String, default: 'Read our story' },
    buttonLink: { type: String, default: '/about' },
    imageUrl: { type: String, default: '' },
  },
  trustStripSettings: {
    items: {
      type: [{
        icon: { type: String, default: 'Leaf' },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
      }],
      default: [
        { icon: 'Truck', title: 'Free shipping', subtitle: 'Above ₹999' },
        { icon: 'Leaf', title: '1 tree per order', subtitle: 'Planted with care' },
        { icon: 'Recycle', title: 'Sustainable materials', subtitle: 'Low-impact goods' },
        { icon: 'ShieldCheck', title: 'Easy returns', subtitle: 'Simple exchanges' },
        { icon: 'Award', title: 'Ethically sourced', subtitle: 'Traceable makers' }
      ]
    }
  },
  ecoCommitmentSettings: {
    subtitle: { type: String, default: 'Our commitment' },
    titleLine1: { type: String, default: 'Every order shapes a gentler ' },
    titleLine2: { type: String, default: 'future.' },
    items: {
      type: [{
        icon: { type: String, default: 'TreePine' },
        number: { type: String, default: '' },
        label: { type: String, default: '' },
        description: { type: String, default: '' },
      }],
      default: [
        { icon: 'TreePine', number: '12k+', label: 'Trees planted', description: 'Native saplings funded through every order.' },
        { icon: 'Recycle', number: '100%', label: 'Recycled packaging', description: 'Mailers, tags, and inserts made to be reused.' },
        { icon: 'PackageCheck', number: '0', label: 'Plastic used', description: 'Plastic-free shipping across our core catalog.' },
        { icon: 'HandHeart', number: '1%', label: 'Revenue donated', description: 'Annual giving toward rewilding and maker welfare.' }
      ]
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
  contactPageSettings: {
    title: { type: String, default: 'Contact Us' },
    subtitle: { type: String, default: 'We would love to hear from you. Get in touch with us for any queries.' },
    address: { type: String, default: '123 Forest Lane, Nature Valley, Earth 456789' },
    phone: { type: String, default: '+91 98765 43210' },
    whatsapp: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'hello@indianmist.com' },
    businessHours: { type: String, default: 'Mon-Fri, 9:00 AM - 6:00 PM' },
    faqs: {
      type: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
      default: [],
    },
  }
}, { collection: 'sitesettings', timestamps: true });

export default mongoose.models.SiteSettings ??
  mongoose.model('SiteSettings', SettingsSchema);
