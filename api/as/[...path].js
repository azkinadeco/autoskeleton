const https = require('https');

module.exports = (req, res) => {
  const pathAfter = (req.url || '').replace(/^\/api\/as/, '') || '/';
  const target = new URL('https://www.autosprite.io/api/v1' + pathAfter);
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
