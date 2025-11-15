const mongoose = require('mongoose');
const { exec } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('./config');
const queue = require('./services/queueService');
const uuid = require('uuid');

const argv = yargs(hideBin(process.argv)).option('count', { type: 'number', default: 1 }).argv;
const WORKER_COUNT = argv.count || 1;
const POLL_MS = parseInt(config.pollMs || '500', 10);

let shuttingDown = false;

async function connect() {
  await mongoose.connect(config.mongodbUri, { autoIndex: true });
  console.log('Connected to MongoDB');
}

async function workerLoop(workerId) {
  console.log(`[worker:${workerId}] started`);

  while (!shuttingDown) {
    try {
      const job = await queue.fetchNextJob(workerId);
      if (!job) {
        await new Promise(r => setTimeout(r, POLL_MS));
        continue;
      }

      const startTs = Date.now();
      console.log(new Date().toISOString(), `[worker:${workerId}] picked job ${job.id} -> ${job.command}`);

      const execPromise = new Promise((resolve) => {
        exec(job.command, { shell: true, windowsHide: true, maxBuffer: 1024*1024 }, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr });
        });
      });

      const { error, stdout, stderr } = await execPromise;
      const durationMs = Date.now() - startTs;

      if (stdout && stdout.trim()) console.log(`[worker:${workerId}] stdout (${job.id}):\n${stdout.trim().slice(0,2000)}`);
      if (stderr && stderr.trim()) console.warn(`[worker:${workerId}] stderr (${job.id}):\n${stderr.trim().slice(0,2000)}`);

      if (!error) {
        console.log(new Date().toISOString(), `[worker:${workerId}] job ${job.id} succeeded in ${durationMs}ms`);
        await queue.markComplete(job);
      } else {
        console.warn(new Date().toISOString(), `[worker:${workerId}] job ${job.id} failed in ${durationMs}ms: ${error && (error.code || error.message)}`);
        await queue.markFailed(job, (error && error.message) || String(error));
      }

    } catch (err) {
      console.error('Worker loop error', err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Worker ${workerId} exiting`);
}

async function start() {
  await connect();
  const workers = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    const wid = `w-${uuid.v4().slice(0,6)}`;
    workers.push(workerLoop(wid));
  }

  process.on('SIGINT', async () => {
    console.log('SIGINT received — shutting down gracefully');
    shuttingDown = true;
    setTimeout(() => process.exit(0), 5000);
  });

  await Promise.all(workers);
}

start().catch(err => { console.error(err); process.exit(1); });
