const Job = require('../models/Job');
const config = require('../config');

function backoffDelay(attempts) {
  const base = config.retryBase || 2;
  return Math.pow(base, attempts) * 1000;
}

async function enqueue(jobObj) {
  const job = new Job({
    id: jobObj.id,
    command: jobObj.command,
    max_retries: jobObj.max_retries || config.defaultMaxRetries,
    state: jobObj.state || 'pending',
    available_at: jobObj.available_at ? new Date(jobObj.available_at) : new Date()
  });
  await job.save();
  return job;
}

async function fetchNextJob(workerId) {
  const now = new Date();
  const job = await Job.findOneAndUpdate(
    { state: 'pending', available_at: { $lte: now } },
    { $set: { state: 'processing', worker: workerId, updated_at: now } },
    { sort: { created_at: 1 }, returnDocument: 'after' }
  );
  return job;
}

async function markComplete(job) {
  job.state = 'completed';
  job.updated_at = new Date();
  job.worker = undefined;
  await job.save();
}

async function markFailed(job, errMsg) {
  job.attempts = (job.attempts || 0) + 1;
  job.last_error = String(errMsg).slice(0, 1000);
  job.updated_at = new Date();
  job.worker = undefined;

  if (job.attempts > job.max_retries) {
    job.state = 'dead';
  } else {
    const delayMs = backoffDelay(job.attempts);
    job.available_at = new Date(Date.now() + delayMs);
    job.state = 'pending';
  }
  await job.save();
}

async function retryDead(jobId) {
  const job = await Job.findOne({ id: jobId });
  if (!job) throw new Error('Job not found');
  if (job.state !== 'dead') throw new Error('Job is not in DLQ');
  job.state = 'pending';
  job.attempts = 0;
  job.available_at = new Date();
  job.updated_at = new Date();
  await job.save();
  return job;
}

async function listByState(state) {
  return Job.find(state ? { state } : {}).sort({ created_at: -1 }).limit(100).lean();
}

async function stats() {
  const agg = await Job.aggregate([{ $group: { _id: '$state', count: { $sum: 1 } } }]);
  const result = {};
  agg.forEach(r => (result[r._id] = r.count));
  return result;
}

module.exports = { enqueue, fetchNextJob, markComplete, markFailed, retryDead, listByState, stats };
