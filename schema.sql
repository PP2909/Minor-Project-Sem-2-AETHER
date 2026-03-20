-- ============================================
-- LIBRARY MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Run this FIRST in MySQL Workbench / phpMyAdmin
-- ============================================

CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- USERS TABLE (Students + Admin)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOOKS TABLE (filled from Kaggle CSV)
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  isbn VARCHAR(20),
  title VARCHAR(300) NOT NULL,
  author VARCHAR(200),
  publisher VARCHAR(200),
  year VARCHAR(10),
  category VARCHAR(100) DEFAULT 'General',
  total_copies INT DEFAULT 3,
  available_copies INT DEFAULT 3,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ISSUED BOOKS TABLE
CREATE TABLE IF NOT EXISTS issued_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  issue_date DATE DEFAULT (CURDATE()),
  due_date DATE,
  return_date DATE DEFAULT NULL,
  status ENUM('issued', 'returned') DEFAULT 'issued',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Default Admin
INSERT IGNORE INTO users (name, email, password, role)
VALUES ('Admin', 'admin@library.com', 'admin123', 'admin');