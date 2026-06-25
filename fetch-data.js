// Fetch data from bi.yjhotel.xyz and save as data.json
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const SOURCE_URL = 'https://bi.yjhotel.xyz/dashboard.html';
const TIMEOUT = 30000;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT);
    https.get(url, { headers: { 'Accept-Encoding': 'gzip, deflate' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        fetchUrl(res.headers.location).then(resolve, reject);
        return;
      }
      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      let body = '';
      const s = enc ? stream : res;
      if (enc) {
        stream.on('data', c => body += c);
        stream.on('end', () => { clearTimeout(timer); resolve(body); });
      } else {
        res.on('data', c => body += c);
        res.on('end', () => { clearTimeout(timer); resolve(body); });
      }
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

async function main() {
  console.log('Fetching from', SOURCE_URL);
  const html = await fetchUrl(SOURCE_URL);
  console.log('Got HTML, length:', html.length);

  const m = html.match(/var\s+D\s*=\s*(\{[\s\S]*?\});?\s*$/m);
  if (!m) throw new Error('Cannot find var D in HTML');

  const data = JSON.parse(m[1]);
  data._snapshotSource = 'bi.yjhotel.xyz';
  data._snapshotTime = new Date().toISOString().replace('T',' ').substring(0,19);

  const json = JSON.stringify(data, null, 0);
  fs.writeFileSync('data.json', json);
  console.log('Saved data.json, collectTime:', data.collectTime, 'size:', (json.length/1024).toFixed(0) + 'KB');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
