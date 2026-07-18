import { useEffect, useMemo, useState } from "react";
import { createCourse, deleteCourse, listCourses, updateCourse } from "./api";
import "./styles.css";

const blankCourse = {
  code: "",
  title: "",
  instructor: "",
  capacity: 20,
  enrolled: 0,
  level: "Beginner"
};

export default function App() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(blankCourse);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", level: "all" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCourses();
  }, [filters]);

  const totalSeats = useMemo(() => {
    return courses.reduce((sum, course) => sum + course.capacity - course.enrolled, 0);
  }, [courses]);

  async function loadCourses() {
    try {
      setCourses(await listCourses(filters));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveCourse(event) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateCourse(editingId, form);
        setMessage("Course updated.");
      } else {
        await createCourse(form);
        setMessage("Course created.");
      }
      resetForm();
      await loadCourses();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editCourse(course) {
    setEditingId(course.id);
    setForm(course);
  }

  async function removeCourse(id) {
    await deleteCourse(id);
    setMessage("Course deleted.");
    await loadCourses();
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankCourse);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Advanced Project 2</p>
          <h1>Course Roster</h1>
        </div>
        <strong>{totalSeats} open seats</strong>
      </header>

      <section className="layout">
        <form className="panel" onSubmit={saveCourse}>
          <label>Course code</label>
          <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />

          <label>Title</label>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <label>Instructor</label>
          <input value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })} />

          <div className="field-row">
            <div>
              <label>Capacity</label>
              <input type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            </div>
            <div>
              <label>Enrolled</label>
              <input type="number" value={form.enrolled} onChange={(event) => setForm({ ...form, enrolled: event.target.value })} />
            </div>
          </div>

          <label>Level</label>
          <select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>

          <div className="actions">
            <button>{editingId ? "Update course" : "Create course"}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
          <p className="message">{message}</p>
        </form>

        <section className="panel">
          <div className="toolbar">
            <input placeholder="Search courses" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}>
              <option value="all">All levels</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>

          <div className="course-list">
            {courses.map((course) => (
              <article className="course" key={course.id}>
                <div>
                  <h2>{course.code}: {course.title}</h2>
                  <p>{course.instructor} · {course.level}</p>
                  <p>{course.enrolled}/{course.capacity} enrolled</p>
                </div>
                <div className="actions">
                  <button type="button" onClick={() => editCourse(course)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeCourse(course.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
