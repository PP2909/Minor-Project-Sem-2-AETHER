// server.js - Library Management System Backend
// =============================================
// Features covered:
//  ✅ User Registration
//  ✅ User Login (Student + Admin)
//  ✅ View All Books
//  ✅ Search Books (by title, author, category)
//  ✅ Check Book Availability
//  ✅ Issue Book
//  ✅ Return Book
//  ✅ View Issued Books (per student)
//  ✅ Admin: Add / Update / Delete Books
// =============================================

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = 3000;

// ─── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── ROOT ─────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "📚 Library Management System API is running!" });
});


// ══════════════════════════════════════════════════════════
//  1. USER REGISTRATION
//  POST /api/register
//  Body: { name, email, password }
// ══════════════════════════════════════════════════════════
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')";
  db.query(sql, [name, email, password], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Email already registered." });
      }
      return res.status(500).json({ error: "Registration failed.", details: err.message });
    }
    res.status(201).json({ message: "✅ Registration successful!", userId: result.insertId });
  });
});


// ══════════════════════════════════════════════════════════
//  2. USER LOGIN (Student + Admin)
//  POST /api/login
//  Body: { email, password }
// ══════════════════════════════════════════════════════════
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const sql = "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: "Login failed.", details: err.message });

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = results[0];
    res.json({
      message: "✅ Login successful!",
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  });
});


// ══════════════════════════════════════════════════════════
//  3. VIEW ALL BOOKS
//  GET /api/books
// ══════════════════════════════════════════════════════════
app.get("/api/books", (req, res) => {
  const sql = "SELECT * FROM books ORDER BY title ASC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch books.", details: err.message });
    res.json({ total: results.length, books: results });
  });
});


// ══════════════════════════════════════════════════════════
//  4. SEARCH BOOKS (by title, author, or category)
//  GET /api/books/search?query=harry
// ══════════════════════════════════════════════════════════
app.get("/api/books/search", (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Search query is required." });
  }

  const searchTerm = `%${query}%`;
  const sql = `
    SELECT * FROM books
    WHERE title LIKE ? OR author LIKE ? OR category LIKE ?
    ORDER BY title ASC
    LIMIT 50
  `;
  db.query(sql, [searchTerm, searchTerm, searchTerm], (err, results) => {
    if (err) return res.status(500).json({ error: "Search failed.", details: err.message });
    res.json({ total: results.length, books: results });
  });
});


// ══════════════════════════════════════════════════════════
//  5. CHECK BOOK AVAILABILITY
//  GET /api/books/:id/availability
// ══════════════════════════════════════════════════════════
app.get("/api/books/:id/availability", (req, res) => {
  const bookId = req.params.id;

  const sql = "SELECT id, title, author, total_copies, available_copies FROM books WHERE id = ?";
  db.query(sql, [bookId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to check availability." });
    if (results.length === 0) return res.status(404).json({ error: "Book not found." });

    const book = results[0];
    res.json({
      book_id: book.id,
      title: book.title,
      author: book.author,
      total_copies: book.total_copies,
      available_copies: book.available_copies,
      status: book.available_copies > 0 ? "✅ Available" : "❌ Not Available"
    });
  });
});


// ══════════════════════════════════════════════════════════
//  6. ISSUE A BOOK (Backend Library Feature ⭐)
//  POST /api/issue
//  Body: { user_id, book_id }
// ══════════════════════════════════════════════════════════
app.post("/api/issue", (req, res) => {
  const { user_id, book_id } = req.body;

  if (!user_id || !book_id) {
    return res.status(400).json({ error: "user_id and book_id are required." });
  }

  // Step 1: Check if book is available
  db.query("SELECT * FROM books WHERE id = ?", [book_id], (err, bookResults) => {
    if (err) return res.status(500).json({ error: "Database error.", details: err.message });
    if (bookResults.length === 0) return res.status(404).json({ error: "Book not found." });

    const book = bookResults[0];

    if (book.available_copies <= 0) {
      return res.status(400).json({ error: "❌ Book is not available for issue right now." });
    }

    // Step 2: Check if user already has this book issued
    const checkSql = `
      SELECT * FROM issued_books
      WHERE user_id = ? AND book_id = ? AND status = 'issued'
    `;
    db.query(checkSql, [user_id, book_id], (err, existing) => {
      if (err) return res.status(500).json({ error: "Database error.", details: err.message });
      if (existing.length > 0) {
        return res.status(409).json({ error: "You have already issued this book." });
      }

      // Step 3: Issue the book
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14-day return period
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const issueSql = `
        INSERT INTO issued_books (user_id, book_id, issue_date, due_date, status)
        VALUES (?, ?, CURDATE(), ?, 'issued')
      `;
      db.query(issueSql, [user_id, book_id, dueDateStr], (err, issueResult) => {
        if (err) return res.status(500).json({ error: "Failed to issue book.", details: err.message });

        // Step 4: Decrease available copies
        db.query(
          "UPDATE books SET available_copies = available_copies - 1 WHERE id = ?",
          [book_id],
          (err) => {
            if (err) return res.status(500).json({ error: "Failed to update book copies." });

            res.status(201).json({
              message: `✅ Book "${book.title}" issued successfully!`,
              issue_id: issueResult.insertId,
              due_date: dueDateStr
            });
          }
        );
      });
    });
  });
});


