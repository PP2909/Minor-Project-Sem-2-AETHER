server.js
// server.js - Library Management System Backend

const express = require("express");
const cors = require("cors");
const db = require("./db");
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: "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" });

const app = express();
const PORT = 3000;

// ───────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ROOT
app.get("/", (req, res) => {
  res.json({ message: "📚 Library Management System API is running!" });
});

// 1. REGISTER
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required." });
  db.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')", [name, email, password], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already registered." });
      return res.status(500).json({ error: "Registration failed.", details: err.message });
    }
    res.status(201).json({ message: "✅ Registration successful!", userId: result.insertId });
  });
});

// 2. LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  db.query("SELECT id, name, email, role FROM users WHERE email = ? AND password = ?", [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: "Login failed.", details: err.message });
    if (results.length === 0) return res.status(401).json({ error: "Invalid email or password." });
    const user = results[0];
    res.json({ message: "✅ Login successful!", user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

// 3. VIEW ALL BOOKS
app.get("/api/books", (req, res) => {
  db.query("SELECT * FROM books ORDER BY title ASC", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch books.", details: err.message });
    res.json({ total: results.length, books: results });
  });
});

// 4. SEARCH BOOKS
app.get("/api/books/search", (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Search query is required." });
  const s = `%${query}%`;
  db.query("SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR category LIKE ? ORDER BY title ASC LIMIT 50", [s, s, s], (err, results) => {
    if (err) return res.status(500).json({ error: "Search failed.", details: err.message });
    res.json({ total: results.length, books: results });
  });
});

// 5. CHECK AVAILABILITY
app.get("/api/books/:id/availability", (req, res) => {
  db.query("SELECT id, title, author, total_copies, available_copies FROM books WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to check availability." });
    if (results.length === 0) return res.status(404).json({ error: "Book not found." });
    const book = results[0];
    res.json({ ...book, status: book.available_copies > 0 ? "✅ Available" : "❌ Not Available" });
  });
});

// 6. ISSUE BOOK
app.post("/api/issue", (req, res) => {
  const { user_id, book_id } = req.body;
  if (!user_id || !book_id) return res.status(400).json({ error: "user_id and book_id are required." });
  db.query("SELECT * FROM books WHERE id = ?", [book_id], (err, bookResults) => {
    if (err) return res.status(500).json({ error: "Database error.", details: err.message });
    if (bookResults.length === 0) return res.status(404).json({ error: "Book not found." });
    const book = bookResults[0];
    if (book.available_copies <= 0) return res.status(400).json({ error: "❌ Book is not available." });
    db.query("SELECT * FROM issued_books WHERE user_id = ? AND book_id = ? AND status = 'issued'", [user_id, book_id], (err, existing) => {
      if (err) return res.status(500).json({ error: "Database error.", details: err.message });
      if (existing.length > 0) return res.status(409).json({ error: "You already issued this book." });
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      db.query("INSERT INTO issued_books (user_id, book_id, issue_date, due_date, status) VALUES (?, ?, CURDATE(), ?, 'issued')", [user_id, book_id, dueDateStr], (err, issueResult) => {
        if (err) return res.status(500).json({ error: "Failed to issue book.", details: err.message });
        db.query("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", [book_id], (err) => {
          if (err) return res.status(500).json({ error: "Failed to update copies." });
          res.status(201).json({ message: `✅ Book "${book.title}" issued!`, issue_id: issueResult.insertId, due_date: dueDateStr });
        });
      });
    });
  });
});

// 7. RETURN BOOK
app.post("/api/return", (req, res) => {
  const { user_id, book_id } = req.body;
  if (!user_id || !book_id) return res.status(400).json({ error: "user_id and book_id are required." });
  db.query("SELECT ib.*, b.title FROM issued_books ib JOIN books b ON ib.book_id = b.id WHERE ib.user_id = ? AND ib.book_id = ? AND ib.status = 'issued'", [user_id, book_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error.", details: err.message });
    if (results.length === 0) return res.status(404).json({ error: "No active issue found." });
    const issue = results[0];
    db.query("UPDATE issued_books SET status = 'returned', return_date = CURDATE() WHERE id = ?", [issue.id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to return book.", details: err.message });
      db.query("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [book_id], (err) => {
        if (err) return res.status(500).json({ error: "Failed to update copies." });
        res.json({ message: `✅ Book "${issue.title}" returned!`, return_date: new Date().toISOString().split("T")[0] });
      });
    });
  });
});

