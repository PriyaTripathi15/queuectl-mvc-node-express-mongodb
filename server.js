const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const config = require('./config');
const jobController = require('./controllers/jobController');

const app = express();
app.use(bodyParser.json());

app.post('/enqueue', jobController.enqueue);
app.get('/list', jobController.list);
app.get('/status', jobController.status);
app.get('/dlq', jobController.dlqList);
app.post('/dlq/retry/:id', jobController.dlqRetry);
app.post('/config', jobController.setConfig);

async function start() {
  await mongoose.connect(config.mongodbUri,{autoIndex:true});
  app.listen(config.port, () => console.log(`API listening on ${config.port}`));
}

start().catch(err => { console.error(err); process.exit(1); });
