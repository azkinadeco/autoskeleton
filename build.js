// Bundles template.html + styles.css + src/*.js into standalone index.html & AutoSkeleton.html
const fs = require("fs");
let html = fs.readFileSync("template.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const files = ["src/utils/defaultKnightData.js","src/utils/aetheriaPresets.js","src/utils/imageProcessing.js","src/engine/fx.js","src/engine/skeleton.js","src/engine/partCutter.js","src/engine/meshSkinning.js","src/engine/renderer.js","src/engine/animations.js","src/engine/exporter.js","src/ui/playtest.js","src/ui/cloud.js","src/ui/videoToSheet.js","src/main.js"];
let js = "(function(){\n\"use strict\";\n";
for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/^\s*import\s+[\s\S]*?from\s+["'].*?["'];?\s*$/gm, "");
  c = c.replace(/^\s*export\s+default\s+/gm, "");
  c = c.replace(/^\s*export\s+(const|let|var|function|async\s+function|class)\s+/gm, "$1 ");
  c = c.replace(/^\s*export\s+\{[\s\S]*?\};?\s*$/gm, "");
  js += "\n// === " + f + " ===\n" + c + "\n";
}
js += "\n})();\n";
new Function(js);
html = html.replace(/<link\s+rel="stylesheet"\s+href="\.\/styles\.css"\s*\/?>/i, () => "<style>\n" + css + "\n</style>");
html = html.replace(/<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/i, () => "<script>\n" + js + "\n</script>");
fs.writeFileSync("AutoSkeleton.html", html);
fs.writeFileSync("index.html", html);
console.log("OK", html.length);
