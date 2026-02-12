-- DuckDB Seed Data for Zequel
-- This file creates the same seed structure as SQLite for consistency.

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  created_at TIMESTAMP DEFAULT current_timestamp
);

INSERT INTO categories (id, name, description) VALUES
  (1, 'Electronics', 'Electronic devices and accessories'),
  (2, 'Books', 'Physical and digital books'),
  (3, 'Clothing', 'Apparel and fashion items'),
  (4, 'Home & Garden', 'Home improvement and garden supplies'),
  (5, 'Sports', 'Sports equipment and accessories');

-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  full_name VARCHAR,
  age INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

INSERT INTO users (id, username, email, full_name, age, is_active) VALUES
  (1, 'johndoe', 'john@example.com', 'John Doe', 30, true),
  (2, 'janedoe', 'jane@example.com', 'Jane Doe', 28, true),
  (3, 'bobsmith', 'bob@example.com', 'Bob Smith', 35, true),
  (4, 'alicew', 'alice@example.com', 'Alice Williams', 25, true),
  (5, 'charlie', 'charlie@example.com', 'Charlie Brown', 40, false),
  (6, 'diana', 'diana@example.com', 'Diana Prince', 32, true),
  (7, 'edward', 'edward@example.com', 'Edward Norton', 45, true),
  (8, 'fiona', 'fiona@example.com', 'Fiona Apple', 29, false),
  (9, 'george', 'george@example.com', 'George Lucas', 55, true),
  (10, 'hannah', 'hannah@example.com', 'Hannah Montana', 22, true);

-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  price DECIMAL(10, 2) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  stock_quantity INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT current_timestamp
);

INSERT INTO products (id, name, description, price, category_id, stock_quantity, is_available) VALUES
  (1, 'Laptop Pro 15', 'High-performance laptop with 15-inch display', 1299.99, 1, 50, true),
  (2, 'Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 1, 200, true),
  (3, 'Programming in Rust', 'Comprehensive guide to Rust programming', 49.99, 2, 100, true),
  (4, 'Cotton T-Shirt', 'Premium cotton t-shirt', 19.99, 3, 500, true),
  (5, 'Garden Hose 50ft', 'Heavy-duty garden hose', 34.99, 4, 75, true),
  (6, 'Running Shoes', 'Lightweight running shoes', 89.99, 5, 150, true),
  (7, 'Mechanical Keyboard', 'RGB mechanical keyboard', 79.99, 1, 120, true),
  (8, 'SQL Mastery', 'Advanced SQL techniques and patterns', 39.99, 2, 80, true),
  (9, 'Winter Jacket', 'Insulated winter jacket', 149.99, 3, 60, true),
  (10, 'Yoga Mat', 'Non-slip yoga mat', 24.99, 5, 200, true);

-- Orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  order_date TIMESTAMP DEFAULT current_timestamp,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR DEFAULT 'pending'
);

INSERT INTO orders (id, user_id, total_amount, status) VALUES
  (1, 1, 1329.98, 'completed'),
  (2, 2, 89.98, 'completed'),
  (3, 3, 49.99, 'shipped'),
  (4, 1, 79.99, 'pending'),
  (5, 4, 174.98, 'completed'),
  (6, 5, 34.99, 'cancelled'),
  (7, 6, 1299.99, 'shipped'),
  (8, 7, 24.99, 'pending'),
  (9, 2, 149.99, 'completed'),
  (10, 8, 69.98, 'shipped');

-- Order Items
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL
);

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 1, 1299.99),
  (2, 1, 2, 1, 29.99),
  (3, 2, 6, 1, 89.99),
  (4, 3, 3, 1, 49.99),
  (5, 4, 7, 1, 79.99),
  (6, 5, 9, 1, 149.99),
  (7, 5, 10, 1, 24.99),
  (8, 6, 5, 1, 34.99),
  (9, 7, 1, 1, 1299.99),
  (10, 8, 10, 1, 24.99),
  (11, 9, 9, 1, 149.99),
  (12, 10, 4, 2, 19.99),
  (13, 10, 2, 1, 29.99);

-- Views
CREATE VIEW active_users AS
SELECT id, username, email, full_name, age, created_at
FROM users
WHERE is_active = true;

CREATE VIEW order_summary AS
SELECT
  o.id AS order_id,
  u.username,
  u.email,
  o.order_date,
  o.total_amount,
  o.status,
  COUNT(oi.id) AS item_count
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.username, u.email, o.order_date, o.total_amount, o.status;

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
