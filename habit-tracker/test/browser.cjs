const { JSDOM } = require("jsdom");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
exports.openApp = async function openApp(saved = {}) {
  const root = resolve(__dirname, "..");
  const dom = new JSDOM(readFileSync(resolve(root, "index.html"), "utf8"), {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  const w = dom.window;
  await new Promise(setImmediate);
  w.crypto.randomUUID = randomUUID;
  w.structuredClone = structuredClone;
  if (w.HTMLDialogElement) {
    w.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  }
  let now = 1000000;
  let nextId = 0;
  const intervals = new Map();
  w.Date.now = () => now;
  w.setInterval = (fn) => {
    intervals.set(++nextId, fn);
    return nextId;
  };
  w.clearInterval = (id) => intervals.delete(id);
  for (const [key, value] of Object.entries(saved))
    w.localStorage.setItem(key, value);
  const evaluate = (code) => vm.runInContext(code, dom.getInternalVMContext());
  evaluate(readFileSync(resolve(root, "app.js"), "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  return {
    w,
    document: w.document,
    evaluate,
    intervals,
    advance(ms) {
      now += ms;
    },
    event(selector, type) {
      w.document
        .querySelector(selector)
        .dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true }));
    },
    snapshot() {
      return Object.fromEntries(
        Object.keys(w.localStorage).map((key) => [
          key,
          w.localStorage.getItem(key),
        ]),
      );
    },
    close() {
      w.close();
    },
  };
};
