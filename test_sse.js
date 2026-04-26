const http = require('http');
const data = JSON.stringify({
  subjectCode: 'FLO',
  messages: [{role: 'user', content: 'What is a noun?'}]
});
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat/subject',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let count = 0;
  res.on('data', (chunk) => {
    console.log(chunk.toString());
    count++;
    if (count > 5) process.exit(0);
  });
});
req.on('error', (e) => {
  console.error(e);
  process.exit(1);
});
req.write(data);
req.end();
