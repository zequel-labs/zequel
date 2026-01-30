// Zequel seed data for MongoDB

db = db.getSiblingDB('zequel');

// Customers (20)
db.customers.insertMany([
  { _id: 1, name: "Alice Johnson", email: "alice@example.com", phone: "+1-555-0101", city: "New York", country: "USA", created_at: new Date("2025-01-01") },
  { _id: 2, name: "Bob Smith", email: "bob@example.com", phone: "+1-555-0102", city: "Los Angeles", country: "USA", created_at: new Date("2025-01-01") },
  { _id: 3, name: "Carlos García", email: "carlos@example.com", phone: "+34-600-1001", city: "Madrid", country: "Spain", created_at: new Date("2025-01-01") },
  { _id: 4, name: "Diana Chen", email: "diana@example.com", phone: "+86-138-0001", city: "Shanghai", country: "China", created_at: new Date("2025-01-01") },
  { _id: 5, name: "Erik Müller", email: "erik@example.com", phone: "+49-170-2001", city: "Berlin", country: "Germany", created_at: new Date("2025-01-01") },
  { _id: 6, name: "Fatima Al-Rashid", email: "fatima@example.com", phone: "+971-50-3001", city: "Dubai", country: "UAE", created_at: new Date("2025-01-01") },
  { _id: 7, name: "George Papadopoulos", email: "george@example.com", phone: "+30-694-4001", city: "Athens", country: "Greece", created_at: new Date("2025-01-01") },
  { _id: 8, name: "Hana Tanaka", email: "hana@example.com", phone: "+81-90-5001", city: "Tokyo", country: "Japan", created_at: new Date("2025-01-01") },
  { _id: 9, name: "Ivan Petrov", email: "ivan@example.com", phone: "+7-916-6001", city: "Moscow", country: "Russia", created_at: new Date("2025-01-01") },
  { _id: 10, name: "Julia Santos", email: "julia@example.com", phone: "+55-11-7001", city: "São Paulo", country: "Brazil", created_at: new Date("2025-01-01") },
  { _id: 11, name: "Kevin O'Brien", email: "kevin@example.com", phone: "+353-87-8001", city: "Dublin", country: "Ireland", created_at: new Date("2025-01-01") },
  { _id: 12, name: "Leila Ahmadi", email: "leila@example.com", phone: "+98-912-9001", city: "Tehran", country: "Iran", created_at: new Date("2025-01-01") },
  { _id: 13, name: "Marco Rossi", email: "marco@example.com", phone: "+39-348-1002", city: "Rome", country: "Italy", created_at: new Date("2025-01-01") },
  { _id: 14, name: "Nina Johansson", email: "nina@example.com", phone: "+46-70-2002", city: "Stockholm", country: "Sweden", created_at: new Date("2025-01-01") },
  { _id: 15, name: "Oscar Nguyen", email: "oscar@example.com", phone: "+84-90-3002", city: "Ho Chi Minh City", country: "Vietnam", created_at: new Date("2025-01-01") },
  { _id: 16, name: "Priya Sharma", email: "priya@example.com", phone: "+91-98-4002", city: "Mumbai", country: "India", created_at: new Date("2025-01-01") },
  { _id: 17, name: "Quentin Dubois", email: "quentin@example.com", phone: "+33-6-5002", city: "Paris", country: "France", created_at: new Date("2025-01-01") },
  { _id: 18, name: "Rosa Hernández", email: "rosa@example.com", phone: "+52-55-6002", city: "Mexico City", country: "Mexico", created_at: new Date("2025-01-01") },
  { _id: 19, name: "Sven Eriksson", email: "sven@example.com", phone: "+46-73-7002", city: "Gothenburg", country: "Sweden", created_at: new Date("2025-01-01") },
  { _id: 20, name: "Tanya Kowalski", email: "tanya@example.com", phone: "+48-600-8002", city: "Warsaw", country: "Poland", created_at: new Date("2025-01-01") }
]);

