import express from "express";
import cors from "cors";

const app = express();
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

app.listen(port, () => {
  console.log(`Course Roster API listening on http://localhost:${port}`);
});

function validateCourse(req, res, next) {
  const course = normalizeCourse(req.body);

  if (!course.code || !course.title || !course.instructor) {
    return res.status(400).json({ error: "Code, title, and instructor are required." });
  }

  if (course.capacity < 1 || course.enrolled < 0) {
    return res.status(400).json({ error: "Capacity and enrolled counts must be valid numbers." });
  }

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
