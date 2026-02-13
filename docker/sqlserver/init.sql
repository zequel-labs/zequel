-- Zequel seed data for SQL Server

-- ============================================================
-- Tables (idempotent — safe to re-run)
-- ============================================================

IF OBJECT_ID('dbo.order_items', 'U') IS NOT NULL DROP TABLE dbo.order_items;
IF OBJECT_ID('dbo.orders', 'U') IS NOT NULL DROP TABLE dbo.orders;
IF OBJECT_ID('dbo.products', 'U') IS NOT NULL DROP TABLE dbo.products;
IF OBJECT_ID('dbo.customers', 'U') IS NOT NULL DROP TABLE dbo.customers;
GO

CREATE TABLE customers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    phone NVARCHAR(30),
    city NVARCHAR(100),
    country NVARCHAR(60),
    created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    category NVARCHAR(60),
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    status NVARCHAR(20) DEFAULT 'pending',
    total DECIMAL(10, 2),
    created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE order_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL
);
GO

-- ============================================================
-- Table comments via extended properties
-- ============================================================

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Customer master table', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'customers';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Product catalog', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'products';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Customer orders', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'orders';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Line items for each order', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'order_items';
GO

-- Customers (20)
SET IDENTITY_INSERT customers ON;
INSERT INTO customers (id, name, email, phone, city, country) VALUES
(1, 'Alice Johnson', 'alice@example.com', '+1-555-0101', 'New York', 'USA'),
(2, 'Bob Smith', 'bob@example.com', '+1-555-0102', 'Los Angeles', 'USA'),
(3, 'Carlos Garcia', 'carlos@example.com', '+34-600-1001', 'Madrid', 'Spain'),
(4, 'Diana Chen', 'diana@example.com', '+86-138-0001', 'Shanghai', 'China'),
(5, 'Erik Muller', 'erik@example.com', '+49-170-2001', 'Berlin', 'Germany'),
(6, 'Fatima Al-Rashid', 'fatima@example.com', '+971-50-3001', 'Dubai', 'UAE'),
(7, 'George Papadopoulos', 'george@example.com', '+30-694-4001', 'Athens', 'Greece'),
(8, 'Hana Tanaka', 'hana@example.com', '+81-90-5001', 'Tokyo', 'Japan'),
(9, 'Ivan Petrov', 'ivan@example.com', '+7-916-6001', 'Moscow', 'Russia'),
(10, 'Julia Santos', 'julia@example.com', '+55-11-7001', 'Sao Paulo', 'Brazil'),
(11, 'Kevin O''Brien', 'kevin@example.com', '+353-87-8001', 'Dublin', 'Ireland'),
(12, 'Leila Ahmadi', 'leila@example.com', '+98-912-9001', 'Tehran', 'Iran'),
(13, 'Marco Rossi', 'marco@example.com', '+39-348-1002', 'Rome', 'Italy'),
(14, 'Nina Johansson', 'nina@example.com', '+46-70-2002', 'Stockholm', 'Sweden'),
(15, 'Oscar Nguyen', 'oscar@example.com', '+84-90-3002', 'Ho Chi Minh City', 'Vietnam'),
(16, 'Priya Sharma', 'priya@example.com', '+91-98-4002', 'Mumbai', 'India'),
(17, 'Quentin Dubois', 'quentin@example.com', '+33-6-5002', 'Paris', 'France'),
(18, 'Rosa Hernandez', 'rosa@example.com', '+52-55-6002', 'Mexico City', 'Mexico'),
(19, 'Sven Eriksson', 'sven@example.com', '+46-73-7002', 'Gothenburg', 'Sweden'),
(20, 'Tanya Kowalski', 'tanya@example.com', '+48-600-8002', 'Warsaw', 'Poland');
SET IDENTITY_INSERT customers OFF;
GO

-- Products (20)
SET IDENTITY_INSERT products ON;
INSERT INTO products (id, name, category, price, stock) VALUES
(1, 'Wireless Mouse', 'Electronics', 29.99, 150),
(2, 'Mechanical Keyboard', 'Electronics', 89.99, 75),
(3, 'USB-C Hub', 'Electronics', 49.99, 200),
(4, 'Laptop Stand', 'Accessories', 39.99, 120),
(5, 'Webcam HD 1080p', 'Electronics', 59.99, 90),
(6, 'Noise-Cancelling Headphones', 'Audio', 199.99, 60),
(7, 'Bluetooth Speaker', 'Audio', 79.99, 110),
(8, 'Monitor 27"', 'Electronics', 349.99, 40),
(9, 'Desk Lamp LED', 'Home Office', 34.99, 200),
(10, 'Ergonomic Chair', 'Furniture', 499.99, 25),
(11, 'Standing Desk', 'Furniture', 599.99, 15),
(12, 'Cable Management Kit', 'Accessories', 19.99, 300),
(13, 'Wireless Charger', 'Electronics', 24.99, 180),
(14, 'External SSD 1TB', 'Storage', 109.99, 85),
(15, 'Mouse Pad XL', 'Accessories', 14.99, 250),
(16, 'Screen Protector', 'Accessories', 9.99, 500),
(17, 'Portable Monitor 15"', 'Electronics', 249.99, 35),
(18, 'USB Microphone', 'Audio', 69.99, 95),
(19, 'Desk Organizer', 'Home Office', 27.99, 140),
(20, 'Laptop Backpack', 'Accessories', 59.99, 100);
SET IDENTITY_INSERT products OFF;
GO

