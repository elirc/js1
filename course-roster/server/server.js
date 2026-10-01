import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";

export const app = express();
const port = 4102;
let courses = [
  {
    id: crypto.randomUUID(),
    code: "JS-201",
    title: "Modern JavaScript",
    instructor: "Morgan Lee",
    capacity: 24,
    enrolled: 18,
    level: "Intermediate"
  },
  {
    id: crypto.randomUUID(),
    code: "REACT-301",
    title: "React State Patterns",
    instructor: "Sam Rivera",
    capacity: 20,
    enrolled: 20,
    level: "Advanced"
  }
];

app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
  if (["POST","PUT","PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body)))
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});

app.get("/api/courses", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const level = String(req.query.level || "all");
  const result = courses.filter((course) => {
    const matchesSearch = `${course.code} ${course.title} ${course.instructor}`.toLowerCase().includes(search);
    const matchesLevel = level === "all" || course.level === level;
    return matchesSearch && matchesLevel;
  });
  res.json(result);
});

app.post("/api/courses", validateCourse, (req, res) => {
  const course = { id: crypto.randomUUID(), ...normalizeCourse(req.body) };
  courses.unshift(course);
  res.status(201).json(course);
});

app.put("/api/courses/:id", validateCourse, (req, res) => {
  const existing = courses.find((course) => course.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Course not found." });
  }

  const updated = { ...existing, ...normalizeCourse(req.body) };
  courses = courses.map((course) => course.id === req.params.id ? updated : course);
  res.json(updated);
});

app.delete("/api/courses/:id", (req, res) => {
  const before = courses.length;
  courses = courses.filter((course) => course.id !== req.params.id);
  if (courses.length === before) {
    return res.status(404).json({ error: "Course not found." });
  }
  res.status(204).send();
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(port, () => {
  console.log(`Course Roster API listening on http://localhost:${port}`);
});

function validateCourse(req, res, next) {
  if (!["code","title","instructor"].every(key => isText(req.body[key],1)) || !whole(req.body.capacity,1,100000) || !whole(req.body.enrolled,0,100000))
    return res.status(400).json({ error: "Use text fields and whole capacity/enrollment counts." });
  const course = normalizeCourse(req.body);
  if (!["Beginner","Intermediate","Advanced"].includes(course.level)) return res.status(400).json({ error: "Choose a valid level." });
  if (courses.some(existing => existing.id !== req.params.id && existing.code === course.code))
    return res.status(409).json({ error: "A course with this code already exists." });

  if (course.enrolled > course.capacity) {
    return res.status(400).json({ error: "Enrollment cannot exceed capacity." });
  }

  next();
}

function normalizeCourse(input) {
  return {
    code: String(input.code || "").trim().toUpperCase(),
    title: String(input.title || "").trim(),
    instructor: String(input.instructor || "").trim(),
    capacity: Number(input.capacity),
    enrolled: Number(input.enrolled),
    level: input.level || "Beginner"
  };
}

function isText(value, min = 0, max = 200) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function whole(value, min, max) { return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max; }
