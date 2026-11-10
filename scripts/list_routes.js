const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');
const routes = [];
lines.forEach((l, i) => {
  const m = l.match(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
  if (m) {
    routes.push({ line: i + 1, method: m[1].toUpperCase(), path: m[2] });
  }
});
console.log('Total routes found: ' + routes.length);
routes.forEach(r => console.log(String(r.line).padStart(5) + ': ' + r.method.padEnd(6) + ' ' + r.path));
