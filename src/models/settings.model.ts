import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  storeName: { type: String, default: 'Indian Mist' },
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
}, { collection: 'sitesettings', timestamps: true });

export default mongoose.models.SiteSettings ??
  mongoose.model('SiteSettings', SettingsSchema);
