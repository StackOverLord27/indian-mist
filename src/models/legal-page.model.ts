import mongoose from 'mongoose';

const LegalPageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
}, { collection: 'legalpages', timestamps: true });

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.LegalPage;
}

export default mongoose.models.LegalPage ??
  mongoose.model('LegalPage', LegalPageSchema);
