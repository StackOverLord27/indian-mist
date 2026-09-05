import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 200, trim: true },
  link: { type: String, default: '', trim: true },
  linkText: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  // order: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.Announcement ??
  mongoose.model('Announcement', AnnouncementSchema);
