#!/usr/bin/env node
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const argv = yargs(hideBin(process.argv))
  .scriptName("queuectl")
  .command(
    'enqueue <jobInput>',
    'Add a new job to the queue',
    () => {},
    async (args) => {
      try {
        let jobs = [];

        // Read JSON file or parse string
        if (args.jobInput.endsWith('.json') && fs.existsSync(args.jobInput)) {
          const fileContent = fs.readFileSync(args.jobInput, 'utf-8');
          const parsed = JSON.parse(fileContent);
          jobs = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          jobs = [JSON.parse(args.jobInput)];
        }

        // Add default fields
        jobs = jobs.map(job => ({
          id: job.id || `job-${uuidv4()}`,
          command: job.command,
          state: 'pending',
          attempts: 0,
          max_retries: job.max_retries || 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const res = await axios.post(`http://localhost:${config.port}/enqueue`, jobs);
        console.log('Job(s) enqueued successfully:');
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error('Error:', err.response?.data || err.message);
      }
    }
  )
  .command(
    'worker start',
    'Start one or more workers',
    (y) => y.option('count', { type: 'number', default: 1 }),
    (args) => {
      spawn('node', ['worker.js', '--count', String(args.count)], { stdio: 'inherit' });
    }
  )
  .command(
    'worker stop',
    'Stop running workers gracefully',
    {},
    async () => {
      console.log("Stopping workers: send SIGINT to worker processes manually or implement stop API.");
    }
  )
  .command(
    'status',
    'Show summary of all job states & active workers',
    {},
    async () => {
      try {
        const res = await axios.get(`http://localhost:${config.port}/status`);
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.message);
      }
    }
  )
  .command(
    'list',
    'List jobs by state',
    (y) => y.option('state', { type: 'string', demandOption: true }),
    async (args) => {
      try {
        const res = await axios.get(`http://localhost:${config.port}/list?state=${args.state}`);
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.message);
      }
    }
  )
 .command(
  'dlq <action> [id]',
  'Dead Letter Queue commands',
  (y) => {
    y.positional('action', {
      describe: 'Action to perform: list or retry',
      type: 'string',
    })
    .positional('id', {
      describe: 'Job ID for retry (required if action is retry)',
      type: 'string',
    });
  },
  async (args) => {
    try {
      if (args.action === 'list') {
        const res = await axios.get(`http://localhost:${config.port}/dlq`);
        console.log(JSON.stringify(res.data, null, 2));
      } else if (args.action === 'retry') {
        if (!args.id) return console.error('Job ID is required for retry');
        const res = await axios.post(`http://localhost:${config.port}/dlq/retry/${args.id}`);
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error('Unknown DLQ action. Use "list" or "retry <id>"');
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }
)

  .command(
    'config set',
    'Set queue configuration',
    (y) => y.option('retryBase', { type: 'number' }).option('defaultMaxRetries', { type: 'number' }),
    async (args) => {
      try {
        const res = await axios.post(`http://localhost:${config.port}/config`, args);
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.response?.data || err.message);
      }
    }
  )
  .demandCommand()
  .help()
  .argv;