// 8. VIEW ISSUED BOOKS
app.get("/api/issued/:user_id", (req, res) => {
  const sql = `SELECT ib.id AS issue_id, b.id AS book_id, b.title, b.author, ib.issue_date, ib.due_date, ib.return_date, ib.status FROM issued_books ib JOIN books b ON ib.book_id = b.id WHERE ib.user_id = ? ORDER BY ib.issue_date DESC`;
  db.query(sql, [req.params.user_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch issued books.", details: err.message });
    res.json({ total: results.length, issued_books: results });
  });
});

// 9. ADMIN: ADD BOOK
app.post("/api/admin/books", (req, res) => {
  const { title, author, publisher, year, category, total_copies, isbn, image_url } = req.body;
  if (!title) return res.status(400).json({ error: "Book title is required." });
  const copies = total_copies || 1;
  db.query("INSERT INTO books (isbn, title, author, publisher, year, category, total_copies, available_copies, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [isbn || null, title, author || null, publisher || null, year || null, category || "General", copies, copies, image_url || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Failed to add book.", details: err.message });
      res.status(201).json({ message: "✅ Book added!", book_id: result.insertId });
    });
});

// 9b. ADMIN: UPDATE BOOK
app.put("/api/admin/books/:id", (req, res) => {
  const { title, author, publisher, year, category, total_copies, image_url } = req.body;
  db.query("UPDATE books SET title=COALESCE(?,title), author=COALESCE(?,author), publisher=COALESCE(?,publisher), year=COALESCE(?,year), category=COALESCE(?,category), total_copies=COALESCE(?,total_copies), image_url=COALESCE(?,image_url) WHERE id=?",
    [title, author, publisher, year, category, total_copies, image_url, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Failed to update book.", details: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: "Book not found." });
      res.json({ message: "✅ Book updated!" });
    });
});

// 9c. ADMIN: DELETE BOOK
app.delete("/api/admin/books/:id", (req, res) => {
  db.query("DELETE FROM books WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to delete book.", details: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Book not found." });
    res.json({ message: "✅ Book deleted!" });
  });
});

// 10. ADMIN: ALL ISSUED
app.get("/api/admin/issued", (req, res) => {
  const sql = `SELECT ib.id AS issue_id, u.id AS user_id, u.name AS student_name, u.email AS student_email, b.id AS book_id, b.title AS book_title, b.author, ib.issue_date, ib.due_date, ib.return_date, ib.status FROM issued_books ib JOIN users u ON ib.user_id = u.id JOIN books b ON ib.book_id = b.id ORDER BY ib.issue_date DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch records.", details: err.message });
    res.json({ total: results.length, records: results });
  });
});

// 11. AI LIBRARIAN ✨
app.post("/api/ai/suggest", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required." });
  try {
    db.query("SELECT title, author, category FROM books LIMIT 200", async (err, books) => {
      if (err) return res.status(500).json({ error: "Failed to fetch books." });
      const bookList = books.map((b) => `"${b.title}" by ${b.author} (${b.category || "General"})`).join("\n");
      const prompt = `You are a friendly AI librarian assistant.
A student said: "${message}"
Here are books available in our library:
${bookList}
Suggest 3-5 books that match their mood or request.
For each book give: title, author, and one sentence why it fits.
Start with a warm friendly intro. Keep it short and encouraging!`;
  const completion = await groq.chat.completions.create({
  messages: [
    { role: "system", content: "You are a friendly AI librarian." },
    { role: "user", content: prompt }
  ],
  model: "llama-3.3-70b-versatile",
  max_tokens: 500,
});
res.json({ reply: completion.choices[0].message.content });
    });
  } catch (error) {
    console.error("Groq error:", error.message);
    res.status(500).json({ error: "AI unavailable.", details: error.message });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`\n🚀 Library API running at http://localhost:${PORT}`);
  console.log(`📚 Endpoints ready:`);
  console.log(`   POST /api/register`);
  console.log(`   POST /api/login`);
  console.log(`   GET  /api/books`);
  console.log(`   GET  /api/books/search?query=...`);
  console.log(`   GET  /api/books/:id/availability`);
  console.log(`   POST /api/issue`);
  console.log(`   POST /api/return`);
  console.log(`   GET  /api/issued/:user_id`);
  console.log(`   POST /api/admin/books`);
  console.log(`   PUT  /api/admin/books/:id`);
  console.log(`   DELETE /api/admin/books/:id`);
  console.log(`   GET  /api/admin/issued`);
  console.log(`   POST /api/ai/suggest ✨`);
});