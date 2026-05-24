#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
const html_in = path.join(OUT, "index.html");
const html_out = path.join(__dirname, "rigidez-lab.html");

let html = fs.readFileSync(html_in, "utf8");

// Collect every JS and CSS file under out/_next/static/
function readAllStatic() {
  const map = {};
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        // key: URL path relative to out/
        const rel = "/" + path.relative(OUT, full).replace(/\\/g, "/");
        map[rel] = full;
      }
    }
  }
  walk(path.join(OUT, "_next/static"));
  return map;
}

const staticFiles = readAllStatic();

// Replace <link rel="stylesheet" href="..."> with <style>...</style>
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*\/?>/g, (match, href) => {
  const key = href.startsWith("/") ? href : "/" + href;
  if (staticFiles[key]) {
    const css = fs.readFileSync(staticFiles[key], "utf8");
    return `<style>${css}</style>`;
  }
  return match;
});

// Replace <script src="..."> with inline <script>...</script>
html = html.replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (match, pre, src, post) => {
  const key = src.startsWith("/") ? src : "/" + src;
  if (staticFiles[key]) {
    const js = fs.readFileSync(staticFiles[key], "utf8");
    // Remove type="module" or crossOrigin etc to avoid CORS issues in file://
    const attrs = (pre + post).replace(/\s*(type="module"|crossorigin|crossOrigin|defer|async)\s*/gi, " ").trim();
    return `<script ${attrs}>${js}</script>`;
  }
  return match;
});

// Also inline any remaining _next/static files referenced as string literals in the JS
// The Turbopack runtime often fetches _buildManifest.js, _ssgManifest.js dynamically.
// We inject a small shim that intercepts fetch/XHR for those files.

const buildHash = Object.keys(staticFiles)
  .map(k => k.match(/_next\/static\/([^/]+)\/_buildManifest\.js/))
  .find(Boolean)?.[1];

if (buildHash) {
  const manifestFiles = {};
  for (const [rel, full] of Object.entries(staticFiles)) {
    if (rel.includes(`/${buildHash}/`)) {
      manifestFiles[rel] = fs.readFileSync(full, "utf8");
    }
  }

  const shimScript = `<script>
(function(){
  var _files = ${JSON.stringify(manifestFiles)};
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    var key = typeof url === 'string' ? url : (url && url.url) || '';
    // strip query string
    var k = key.split('?')[0];
    if (_files[k]) {
      return Promise.resolve(new Response(_files[k], {status:200,headers:{'Content-Type':'application/javascript'}}));
    }
    return _origFetch.apply(this, arguments);
  };
  var _XHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var k = (url || '').split('?')[0];
    if (_files[k]) {
      this._inlineData = _files[k];
    }
    return _XHR.apply(this, arguments);
  };
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._inlineData) {
      var self = this;
      var data = this._inlineData;
      setTimeout(function() {
        Object.defineProperty(self, 'status', {value: 200});
        Object.defineProperty(self, 'readyState', {value: 4});
        Object.defineProperty(self, 'responseText', {value: data});
        Object.defineProperty(self, 'response', {value: data});
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      }, 0);
      return;
    }
    return _send.apply(this, arguments);
  };
})();
</script>`;

  html = html.replace("<head>", "<head>" + shimScript);
}

fs.writeFileSync(html_out, html, "utf8");
console.log("Written:", html_out, Math.round(fs.statSync(html_out).size / 1024) + " KB");
