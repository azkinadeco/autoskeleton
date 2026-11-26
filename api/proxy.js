const https = require('https');

module.exports = (req, res) => {
  const urlObj = new URL(req.url, 'http://localhost');
  const rawPath = urlObj.searchParams.get('path') || '';
  const cleanPath = '/' + rawPath.replace(/^\/+/, '');
  urlObj.searchParams.delete('path');
  const qs = urlObj.searchParams.toString();
  const target = new URL('https://www.autosprite.io/api/v1' + cleanPath + (qs ? '?' + qs : ''));

  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;

  const up = https.request(target, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  req.pipe(up);
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
