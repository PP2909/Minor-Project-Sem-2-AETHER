// db.js - MySQL Database Connection

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",        
  password: "700200",        
  database: "library_db"
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL database!");
});

module.exports = db;S