// ══════════════════════════════════════════════════════════
//  7. RETURN A BOOK (Backend Library Feature ⭐)
//  POST /api/return
//  Body: { user_id, book_id }
// ══════════════════════════════════════════════════════════
app.post("/api/return", (req, res) => {
  const { user_id, book_id } = req.body;

  if (!user_id || !book_id) {
    return res.status(400).json({ error: "user_id and book_id are required." });
  }

  // Step 1: Find the active issue record
  const findSql = `
    SELECT ib.*, b.title FROM issued_books ib
    JOIN books b ON ib.book_id = b.id
    WHERE ib.user_id = ? AND ib.book_id = ? AND ib.status = 'issued'
  `;
  db.query(findSql, [user_id, book_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error.", details: err.message });
    if (results.length === 0) {
      return res.status(404).json({ error: "No active issue record found for this book." });
    }

    const issue = results[0];

    // Step 2: Mark as returned
    const returnSql = `
      UPDATE issued_books
      SET status = 'returned', return_date = CURDATE()
      WHERE id = ?
    `;
    db.query(returnSql, [issue.id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to return book.", details: err.message });

      // Step 3: Increase available copies
      db.query(
        "UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
        [book_id],
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to update book copies." });

          res.json({
            message: `✅ Book "${issue.title}" returned successfully!`,
            return_date: new Date().toISOString().split("T")[0]
          });
        }
      );
    });
  });
});


// ══════════════════════════════════════════════════════════
//  8. VIEW ISSUED BOOKS (for a student)
//  GET /api/issued/:user_id
// ══════════════════════════════════════════════════════════
app.get("/api/issued/:user_id", (req, res) => {
  const { user_id } = req.params;

  const sql = `
    SELECT
      ib.id AS issue_id,
      b.id AS book_id,
      b.title,
      b.author,
      ib.issue_date,
      ib.due_date,
      ib.return_date,
      ib.status
    FROM issued_books ib
    JOIN books b ON ib.book_id = b.id
    WHERE ib.user_id = ?
    ORDER BY ib.issue_date DESC
  `;
  db.query(sql, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch issued books.", details: err.message });
    res.json({ total: results.length, issued_books: results });
  });
});


// ══════════════════════════════════════════════════════════
//  9. ADMIN: ADD A BOOK
//  POST /api/admin/books
//  Body: { title, author, publisher, year, category, total_copies, isbn, image_url }
// ══════════════════════════════════════════════════════════
app.post("/api/admin/books", (req, res) => {
  const { title, author, publisher, year, category, total_copies, isbn, image_url } = req.body;

  if (!title) return res.status(400).json({ error: "Book title is required." });

  const copies = total_copies || 1;
  const sql = `
    INSERT INTO books (isbn, title, author, publisher, year, category, total_copies, available_copies, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [isbn || null, title, author || null, publisher || null, year || null, category || "General", copies, copies, image_url || null], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to add book.", details: err.message });
    res.status(201).json({ message: "✅ Book added successfully!", book_id: result.insertId });
  });
});


// ══════════════════════════════════════════════════════════
//  9b. ADMIN: UPDATE A BOOK
//  PUT /api/admin/books/:id
//  Body: { title, author, category, total_copies, ... }
// ══════════════════════════════════════════════════════════
app.put("/api/admin/books/:id", (req, res) => {
  const bookId = req.params.id;
  const { title, author, publisher, year, category, total_copies, image_url } = req.body;

  const sql = `
    UPDATE books SET
      title = COALESCE(?, title),
      author = COALESCE(?, author),
      publisher = COALESCE(?, publisher),
      year = COALESCE(?, year),
      category = COALESCE(?, category),
      total_copies = COALESCE(?, total_copies),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `;
  db.query(sql, [title, author, publisher, year, category, total_copies, image_url, bookId], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to update book.", details: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Book not found." });
    res.json({ message: "✅ Book updated successfully!" });
  });
});


// ══════════════════════════════════════════════════════════
//  9c. ADMIN: DELETE A BOOK
//  DELETE /api/admin/books/:id
// ══════════════════════════════════════════════════════════
app.delete("/api/admin/books/:id", (req, res) => {
  const bookId = req.params.id;

  db.query("DELETE FROM books WHERE id = ?", [bookId], (err, result) => {
    if (err) return res.status(500).json({ error: "Failed to delete book.", details: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Book not found." });
    res.json({ message: "✅ Book deleted successfully!" });
  });
});


// ══════════════════════════════════════════════════════════
//  10. ADMIN: VIEW ALL ISSUED BOOKS (all students)
//  GET /api/admin/issued
// ══════════════════════════════════════════════════════════
app.get("/api/admin/issued", (req, res) => {
  const sql = `
    SELECT
      ib.id AS issue_id,
      u.id AS user_id,
      u.name AS student_name,
      u.email AS student_email,
      b.id AS book_id,
      b.title AS book_title,
      b.author,
      ib.issue_date,
      ib.due_date,
      ib.return_date,
      ib.status
    FROM issued_books ib
    JOIN users u ON ib.user_id = u.id
    JOIN books b ON ib.book_id = b.id
    ORDER BY ib.issue_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch records.", details: err.message });
    res.json({ total: results.length, records: results });
  });
});


// ─── Start Server ─────────────────────────────────────────
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
  console.log(`   GET  /api/admin/issued\n`);
});