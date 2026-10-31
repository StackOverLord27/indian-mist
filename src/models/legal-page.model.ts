import mongoose from 'mongoose';

const LegalPageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
}, { collection: 'legalpages', timestamps: true });

export default mongoose.models.LegalPage ??
  mongoose.model('LegalPage', LegalPageSchema);
