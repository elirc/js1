import express from "express";
import cors from "cors";

const app = express();
const port = 4101;

app.use(cors());
app.use(express.json());

const repository = createIssueRepository();

app.get("/api/issues", (req, res) => {
  const { status = "all", search = "" } = req.query;
  res.json(repository.list({ status, search }));
});

app.get("/api/issues/:id", (req, res) => {
  const issue = repository.find(req.params.id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }
  res.json(issue);
});

app.post("/api/issues", validateIssue, (req, res) => {
  const issue = repository.create(req.body);
  res.status(201).json(issue);
});

app.put("/api/issues/:id", validateIssue, (req, res) => {
  const issue = repository.update(req.params.id, req.body);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }
  res.json(issue);
});

app.delete("/api/issues/:id", (req, res) => {
  const removed = repository.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Issue not found." });
  }
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Issue Desk API listening on http://localhost:${port}`);
});

function validateIssue(req, res, next) {
  const { title, status, priority, assignee } = req.body;
  const allowedStatuses = ["Backlog", "In Progress", "Review", "Done"];
  const allowedPriorities = ["Low", "Medium", "High", "Critical"];

  if (!title || title.trim().length < 3) {
    return res.status(400).json({ error: "Title must be at least 3 characters." });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Choose a valid status." });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({ error: "Choose a valid priority." });
  }

  if (!assignee || assignee.trim().length < 2) {
    return res.status(400).json({ error: "Assignee must be at least 2 characters." });
  }

  next();
}

function createIssueRepository() {
  let issues = [
    {
      id: crypto.randomUUID(),
      title: "Add keyboard shortcuts",
      status: "Backlog",
      priority: "Medium",
      assignee: "Taylor",
      description: "Let power users move through the board faster.",
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "Fix empty-state layout",
      status: "In Progress",
      priority: "High",
      assignee: "Riley",
      description: "The issue list jumps when filters return no results.",
      createdAt: new Date().toISOString()
    }
  ];

  return {
    list({ status, search }) {
      return issues.filter((issue) => {
        const matchesStatus = status === "all" || issue.status === status;
        const text = `${issue.title} ${issue.description} ${issue.assignee}`.toLowerCase();
        return matchesStatus && text.includes(search.toLowerCase());
      });
    },
    find(id) {
      return issues.find((issue) => issue.id === id);
    },
    create(input) {
      const issue = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        status: input.status,
        priority: input.priority,
        assignee: input.assignee.trim(),
        description: input.description?.trim() || "",
        createdAt: new Date().toISOString()
      };
      issues.unshift(issue);
      return issue;
    },
    update(id, input) {
      const existing = this.find(id);
      if (!existing) return null;

      const updated = {
        ...existing,
        title: input.title.trim(),
        status: input.status,
        priority: input.priority,
        assignee: input.assignee.trim(),
        description: input.description?.trim() || ""
      };

      issues = issues.map((issue) => issue.id === id ? updated : issue);
      return updated;
    },
    remove(id) {
      const before = issues.length;
      issues = issues.filter((issue) => issue.id !== id);
      return issues.length < before;
    }
  };
}
