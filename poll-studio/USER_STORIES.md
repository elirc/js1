# Poll Studio - Feature Backlog

Five user stories with acceptance criteria and step-by-step implementation plans.

> **Architecture recap:** all logic in `app.js`. State is `{ polls, editingId,
> draftOptions }`. Each poll is `{ id, question, options: [{ id, text, votes }] }`.
> `renderOptionRows()` draws the dynamic option inputs from `draftOptions`;
> `render()` draws polls with clickable result bars; `vote()` increments a
> count; `savePolls()` persists to `localStorage`. Min 2 / max 6 options.

---

## Story 1: Prevent double voting
**As a** user, **I want** my vote remembered, **so that** I can't vote twice on the same poll.

### Acceptance criteria
- [ ] After voting, the chosen option is marked and all options for that poll become non-clickable.
- [ ] The voted state persists across reloads (stored separately from poll data).
- [ ] A "Change vote" link lets the user re-open voting for that poll.

### Implementation plan
1. **`app.js`** - add `let myVotes = JSON.parse(localStorage.getItem("js1-poll-votes") || "{}")` (`pollId -> optionId`) and `function saveVotes()`.
2. **`vote()`** - at the top, `if (myVotes[pollId]) return;` then after incrementing set `myVotes[pollId]=optionId; saveVotes();`.
3. **`render()`** - when `myVotes[poll.id]` exists, add a `voted` class, set `result.disabled = true` (or remove the click handler), highlight the chosen option, and render a "Change vote" button that deletes `myVotes[poll.id]`, saves, and re-renders.
4. **`styles.css`** - style `.result.voted` and a `.chosen` marker.

### How to test
Vote on a poll, confirm options lock and the choice is highlighted; reload and confirm it's remembered; "Change vote" re-enables voting.

---

## Story 2: Open/close a poll
**As a** user, **I want** to close a poll, **so that** voting stops once it's decided.

### Acceptance criteria
- [ ] Each poll has an Open/Closed status with a toggle.
- [ ] Closed polls show a "Closed" badge and disable voting.
- [ ] Status persists.

### Implementation plan
1. **`app.js`** - add `status: "open"` to new polls (in `handleSubmit`) and `starterPolls`. Add `function toggleStatus(id){ state.polls = state.polls.map(p => p.id===id ? {...p, status: p.status==="open"?"closed":"open"} : p); savePolls(); render(); }`.
2. **`vote()`** - guard: `const poll = state.polls.find(...); if (poll.status === "closed") return;`.
3. **`render()`** - show a status badge and a toggle button in `.card-actions`; when closed, disable the result buttons.

### How to test
Close a poll, confirm clicking options does nothing and a "Closed" badge shows; reopen and confirm voting works again.

---

## Story 3: Highlight the winning option
**As a** user, **I want** the leader emphasized, **so that** results are scannable.

### Acceptance criteria
- [ ] The option(s) with the most votes get a "Leader" highlight.
- [ ] When all options are tied at 0, nothing is highlighted.

### Implementation plan
1. **`render()`** - after computing `total`, compute `const maxVotes = Math.max(...poll.options.map(o=>o.votes))`. For each option, if `maxVotes > 0 && option.votes === maxVotes`, add a `leader` class to the `.result` element.
2. **`styles.css`** - add `.result.leader { border-color: var(--brand); } .result.leader .result-value::after { content:" ''" }`.

### How to test
Cast votes so one option leads -> it's highlighted; create a fresh poll (all zero) -> nothing highlighted; tie two options -> both highlighted.

---

## Story 4: Add an option to an existing poll without losing votes
**As a** user, **I want** to add a late option, **so that** I don't have to recreate the poll.

### Acceptance criteria
- [ ] An "Add option" control on each poll appends a new option with 0 votes.
- [ ] Existing options keep their vote counts.
- [ ] Respects the 6-option maximum.

### Implementation plan
1. **`app.js`** - add `function addOptionToPoll(id){ state.polls = state.polls.map(p => { if(p.id!==id) return p; if(p.options.length>=MAX_OPTIONS) return p; const text = prompt("New option text"); if(!text?.trim()) return p; return {...p, options:[...p.options, {id:crypto.randomUUID(), text:text.trim(), votes:0}]}; }); savePolls(); render(); }`.
2. **`render()`** - add an "Add option" button to `.card-actions`, disabled when `poll.options.length >= MAX_OPTIONS`.
3. Note: this is independent of the edit flow (which rebuilds options). It mutates votes-safe because it spreads existing options unchanged.

### How to test
Vote on a poll, add a new option, confirm existing counts are intact and the new option starts at 0; confirm the button disables at 6 options.

---

## Story 5: Copy results as shareable text
**As a** user, **I want** to copy a results summary, **so that** I can paste it into chat.

### Acceptance criteria
- [ ] A "Copy results" button copies the question and each option's percentage and count.
- [ ] A confirmation message appears.

### Implementation plan
1. **`render()`** - add a "Copy results" button to `.card-actions`.
2. **`app.js`** - `function copyResults(poll){ const total = poll.options.reduce((s,o)=>s+o.votes,0); const lines = poll.options.map(o => { const pct = total ? Math.round(o.votes/total*100) : 0; return \`- ${o.text}: ${pct}% (${o.votes})\`; }); const text = [poll.question, ...lines].join("\n"); navigator.clipboard?.writeText(text); showMessage("Results copied."); }`.

### How to test
Click "Copy results", paste into a note, confirm the question and each option line with correct percentages.

