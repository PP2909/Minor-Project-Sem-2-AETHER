// importBooks.js
// =====================================================
// Run this script ONCE to import Kaggle CSV into MySQL
// Command: node importBooks.js
// =====================================================
// Works with the popular Kaggle "Book-Crossing Dataset"
// CSV columns expected: ISBN, Book-Title, Book-Author,
//   Year-Of-Publication, Publisher, Image-URL-M
// =====================================================

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const db = require("./db");

// 👇 Put your Kaggle CSV filename here
const CSV_FILE = path.join(__dirname, "compressed_data.csv.gz");

if (!fs.existsSync(CSV_FILE)) {
  console.error("❌ compressed_data_csv.gz not found! Place the file in this folder.");
  process.exit(1);
}

const books = [];

const zlib = require("zlib");
fs.createReadStream(CSV_FILE)
  .pipe(zlib.createGunzip())
  .pipe(csv({ separator: ";" }))
  .on("data", (row) => {
    // Support both Book-Crossing and Goodreads-style columns
    const title =
      row["Book-Title"] || row["title"] || row["Title"] || "";
    const author =
      row["Book-Author"] || row["authors"] || row["Author"] || "";
    const isbn =
      row["ISBN"] || row["isbn"] || "";
    const year =
      row["Year-Of-Publication"] || row["published_year"] || row["Year"] || "";
    const publisher =
      row["Publisher"] || row["publisher"] || "";
    const image =
      row["Image-URL-M"] || row["thumbnail"] || row["image_url"] || "";

    if (title.trim()) {
      books.push([isbn, title, author, publisher, year, image]);
    }

    // Limit to first 500 books for testing (remove limit for full import)
    // if (books.length >= 500) this.destroy();
  })
  .on("end", () => {
    console.log(`📚 Found ${books.length} books in CSV. Importing...`);

    let imported = 0;
    let skipped = 0;

    const insertQuery = `
      INSERT INTO books (isbn, title, author, publisher, year, image_url, total_copies, available_copies)
      VALUES (?, ?, ?, ?, ?, ?, 3, 3)
    `;

    const importNext = (index) => {
      if (index >= books.length) {
        console.log(`✅ Import complete! Imported: ${imported}, Skipped: ${skipped}`);
        db.end();
        return;
      }

      db.query(insertQuery, books[index], (err) => {
        if (err) {
          skipped++;
        } else {
          imported++;
        }
        if (index % 100 === 0) {
          console.log(`⏳ Progress: ${index}/${books.length}`);
        }
        importNext(index + 1);
      });
    };

    importNext(0);
  })
  .on("error", (err) => {
    console.error("❌ Error reading CSV:", err.message);
  });