-- Orders (30)
SET IDENTITY_INSERT orders ON;
INSERT INTO orders (id, customer_id, status, total, created_at) VALUES
(1, 1, 'completed', 119.98, '2025-01-05 10:30:00'),
(2, 2, 'completed', 349.99, '2025-01-07 14:20:00'),
(3, 3, 'completed', 89.99, '2025-01-10 09:15:00'),
(4, 4, 'shipped', 259.98, '2025-01-12 16:45:00'),
(5, 5, 'completed', 499.99, '2025-01-15 11:00:00'),
(6, 6, 'completed', 79.99, '2025-01-18 13:30:00'),
(7, 7, 'shipped', 174.98, '2025-01-20 08:45:00'),
(8, 8, 'completed', 599.99, '2025-01-22 17:10:00'),
(9, 9, 'pending', 139.98, '2025-01-25 10:00:00'),
(10, 10, 'completed', 109.99, '2025-01-28 12:30:00'),
(11, 11, 'shipped', 449.98, '2025-02-01 09:20:00'),
(12, 12, 'completed', 29.99, '2025-02-03 15:45:00'),
(13, 13, 'completed', 199.99, '2025-02-05 11:30:00'),
(14, 14, 'cancelled', 59.99, '2025-02-08 14:00:00'),
(15, 15, 'completed', 304.97, '2025-02-10 10:15:00'),
(16, 1, 'shipped', 69.99, '2025-02-12 16:30:00'),
(17, 16, 'completed', 249.99, '2025-02-15 09:45:00'),
(18, 17, 'pending', 89.98, '2025-02-18 13:00:00'),
(19, 18, 'completed', 534.98, '2025-02-20 11:20:00'),
(20, 19, 'completed', 34.99, '2025-02-22 15:30:00'),
(21, 20, 'shipped', 129.98, '2025-02-25 08:00:00'),
(22, 2, 'completed', 199.99, '2025-02-28 12:45:00'),
(23, 5, 'pending', 79.99, '2025-03-02 10:30:00'),
(24, 8, 'completed', 49.99, '2025-03-05 14:15:00'),
(25, 3, 'completed', 159.98, '2025-03-08 09:00:00'),
(26, 11, 'shipped', 699.98, '2025-03-10 16:00:00'),
(27, 14, 'completed', 24.99, '2025-03-12 11:45:00'),
(28, 6, 'completed', 419.98, '2025-03-15 13:30:00'),
(29, 9, 'pending', 59.99, '2025-03-18 10:00:00'),
(30, 20, 'completed', 89.99, '2025-03-20 15:00:00');
SET IDENTITY_INSERT orders OFF;
GO

-- Order Items (50)
SET IDENTITY_INSERT order_items ON;
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 2, 29.99),
(2, 1, 15, 2, 14.99),
(3, 1, 16, 2, 9.99),
(4, 2, 8, 1, 349.99),
(5, 3, 2, 1, 89.99),
(6, 4, 6, 1, 199.99),
(7, 4, 18, 1, 69.99),
(8, 5, 10, 1, 499.99),
(9, 6, 7, 1, 79.99),
(10, 7, 3, 1, 49.99),
(11, 7, 13, 2, 24.99),
(12, 7, 15, 1, 14.99),
(13, 7, 12, 2, 19.99),
(14, 8, 11, 1, 599.99),
(15, 9, 2, 1, 89.99),
(16, 9, 3, 1, 49.99),
(17, 10, 14, 1, 109.99),
(18, 11, 8, 1, 349.99),
(19, 11, 4, 1, 39.99),
(20, 11, 15, 2, 14.99),
(21, 11, 1, 1, 29.99),
(22, 12, 1, 1, 29.99),
(23, 13, 6, 1, 199.99),
(24, 14, 5, 1, 59.99),
(25, 15, 17, 1, 249.99),
(26, 15, 9, 1, 34.99),
(27, 15, 12, 1, 19.99),
(28, 16, 18, 1, 69.99),
(29, 17, 17, 1, 249.99),
(30, 18, 2, 1, 89.99),
(31, 19, 10, 1, 499.99),
(32, 19, 9, 1, 34.99),
(33, 20, 9, 1, 34.99),
(34, 21, 4, 1, 39.99),
(35, 21, 2, 1, 89.99),
(36, 22, 6, 1, 199.99),
(37, 23, 7, 1, 79.99),
(38, 24, 3, 1, 49.99),
(39, 25, 5, 1, 59.99),
(40, 25, 4, 1, 39.99),
(41, 25, 15, 1, 14.99),
(42, 25, 16, 3, 9.99),
(43, 26, 11, 1, 599.99),
(44, 26, 4, 1, 39.99),
(45, 26, 15, 2, 14.99),
(46, 27, 13, 1, 24.99),
(47, 28, 8, 1, 349.99),
(48, 28, 18, 1, 69.99),
(49, 29, 5, 1, 59.99),
(50, 30, 2, 1, 89.99);
SET IDENTITY_INSERT order_items OFF;
GO

