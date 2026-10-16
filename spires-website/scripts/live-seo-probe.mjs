#!/usr/bin/env node
import http from 'http';
import https from 'https';

const urls = [
  'https://www.spires-taxis.com/',
  'https://www.spires-taxis.com/oxford-taxis',
  'https://www.spires-taxis.com/airport-taxis-oxford',
  'https://www.spires-taxis.com/airport-transfers',
  'https://www.spires-taxis.com/heathrow-to-oxford-taxi',
  'https://www.spires-taxis.com/oxford-to-heathrow-taxi',
  'https://www.spires-taxis.com/oxford-to-luton-taxi',
  'https://www.spires-taxis.com/bicester-taxis',
  'https://www.spires-taxis.com/corporate-taxis',
  'https://www.spires-taxis.com/student-taxis',
  'https://www.spires-taxis.com/reviews',
  'https://www.spires-taxis.com/share',
  'https://www.spires-taxis.com/long-distance-taxis',
  'https://www.spires-taxis.com/robots.txt',
  'https://www.spires-taxis.com/sitemap.xml',
  'https://spires-taxis.com/',
  'http://spires-taxis.com/',
  'https://www.spires-taxis.com/index.html',
  'https://www.spires-taxis.com/services',
  'https://www.spires-taxis.com/booking',
  'https://www.spires-taxis.com/terms-and-conditions',
  'https://www.spires-taxis.com/oxford-to-stansted-taxi',
  'https://www.spires-taxis.com/share/heathrow-terminal-transfer',
  'https://www.spires-taxis.com/share.html',
  'https://www.spires-taxis.com/destinations',
  'https://www.spires-taxis.com/our-vehicles',
  'https://www.spires-taxis.com/rates',
];

function get(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          if (body.length < 100000) body += c;
        });
        res.on('end', () => {
          const loc = res.headers.location || '';
          const xr = res.headers['x-robots-tag'] || '';
          const robots = (body.match(/name="robots" content="([^"]+)"/i) || [])[1] || '';
          const canon = (body.match(/rel="canonical" href="([^"]+)"/i) || [])[1] || '';
          const title = ((body.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').slice(0, 80);
          resolve({
            url,
            status: res.statusCode,
            loc,
            xr,
            robots,
            canon,
            title,
          });
        });
      }
    );
    req.on('error', (e) => resolve({ url, error: e.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ url, error: 'timeout' });
    });
    req.end();
  });
}

for (const url of urls) {
  const row = await get(url);
  if (row.error) {
    console.log(`ERR ${row.url} ${row.error}`);
    continue;
  }
  console.log(
    `${row.status} xr=${row.xr} loc=${row.loc} robots=${row.robots} canon=${row.canon} title=${row.title} :: ${row.url}`
  );
}
