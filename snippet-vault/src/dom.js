// dom.js — pure rendering helpers. This module reads from arguments and
// returns DOM, it never imports the store directly.

export function buildCard(snippet, handlers) {
  const card = document.createElement("article");
  card.className = "snippet-card";

  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = snippet.title;
  const lang = document.createElement("span");
  lang.className = "lang-badge";
  lang.textContent = snippet.language;
  header.append(title, lang);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = snippet.code;
  pre.append(code);

  const tagRow = document.createElement("div");
  tagRow.className = "tag-row";
  if (snippet.tags.length === 0) {
    const none = document.createElement("span");
    none.className = "muted";
    none.textContent = "No tags";
    tagRow.append(none);
  } else {
    snippet.tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = `#${tag}`;
      tagRow.append(chip);
    });
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    actionButton("Copy", "secondary", () => handlers.onCopy(snippet, actions)),
    actionButton("Edit", "", () => handlers.onEdit(snippet.id)),
    actionButton("Delete", "danger", () => handlers.onDelete(snippet.id))
  );

  card.append(header, pre, tagRow, actions);
  return card;
}

function actionButton(label, variant, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  if (variant) button.className = variant;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