-- ============================================================
-- Views (drop first for idempotency)
-- ============================================================

IF OBJECT_ID('dbo.customer_order_summary', 'V') IS NOT NULL DROP VIEW dbo.customer_order_summary;
IF OBJECT_ID('dbo.product_sales', 'V') IS NOT NULL DROP VIEW dbo.product_sales;
IF OBJECT_ID('dbo.recent_orders', 'V') IS NOT NULL DROP VIEW dbo.recent_orders;
GO

CREATE VIEW customer_order_summary AS
SELECT c.id, c.name, c.email, c.country,
       COUNT(o.id) AS order_count,
       ISNULL(SUM(o.total), 0) AS total_spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.email, c.country;
GO

CREATE VIEW product_sales AS
SELECT p.id, p.name, p.category, p.price, p.stock,
       ISNULL(SUM(oi.quantity), 0) AS units_sold,
       ISNULL(SUM(oi.quantity * oi.unit_price), 0) AS revenue
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name, p.category, p.price, p.stock;
GO

CREATE VIEW recent_orders AS
SELECT o.id, c.name AS customer_name, o.status, o.total, o.created_at
FROM orders o
JOIN customers c ON c.id = o.customer_id;
GO

-- ============================================================
-- Functions (drop first for idempotency)
-- ============================================================

IF OBJECT_ID('dbo.get_customer_total_spent', 'FN') IS NOT NULL DROP FUNCTION dbo.get_customer_total_spent;
IF OBJECT_ID('dbo.format_price', 'FN') IS NOT NULL DROP FUNCTION dbo.format_price;
GO

CREATE FUNCTION dbo.get_customer_total_spent(@customer_id INT)
RETURNS DECIMAL(10,2)
AS
BEGIN
  DECLARE @total DECIMAL(10,2);
  SELECT @total = ISNULL(SUM(total), 0) FROM orders WHERE customer_id = @customer_id;
  RETURN @total;
END;
GO

CREATE FUNCTION dbo.format_price(@amount DECIMAL(10,2))
RETURNS NVARCHAR(50)
AS
BEGIN
  RETURN '$' + FORMAT(@amount, 'N2');
END;
GO

-- ============================================================
-- Procedures (drop first for idempotency)
-- ============================================================

IF OBJECT_ID('dbo.update_order_status', 'P') IS NOT NULL DROP PROCEDURE dbo.update_order_status;
GO

CREATE PROCEDURE dbo.update_order_status
  @order_id INT,
  @status NVARCHAR(20)
AS
BEGIN
  UPDATE orders SET status = @status WHERE id = @order_id;
END;
GO

-- ============================================================
-- Triggers (drop first for idempotency)
-- ============================================================

IF OBJECT_ID('dbo.trg_update_stock', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_update_stock;
IF OBJECT_ID('dbo.trg_order_status_change', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_order_status_change;
GO

CREATE TRIGGER trg_update_stock
ON order_items
AFTER INSERT
AS
BEGIN
  UPDATE p
  SET p.stock = p.stock - i.quantity
  FROM products p
  INNER JOIN inserted i ON p.id = i.product_id;
END;
GO

CREATE TRIGGER trg_order_status_change
ON orders
AFTER UPDATE
AS
BEGIN
  IF UPDATE(status)
  BEGIN
    PRINT 'Order status changed';
  END;
END;
GO

-- ============================================================
-- Sequences (matching PostgreSQL seed)
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'invoice_number_seq' AND schema_id = SCHEMA_ID('dbo'))
  DROP SEQUENCE dbo.invoice_number_seq;
IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'ticket_number_seq' AND schema_id = SCHEMA_ID('dbo'))
  DROP SEQUENCE dbo.ticket_number_seq;
IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'batch_id_seq' AND schema_id = SCHEMA_ID('dbo'))
  DROP SEQUENCE dbo.batch_id_seq;
GO

CREATE SEQUENCE dbo.invoice_number_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE dbo.ticket_number_seq START WITH 5000 INCREMENT BY 10;
CREATE SEQUENCE dbo.batch_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 CYCLE;
GO

-- ============================================================
-- Indexed Views (SQL Server equivalent of materialized views)
-- ============================================================

-- SQL Server requires SCHEMABINDING for indexed views.
-- These provide pre-computed aggregates similar to PG materialized views.

IF OBJECT_ID('dbo.mv_monthly_sales', 'V') IS NOT NULL DROP VIEW dbo.mv_monthly_sales;
IF OBJECT_ID('dbo.mv_category_stats', 'V') IS NOT NULL DROP VIEW dbo.mv_category_stats;
GO

-- Indexed views require QUOTED_IDENTIFIER and ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE VIEW dbo.mv_monthly_sales WITH SCHEMABINDING AS
SELECT
  CAST(DATEFROMPARTS(YEAR(o.created_at), MONTH(o.created_at), 1) AS DATE) AS month,
  COUNT_BIG(*) AS order_count,
  SUM(ISNULL(o.total, 0)) AS revenue
FROM dbo.orders o
WHERE o.status != 'cancelled'
GROUP BY DATEFROMPARTS(YEAR(o.created_at), MONTH(o.created_at), 1);
GO

CREATE UNIQUE CLUSTERED INDEX IX_mv_monthly_sales ON dbo.mv_monthly_sales (month);
GO

CREATE VIEW dbo.mv_category_stats WITH SCHEMABINDING AS
SELECT
  p.category,
  COUNT_BIG(*) AS row_count,
  SUM(oi.quantity) AS total_units_sold,
  SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM dbo.products p
INNER JOIN dbo.order_items oi ON oi.product_id = p.id
GROUP BY p.category;
GO

CREATE UNIQUE CLUSTERED INDEX IX_mv_category_stats ON dbo.mv_category_stats (category);
GO

-- ============================================================
-- Additional schema for testing schema support
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'reporting')
  EXEC('CREATE SCHEMA reporting');
GO

IF OBJECT_ID('reporting.revenue_by_month', 'V') IS NOT NULL DROP VIEW reporting.revenue_by_month;
IF OBJECT_ID('reporting.monthly_summary', 'U') IS NOT NULL DROP TABLE reporting.monthly_summary;
GO

CREATE TABLE reporting.monthly_summary (
    id INT IDENTITY(1,1) PRIMARY KEY,
    month DATE NOT NULL,
    order_count INT DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

INSERT INTO reporting.monthly_summary (month, order_count, revenue) VALUES
('2025-01-01', 10, 2344.86),
('2025-02-01', 10, 2214.85),
('2025-03-01', 10, 1609.87);
GO

CREATE VIEW reporting.revenue_by_month AS
SELECT month, order_count, revenue,
       revenue / NULLIF(order_count, 0) AS avg_order_value
FROM reporting.monthly_summary;
GO

-- ============================================================
-- Users & Roles (idempotent, policy-compliant passwords)
-- ============================================================

-- Custom roles (matching PostgreSQL readonly_role / readwrite_role)
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'readonly_role' AND type = 'R')
  CREATE ROLE readonly_role;
GRANT SELECT ON SCHEMA::dbo TO readonly_role;
GRANT SELECT ON SCHEMA::reporting TO readonly_role;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'readwrite_role' AND type = 'R')
  CREATE ROLE readwrite_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO readwrite_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::reporting TO readwrite_role;
GO

-- Users with policy-compliant passwords (must not contain login name)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'analyst')
  CREATE LOGIN analyst WITH PASSWORD = 'ReadOnly@2025';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'analyst')
  CREATE USER analyst FOR LOGIN analyst;
ALTER ROLE readonly_role ADD MEMBER analyst;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'developer')
  CREATE LOGIN developer WITH PASSWORD = 'FullAccess@2025';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'developer')
  CREATE USER developer FOR LOGIN developer;
ALTER ROLE readwrite_role ADD MEMBER developer;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'intern')
  CREATE LOGIN intern WITH PASSWORD = 'JuniorRole@2025';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'intern')
  CREATE USER intern FOR LOGIN intern;
ALTER ROLE readonly_role ADD MEMBER intern;
GO
