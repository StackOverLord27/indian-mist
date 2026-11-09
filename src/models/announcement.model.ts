import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 200, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Announcement;
}

export default mongoose.models.Announcement ??
  mongoose.model('Announcement', AnnouncementSchema);
