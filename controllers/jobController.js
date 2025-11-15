// controllers/jobController.js
const queue = require('../services/queueService');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Enqueue one or multiple jobs
 * Accepts either single job object or array of jobs in req.body
 */
async function enqueue(req, res) {
  try {
    let jobs = req.body;

    // Ensure array of jobs
    if (!Array.isArray(jobs)) jobs = [jobs];

    const processedJobs = [];

    for (let body of jobs) {
      if (!body.command) {
        return res.status(400).json({ error: 'command required for each job' });
      }

      const jobObj = {
        id: body.id || `job-${uuidv4()}`,
        command: body.command,
        state: 'pending',
        attempts: 0,
        max_retries: body.max_retries || config.defaultMaxRetries,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const job = await queue.enqueue(jobObj);
      processedJobs.push(job);
    }

    return res.json({ ok: true, jobs: processedJobs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * List jobs by state
 */
async function list(req, res) {
  try {
    const state = req.query.state; // optional
    const jobs = await queue.listByState(state);
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Show queue stats
 */
async function status(req, res) {
  try {
    const stats = await queue.stats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * List DLQ jobs
 */
async function dlqList(req, res) {
  try {
    const jobs = await queue.listByState('dead');
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Retry a DLQ job
 */
async function dlqRetry(req, res) {
  try {
    const id = req.params.id;
    const job = await queue.retryDead(id);
    res.json({ ok: true, job });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Set configuration like retryBase and defaultMaxRetries
 */
async function setConfig(req, res) {
  try {
    const { retryBase, defaultMaxRetries } = req.body;
    if (retryBase) process.env.RETRY_BASE = String(retryBase);
    if (defaultMaxRetries) process.env.DEFAULT_MAX_RETRIES = String(defaultMaxRetries);
    res.json({ ok: true, retryBase: process.env.RETRY_BASE, defaultMaxRetries: process.env.DEFAULT_MAX_RETRIES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  enqueue,
  list,
  status,
  dlqList,
  dlqRetry,
  setConfig,
};
