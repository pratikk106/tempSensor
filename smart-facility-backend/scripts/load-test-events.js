const autocannon = require('autocannon');

const url = process.env.LOAD_TEST_URL || 'http://localhost:3000/events';
const apiKey = process.env.LOAD_TEST_API_KEY || 'secret123';
const duration = Number(process.env.LOAD_TEST_DURATION || 20);
const connections = Number(process.env.LOAD_TEST_CONNECTIONS || 100);

const baseTs = Math.floor(Date.now() / 1000);

const run = autocannon({
  url,
  method: 'POST',
  duration,
  connections,
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  },
  setupClient: (client) => {
    let counter = 0;
    client.setBody = () => {
      counter += 1;
      return JSON.stringify({
        deviceId: `sensor-${counter % 500}`,
        type: 'temperature',
        value: 60 + (counter % 30),
        timestamp: baseTs + counter,
      });
    };
  },
});

autocannon.track(run, { renderProgressBar: true });
