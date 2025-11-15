#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const config = require('./config');

const argv = yargs(hideBin(process.argv))
  .command(
    'enqueue <jobInput>',
    'Enqueue job(s) (JSON string or path to JSON file)',
    () => {},
    async (args) => {
      try {
        let jobs = [];

        // Check if input is a JSON file
        if (args.jobInput.endsWith('.json') && fs.existsSync(args.jobInput)) {
          const fileContent = fs.readFileSync(args.jobInput, 'utf-8');
          const parsed = JSON.parse(fileContent);
          jobs = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          // Otherwise parse JSON string
          jobs = [JSON.parse(args.jobInput)];
        }

        // Send jobs to API
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
    'Start worker(s)',
    (y) => y.option('count', { type: 'number', default: 1 }),
    (args) => {
      const count = args.count || 1;
      spawn('node', ['worker.js', '--count', String(count)], { stdio: 'inherit' });
    }
  )
  .command(
    'status',
    'Show status',
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
    (y) => y.option('state', { type: 'string', default: 'pending' }),
    async (args) => {
      try {
        const res = await axios.get(`http://localhost:${config.port}/jobs?state=${args.state}`);
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.message);
      }
    }
  )
  .command(
    'dlq list',
    'List DLQ jobs',
    {},
    async () => {
      try {
        const res = await axios.get(`http://localhost:${config.port}/dlq`);
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.message);
      }
    }
  )
  .command(
    'dlq retry <id>',
    'Retry a DLQ job by ID',
    () => {},
    async (args) => {
      try {
        const res = await axios.post(`http://localhost:${config.port}/dlq/retry/${args.id}`);
        console.log('DLQ job retried:');
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.response?.data || err.message);
      }
    }
  )
  .command(
    'config set',
    'Set config (retryBase, defaultMaxRetries)',
    (y) => y.option('retryBase', { type: 'number' }).option('defaultMaxRetries', { type: 'number' }),
    async (args) => {
      try {
        const res = await axios.post(`http://localhost:${config.port}/config`, args);
        console.log('Config updated:');
        console.log(JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error(err.response?.data || err.message);
      }
    }
  )
  .help()
  .argv;
