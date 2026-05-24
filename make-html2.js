#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "standalone.css"), "utf8");
const js  = fs.readFileSync(path.join(__dirname, "standalone-bundle.js"), "utf8");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Struct Solver Pro</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>${js}</script>
</body>
</html>`;

const out = path.join(__dirname, "rigidez-lab.html");
fs.writeFileSync(out, html, "utf8");
console.log("Written:", out, Math.round(fs.statSync(out).size / 1024) + " KB");