// Products (20)
db.products.insertMany([
  { _id: 1, name: "Wireless Mouse", category: "Electronics", price: 29.99, stock: 150, created_at: new Date("2025-01-01") },
  { _id: 2, name: "Mechanical Keyboard", category: "Electronics", price: 89.99, stock: 75, created_at: new Date("2025-01-01") },
  { _id: 3, name: "USB-C Hub", category: "Electronics", price: 49.99, stock: 200, created_at: new Date("2025-01-01") },
  { _id: 4, name: "Laptop Stand", category: "Accessories", price: 39.99, stock: 120, created_at: new Date("2025-01-01") },
  { _id: 5, name: "Webcam HD 1080p", category: "Electronics", price: 59.99, stock: 90, created_at: new Date("2025-01-01") },
  { _id: 6, name: "Noise-Cancelling Headphones", category: "Audio", price: 199.99, stock: 60, created_at: new Date("2025-01-01") },
  { _id: 7, name: "Bluetooth Speaker", category: "Audio", price: 79.99, stock: 110, created_at: new Date("2025-01-01") },
  { _id: 8, name: "Monitor 27\"", category: "Electronics", price: 349.99, stock: 40, created_at: new Date("2025-01-01") },
  { _id: 9, name: "Desk Lamp LED", category: "Home Office", price: 34.99, stock: 200, created_at: new Date("2025-01-01") },
  { _id: 10, name: "Ergonomic Chair", category: "Furniture", price: 499.99, stock: 25, created_at: new Date("2025-01-01") },
  { _id: 11, name: "Standing Desk", category: "Furniture", price: 599.99, stock: 15, created_at: new Date("2025-01-01") },
  { _id: 12, name: "Cable Management Kit", category: "Accessories", price: 19.99, stock: 300, created_at: new Date("2025-01-01") },
  { _id: 13, name: "Wireless Charger", category: "Electronics", price: 24.99, stock: 180, created_at: new Date("2025-01-01") },
  { _id: 14, name: "External SSD 1TB", category: "Storage", price: 109.99, stock: 85, created_at: new Date("2025-01-01") },
  { _id: 15, name: "Mouse Pad XL", category: "Accessories", price: 14.99, stock: 250, created_at: new Date("2025-01-01") },
  { _id: 16, name: "Screen Protector", category: "Accessories", price: 9.99, stock: 500, created_at: new Date("2025-01-01") },
  { _id: 17, name: "Portable Monitor 15\"", category: "Electronics", price: 249.99, stock: 35, created_at: new Date("2025-01-01") },
  { _id: 18, name: "USB Microphone", category: "Audio", price: 69.99, stock: 95, created_at: new Date("2025-01-01") },
  { _id: 19, name: "Desk Organizer", category: "Home Office", price: 27.99, stock: 140, created_at: new Date("2025-01-01") },
  { _id: 20, name: "Laptop Backpack", category: "Accessories", price: 59.99, stock: 100, created_at: new Date("2025-01-01") }
]);

