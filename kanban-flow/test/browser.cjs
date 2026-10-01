const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { randomUUID } = require("node:crypto");
exports.load = function (symbols) {
  const root = path.resolve(__dirname, "..");
  const dom = new JSDOM(
    fs.readFileSync(path.join(root, "index.html"), "utf8"),
    { url: "http://localhost", runScripts: "outside-only" },
  );
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: randomUUID });
  dom.window.eval(
    fs.readFileSync(path.join(root, "app.js"), "utf8") +
      "\nwindow.lesson = {" +
      symbols +
      "};",
  );
  return dom;
};
