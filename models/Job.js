const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  command: { type: String, required: true },
  state: { type: String, enum: ['pending','processing','completed','failed','dead'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  max_retries: { type: Number, default: 3 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  available_at: { type: Date, default: Date.now },
  last_error: { type: String },
  worker: { type: String }
});

JobSchema.index({ state: 1, available_at: 1 });

module.exports = mongoose.model('Job', JobSchema);
