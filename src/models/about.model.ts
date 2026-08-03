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
    secondaryButtonLabel: { type: String, default: 'Our Story' },
  },
  teamPhoto: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    alt: { type: String, default: '' },
  },
}, { collection: 'aboutpage', timestamps: true });

export default mongoose.models.AboutPage ??
  mongoose.model('AboutPage', AboutSchema);
