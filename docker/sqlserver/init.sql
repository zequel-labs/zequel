-- Zequel seed data for SQL Server

-- ============================================================
-- Tables
-- ============================================================

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
-- Views
-- ============================================================

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
-- Functions
-- ============================================================

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
-- Procedures
-- ============================================================

CREATE PROCEDURE dbo.update_order_status
  @order_id INT,
  @status NVARCHAR(20)
AS
BEGIN
  UPDATE orders SET status = @status WHERE id = @order_id;
END;
GO

-- ============================================================
-- Triggers
-- ============================================================

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
    -- Log status changes (placeholder for audit table)
    PRINT 'Order status changed';
  END;
END;
GO

-- ============================================================
-- Additional schema for testing schema support
-- ============================================================

CREATE SCHEMA reporting;
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
-- Users & Roles
-- ============================================================

CREATE LOGIN analyst WITH PASSWORD = 'analyst123';
CREATE USER analyst FOR LOGIN analyst;
ALTER ROLE db_datareader ADD MEMBER analyst;
GO

CREATE LOGIN developer WITH PASSWORD = 'dev123';
CREATE USER developer FOR LOGIN developer;
ALTER ROLE db_datareader ADD MEMBER developer;
ALTER ROLE db_datawriter ADD MEMBER developer;
GO
