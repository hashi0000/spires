import { request } from 'http';

function get(url) {
  return new Promise((resolve, reject) => {
    request(url, { headers: { Accept: 'text/html' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        location: res.headers.location,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    }).on('error', reject).end();
  });
}

const urls = [
  'http://127.0.0.1:4175/how-airport-pickup-works',
  'http://127.0.0.1:4175/how-airport-pickup-works.html',
  'http://127.0.0.1:61131/how-airport-pickup-works',
  'http://127.0.0.1:56207/how-airport-pickup-works',
];
for (const url of urls) {
  try {
    const r = await get(url);
    console.log(url, r.status, r.location || '', r.body.includes('<h1>How airport pickup works</h1>'), r.body.slice(0, 90).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(url, 'ERR', e.message);
  }
}
