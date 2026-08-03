import mongoose from 'mongoose';

const CarouselSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  alt: { type: String, default: '', trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Carousel ??
  mongoose.model('Carousel', CarouselSchema);
