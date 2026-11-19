import mongoose from 'mongoose';

const CarouselSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  alt: { type: String, default: '', trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Carousel;
}

export default mongoose.models.Carousel ??
  mongoose.model('Carousel', CarouselSchema);