// Orders with embedded items (30 orders, ~50 items total)
db.orders.insertMany([
  { _id: 1, customer_id: 1, status: "completed", total: 119.98, created_at: new Date("2025-01-05T10:30:00Z"), items: [
    { product_id: 1, name: "Wireless Mouse", quantity: 2, unit_price: 29.99 },
    { product_id: 15, name: "Mouse Pad XL", quantity: 2, unit_price: 14.99 },
    { product_id: 16, name: "Screen Protector", quantity: 2, unit_price: 9.99 }
  ]},
  { _id: 2, customer_id: 2, status: "completed", total: 349.99, created_at: new Date("2025-01-07T14:20:00Z"), items: [
    { product_id: 8, name: "Monitor 27\"", quantity: 1, unit_price: 349.99 }
  ]},
  { _id: 3, customer_id: 3, status: "completed", total: 89.99, created_at: new Date("2025-01-10T09:15:00Z"), items: [
    { product_id: 2, name: "Mechanical Keyboard", quantity: 1, unit_price: 89.99 }
  ]},
  { _id: 4, customer_id: 4, status: "shipped", total: 259.98, created_at: new Date("2025-01-12T16:45:00Z"), items: [
    { product_id: 6, name: "Noise-Cancelling Headphones", quantity: 1, unit_price: 199.99 },
    { product_id: 18, name: "USB Microphone", quantity: 1, unit_price: 69.99 }
  ]},
  { _id: 5, customer_id: 5, status: "completed", total: 499.99, created_at: new Date("2025-01-15T11:00:00Z"), items: [
    { product_id: 10, name: "Ergonomic Chair", quantity: 1, unit_price: 499.99 }
  ]},
  { _id: 6, customer_id: 6, status: "completed", total: 79.99, created_at: new Date("2025-01-18T13:30:00Z"), items: [
    { product_id: 7, name: "Bluetooth Speaker", quantity: 1, unit_price: 79.99 }
  ]},
  { _id: 7, customer_id: 7, status: "shipped", total: 174.98, created_at: new Date("2025-01-20T08:45:00Z"), items: [
    { product_id: 3, name: "USB-C Hub", quantity: 1, unit_price: 49.99 },
    { product_id: 13, name: "Wireless Charger", quantity: 2, unit_price: 24.99 },
    { product_id: 15, name: "Mouse Pad XL", quantity: 1, unit_price: 14.99 },
    { product_id: 12, name: "Cable Management Kit", quantity: 2, unit_price: 19.99 }
  ]},
  { _id: 8, customer_id: 8, status: "completed", total: 599.99, created_at: new Date("2025-01-22T17:10:00Z"), items: [
    { product_id: 11, name: "Standing Desk", quantity: 1, unit_price: 599.99 }
  ]},
  { _id: 9, customer_id: 9, status: "pending", total: 139.98, created_at: new Date("2025-01-25T10:00:00Z"), items: [
    { product_id: 2, name: "Mechanical Keyboard", quantity: 1, unit_price: 89.99 },
    { product_id: 3, name: "USB-C Hub", quantity: 1, unit_price: 49.99 }
  ]},
  { _id: 10, customer_id: 10, status: "completed", total: 109.99, created_at: new Date("2025-01-28T12:30:00Z"), items: [
    { product_id: 14, name: "External SSD 1TB", quantity: 1, unit_price: 109.99 }
  ]},
  { _id: 11, customer_id: 11, status: "shipped", total: 449.98, created_at: new Date("2025-02-01T09:20:00Z"), items: [
    { product_id: 8, name: "Monitor 27\"", quantity: 1, unit_price: 349.99 },
    { product_id: 4, name: "Laptop Stand", quantity: 1, unit_price: 39.99 },
    { product_id: 15, name: "Mouse Pad XL", quantity: 2, unit_price: 14.99 },
    { product_id: 1, name: "Wireless Mouse", quantity: 1, unit_price: 29.99 }
  ]},
  { _id: 12, customer_id: 12, status: "completed", total: 29.99, created_at: new Date("2025-02-03T15:45:00Z"), items: [
    { product_id: 1, name: "Wireless Mouse", quantity: 1, unit_price: 29.99 }
  ]},
  { _id: 13, customer_id: 13, status: "completed", total: 199.99, created_at: new Date("2025-02-05T11:30:00Z"), items: [
    { product_id: 6, name: "Noise-Cancelling Headphones", quantity: 1, unit_price: 199.99 }
  ]},
  { _id: 14, customer_id: 14, status: "cancelled", total: 59.99, created_at: new Date("2025-02-08T14:00:00Z"), items: [
    { product_id: 5, name: "Webcam HD 1080p", quantity: 1, unit_price: 59.99 }
  ]},
  { _id: 15, customer_id: 15, status: "completed", total: 304.97, created_at: new Date("2025-02-10T10:15:00Z"), items: [
    { product_id: 17, name: "Portable Monitor 15\"", quantity: 1, unit_price: 249.99 },
    { product_id: 9, name: "Desk Lamp LED", quantity: 1, unit_price: 34.99 },
    { product_id: 12, name: "Cable Management Kit", quantity: 1, unit_price: 19.99 }
  ]},
  { _id: 16, customer_id: 1, status: "shipped", total: 69.99, created_at: new Date("2025-02-12T16:30:00Z"), items: [
    { product_id: 18, name: "USB Microphone", quantity: 1, unit_price: 69.99 }
  ]},
  { _id: 17, customer_id: 16, status: "completed", total: 249.99, created_at: new Date("2025-02-15T09:45:00Z"), items: [
    { product_id: 17, name: "Portable Monitor 15\"", quantity: 1, unit_price: 249.99 }
  ]},
  { _id: 18, customer_id: 17, status: "pending", total: 89.98, created_at: new Date("2025-02-18T13:00:00Z"), items: [
    { product_id: 2, name: "Mechanical Keyboard", quantity: 1, unit_price: 89.99 }
  ]},
  { _id: 19, customer_id: 18, status: "completed", total: 534.98, created_at: new Date("2025-02-20T11:20:00Z"), items: [
    { product_id: 10, name: "Ergonomic Chair", quantity: 1, unit_price: 499.99 },
    { product_id: 9, name: "Desk Lamp LED", quantity: 1, unit_price: 34.99 }
  ]},
  { _id: 20, customer_id: 19, status: "completed", total: 34.99, created_at: new Date("2025-02-22T15:30:00Z"), items: [
    { product_id: 9, name: "Desk Lamp LED", quantity: 1, unit_price: 34.99 }
  ]},
  { _id: 21, customer_id: 20, status: "shipped", total: 129.98, created_at: new Date("2025-02-25T08:00:00Z"), items: [
    { product_id: 4, name: "Laptop Stand", quantity: 1, unit_price: 39.99 },
    { product_id: 2, name: "Mechanical Keyboard", quantity: 1, unit_price: 89.99 }
  ]},
  { _id: 22, customer_id: 2, status: "completed", total: 199.99, created_at: new Date("2025-02-28T12:45:00Z"), items: [
    { product_id: 6, name: "Noise-Cancelling Headphones", quantity: 1, unit_price: 199.99 }
  ]},
  { _id: 23, customer_id: 5, status: "pending", total: 79.99, created_at: new Date("2025-03-02T10:30:00Z"), items: [
    { product_id: 7, name: "Bluetooth Speaker", quantity: 1, unit_price: 79.99 }
  ]},
  { _id: 24, customer_id: 8, status: "completed", total: 49.99, created_at: new Date("2025-03-05T14:15:00Z"), items: [
    { product_id: 3, name: "USB-C Hub", quantity: 1, unit_price: 49.99 }
  ]},
  { _id: 25, customer_id: 3, status: "completed", total: 159.98, created_at: new Date("2025-03-08T09:00:00Z"), items: [
    { product_id: 5, name: "Webcam HD 1080p", quantity: 1, unit_price: 59.99 },
    { product_id: 4, name: "Laptop Stand", quantity: 1, unit_price: 39.99 },
    { product_id: 15, name: "Mouse Pad XL", quantity: 1, unit_price: 14.99 },
    { product_id: 16, name: "Screen Protector", quantity: 3, unit_price: 9.99 }
  ]},
  { _id: 26, customer_id: 11, status: "shipped", total: 699.98, created_at: new Date("2025-03-10T16:00:00Z"), items: [
    { product_id: 11, name: "Standing Desk", quantity: 1, unit_price: 599.99 },
    { product_id: 4, name: "Laptop Stand", quantity: 1, unit_price: 39.99 },
    { product_id: 15, name: "Mouse Pad XL", quantity: 2, unit_price: 14.99 }
  ]},
  { _id: 27, customer_id: 14, status: "completed", total: 24.99, created_at: new Date("2025-03-12T11:45:00Z"), items: [
    { product_id: 13, name: "Wireless Charger", quantity: 1, unit_price: 24.99 }
  ]},
  { _id: 28, customer_id: 6, status: "completed", total: 419.98, created_at: new Date("2025-03-15T13:30:00Z"), items: [
    { product_id: 8, name: "Monitor 27\"", quantity: 1, unit_price: 349.99 },
    { product_id: 18, name: "USB Microphone", quantity: 1, unit_price: 69.99 }
  ]},
  { _id: 29, customer_id: 9, status: "pending", total: 59.99, created_at: new Date("2025-03-18T10:00:00Z"), items: [
    { product_id: 5, name: "Webcam HD 1080p", quantity: 1, unit_price: 59.99 }
  ]},
  { _id: 30, customer_id: 20, status: "completed", total: 89.99, created_at: new Date("2025-03-20T15:00:00Z"), items: [
    { product_id: 2, name: "Mechanical Keyboard", quantity: 1, unit_price: 89.99 }
  ]}
]);

// Create indexes
db.customers.createIndex({ email: 1 }, { unique: true });
db.orders.createIndex({ customer_id: 1 });
db.orders.createIndex({ status: 1 });
