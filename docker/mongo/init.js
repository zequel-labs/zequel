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

// ============================================================
// Categories collection
// ============================================================
db.categories.insertMany([
  { _id: 1, name: "Electronics", slug: "electronics", description: "Electronic devices and gadgets", parent_id: null, sort_order: 1, active: true },
  { _id: 2, name: "Audio", slug: "audio", description: "Audio equipment and accessories", parent_id: 1, sort_order: 2, active: true },
  { _id: 3, name: "Accessories", slug: "accessories", description: "Computer and desk accessories", parent_id: null, sort_order: 3, active: true },
  { _id: 4, name: "Furniture", slug: "furniture", description: "Office furniture", parent_id: null, sort_order: 4, active: true },
  { _id: 5, name: "Home Office", slug: "home-office", description: "Home office supplies", parent_id: null, sort_order: 5, active: true },
  { _id: 6, name: "Storage", slug: "storage", description: "Storage devices", parent_id: 1, sort_order: 6, active: true },
  { _id: 7, name: "Cables", slug: "cables", description: "Cables and adapters", parent_id: 3, sort_order: 7, active: false },
  { _id: 8, name: "Monitors", slug: "monitors", description: "Computer monitors and displays", parent_id: 1, sort_order: 8, active: true }
]);

// ============================================================
// Reviews collection
// ============================================================
db.reviews.insertMany([
  { _id: 1, product_id: 1, customer_id: 1, rating: 5, title: "Great mouse!", comment: "Very responsive and comfortable.", helpful_votes: 12, verified_purchase: true, created_at: new Date("2025-01-10") },
  { _id: 2, product_id: 1, customer_id: 3, rating: 4, title: "Good value", comment: "Works well for the price.", helpful_votes: 5, verified_purchase: true, created_at: new Date("2025-01-15") },
  { _id: 3, product_id: 2, customer_id: 5, rating: 5, title: "Best keyboard ever", comment: "Cherry MX switches are amazing. Build quality is superb.", helpful_votes: 23, verified_purchase: true, created_at: new Date("2025-01-20") },
  { _id: 4, product_id: 6, customer_id: 4, rating: 5, title: "Incredible noise cancellation", comment: "These headphones are a game changer for working from home.", helpful_votes: 45, verified_purchase: true, created_at: new Date("2025-01-25") },
  { _id: 5, product_id: 6, customer_id: 13, rating: 4, title: "Very good but pricey", comment: "Sound quality is excellent but a bit expensive.", helpful_votes: 8, verified_purchase: true, created_at: new Date("2025-02-01") },
  { _id: 6, product_id: 8, customer_id: 2, rating: 5, title: "Stunning display", comment: "Colors are vibrant, great for photo editing.", helpful_votes: 31, verified_purchase: true, created_at: new Date("2025-02-05") },
  { _id: 7, product_id: 10, customer_id: 5, rating: 5, title: "My back thanks me", comment: "Best investment for home office. Very comfortable.", helpful_votes: 67, verified_purchase: true, created_at: new Date("2025-02-10") },
  { _id: 8, product_id: 11, customer_id: 8, rating: 4, title: "Solid standing desk", comment: "Good build quality, smooth height adjustment.", helpful_votes: 19, verified_purchase: true, created_at: new Date("2025-02-15") },
  { _id: 9, product_id: 14, customer_id: 10, rating: 5, title: "Fast and reliable", comment: "Transfer speeds are incredible. Highly recommend.", helpful_votes: 14, verified_purchase: true, created_at: new Date("2025-02-20") },
  { _id: 10, product_id: 3, customer_id: 7, rating: 3, title: "Decent hub", comment: "Works fine but gets hot after extended use.", helpful_votes: 7, verified_purchase: true, created_at: new Date("2025-02-25") },
  { _id: 11, product_id: 5, customer_id: 14, rating: 4, title: "Good webcam", comment: "Sharp image, good microphone built in.", helpful_votes: 3, verified_purchase: false, created_at: new Date("2025-03-01") },
  { _id: 12, product_id: 17, customer_id: 15, rating: 5, title: "Perfect travel monitor", comment: "Lightweight and the display quality is impressive.", helpful_votes: 22, verified_purchase: true, created_at: new Date("2025-03-05") },
  { _id: 13, product_id: 7, customer_id: 6, rating: 4, title: "Good sound", comment: "Battery life is great, sound is clear.", helpful_votes: 9, verified_purchase: true, created_at: new Date("2025-03-10") },
  { _id: 14, product_id: 18, customer_id: 16, rating: 5, title: "Studio quality", comment: "Amazing mic for the price. Great for podcasts.", helpful_votes: 35, verified_purchase: true, created_at: new Date("2025-03-15") },
  { _id: 15, product_id: 4, customer_id: 11, rating: 4, title: "Sturdy stand", comment: "Keeps my laptop at the perfect height.", helpful_votes: 6, verified_purchase: true, created_at: new Date("2025-03-18") }
]);

// ============================================================
// Inventory log collection (for tracking stock changes)
// ============================================================
db.inventory_log.insertMany([
  { _id: 1, product_id: 1, change: -2, reason: "sale", order_id: 1, previous_stock: 152, new_stock: 150, created_at: new Date("2025-01-05T10:30:00Z") },
  { _id: 2, product_id: 8, change: -1, reason: "sale", order_id: 2, previous_stock: 41, new_stock: 40, created_at: new Date("2025-01-07T14:20:00Z") },
  { _id: 3, product_id: 2, change: -1, reason: "sale", order_id: 3, previous_stock: 76, new_stock: 75, created_at: new Date("2025-01-10T09:15:00Z") },
  { _id: 4, product_id: 6, change: -1, reason: "sale", order_id: 4, previous_stock: 61, new_stock: 60, created_at: new Date("2025-01-12T16:45:00Z") },
  { _id: 5, product_id: 10, change: -1, reason: "sale", order_id: 5, previous_stock: 26, new_stock: 25, created_at: new Date("2025-01-15T11:00:00Z") },
  { _id: 6, product_id: 1, change: 50, reason: "restock", order_id: null, previous_stock: 150, new_stock: 200, created_at: new Date("2025-01-20T08:00:00Z") },
  { _id: 7, product_id: 2, change: 25, reason: "restock", order_id: null, previous_stock: 75, new_stock: 100, created_at: new Date("2025-01-20T08:00:00Z") },
  { _id: 8, product_id: 11, change: -1, reason: "sale", order_id: 8, previous_stock: 16, new_stock: 15, created_at: new Date("2025-01-22T17:10:00Z") },
  { _id: 9, product_id: 14, change: -1, reason: "sale", order_id: 10, previous_stock: 86, new_stock: 85, created_at: new Date("2025-01-28T12:30:00Z") },
  { _id: 10, product_id: 8, change: 20, reason: "restock", order_id: null, previous_stock: 40, new_stock: 60, created_at: new Date("2025-02-01T08:00:00Z") },
  { _id: 11, product_id: 6, change: -1, reason: "sale", order_id: 13, previous_stock: 60, new_stock: 59, created_at: new Date("2025-02-05T11:30:00Z") },
  { _id: 12, product_id: 5, change: -1, reason: "return", order_id: 14, previous_stock: 89, new_stock: 90, created_at: new Date("2025-02-09T10:00:00Z") },
  { _id: 13, product_id: 17, change: -1, reason: "sale", order_id: 15, previous_stock: 36, new_stock: 35, created_at: new Date("2025-02-10T10:15:00Z") },
  { _id: 14, product_id: 10, change: 10, reason: "restock", order_id: null, previous_stock: 25, new_stock: 35, created_at: new Date("2025-02-15T08:00:00Z") },
  { _id: 15, product_id: 2, change: -3, reason: "sale", order_id: null, previous_stock: 100, new_stock: 97, created_at: new Date("2025-03-01T12:00:00Z") }
]);

// ============================================================
// Shipping addresses collection
// ============================================================
db.shipping_addresses.insertMany([
  { _id: 1, customer_id: 1, label: "Home", street: "123 Main St", city: "New York", state: "NY", zip: "10001", country: "USA", is_default: true },
  { _id: 2, customer_id: 1, label: "Office", street: "456 Park Ave", city: "New York", state: "NY", zip: "10022", country: "USA", is_default: false },
  { _id: 3, customer_id: 2, label: "Home", street: "789 Sunset Blvd", city: "Los Angeles", state: "CA", zip: "90028", country: "USA", is_default: true },
  { _id: 4, customer_id: 3, label: "Home", street: "Calle Gran Vía 42", city: "Madrid", state: null, zip: "28013", country: "Spain", is_default: true },
  { _id: 5, customer_id: 5, label: "Home", street: "Friedrichstraße 100", city: "Berlin", state: null, zip: "10117", country: "Germany", is_default: true },
  { _id: 6, customer_id: 8, label: "Home", street: "1-2-3 Shibuya", city: "Tokyo", state: null, zip: "150-0002", country: "Japan", is_default: true },
  { _id: 7, customer_id: 10, label: "Home", street: "Av. Paulista 1000", city: "São Paulo", state: "SP", zip: "01310-100", country: "Brazil", is_default: true },
  { _id: 8, customer_id: 11, label: "Home", street: "42 O'Connell St", city: "Dublin", state: null, zip: "D01 X3P2", country: "Ireland", is_default: true },
  { _id: 9, customer_id: 16, label: "Home", street: "Marine Drive 500", city: "Mumbai", state: "MH", zip: "400002", country: "India", is_default: true },
  { _id: 10, customer_id: 17, label: "Home", street: "15 Rue de Rivoli", city: "Paris", state: null, zip: "75001", country: "France", is_default: true }
]);

// ============================================================
// Notifications collection
// ============================================================
db.notifications.insertMany([
  { _id: 1, customer_id: 1, type: "order_shipped", title: "Your order has shipped!", message: "Order #16 is on its way.", read: false, created_at: new Date("2025-02-12T17:00:00Z") },
  { _id: 2, customer_id: 2, type: "order_delivered", title: "Order delivered", message: "Order #22 has been delivered.", read: true, created_at: new Date("2025-03-03T10:00:00Z") },
  { _id: 3, customer_id: 4, type: "order_shipped", title: "Your order has shipped!", message: "Order #4 is on its way.", read: true, created_at: new Date("2025-01-13T09:00:00Z") },
  { _id: 4, customer_id: 5, type: "promotion", title: "20% off furniture!", message: "Use code OFFICE20 at checkout.", read: false, created_at: new Date("2025-03-01T08:00:00Z") },
  { _id: 5, customer_id: 7, type: "order_shipped", title: "Your order has shipped!", message: "Order #7 is on its way.", read: true, created_at: new Date("2025-01-21T09:00:00Z") },
  { _id: 6, customer_id: 8, type: "order_delivered", title: "Order delivered", message: "Order #24 has been delivered.", read: true, created_at: new Date("2025-03-08T10:00:00Z") },
  { _id: 7, customer_id: 11, type: "order_shipped", title: "Your order has shipped!", message: "Order #26 is on its way.", read: false, created_at: new Date("2025-03-11T09:00:00Z") },
  { _id: 8, customer_id: 14, type: "order_cancelled", title: "Order cancelled", message: "Order #14 has been cancelled and refunded.", read: true, created_at: new Date("2025-02-09T12:00:00Z") },
  { _id: 9, customer_id: 20, type: "promotion", title: "New arrivals!", message: "Check out our latest products.", read: false, created_at: new Date("2025-03-15T08:00:00Z") },
  { _id: 10, customer_id: 1, type: "review_reminder", title: "Review your purchase", message: "How was your Wireless Mouse?", read: false, created_at: new Date("2025-01-15T08:00:00Z") }
]);

// ============================================================
// Timeseries collection — site metrics
// ============================================================
db.createCollection('site_metrics', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'page',
    granularity: 'hours'
  }
});

db.site_metrics.insertMany([
  { timestamp: new Date("2025-01-01T00:00:00Z"), page: "/", visitors: 342, page_views: 891, bounce_rate: 0.32, avg_session_sec: 245 },
  { timestamp: new Date("2025-01-01T01:00:00Z"), page: "/", visitors: 128, page_views: 310, bounce_rate: 0.41, avg_session_sec: 180 },
  { timestamp: new Date("2025-01-01T02:00:00Z"), page: "/", visitors: 67, page_views: 142, bounce_rate: 0.55, avg_session_sec: 120 },
  { timestamp: new Date("2025-01-01T00:00:00Z"), page: "/products", visitors: 215, page_views: 678, bounce_rate: 0.18, avg_session_sec: 320 },
  { timestamp: new Date("2025-01-01T01:00:00Z"), page: "/products", visitors: 89, page_views: 234, bounce_rate: 0.25, avg_session_sec: 290 },
  { timestamp: new Date("2025-01-01T02:00:00Z"), page: "/products", visitors: 42, page_views: 98, bounce_rate: 0.38, avg_session_sec: 200 },
  { timestamp: new Date("2025-01-01T00:00:00Z"), page: "/checkout", visitors: 98, page_views: 156, bounce_rate: 0.08, avg_session_sec: 410 },
  { timestamp: new Date("2025-01-01T01:00:00Z"), page: "/checkout", visitors: 45, page_views: 72, bounce_rate: 0.11, avg_session_sec: 380 },
  { timestamp: new Date("2025-01-02T00:00:00Z"), page: "/", visitors: 380, page_views: 945, bounce_rate: 0.29, avg_session_sec: 260 },
  { timestamp: new Date("2025-01-02T01:00:00Z"), page: "/", visitors: 145, page_views: 356, bounce_rate: 0.37, avg_session_sec: 195 },
  { timestamp: new Date("2025-01-02T00:00:00Z"), page: "/products", visitors: 240, page_views: 720, bounce_rate: 0.16, avg_session_sec: 340 },
  { timestamp: new Date("2025-01-02T01:00:00Z"), page: "/products", visitors: 102, page_views: 267, bounce_rate: 0.22, avg_session_sec: 305 },
  { timestamp: new Date("2025-01-02T00:00:00Z"), page: "/checkout", visitors: 112, page_views: 178, bounce_rate: 0.07, avg_session_sec: 425 },
  { timestamp: new Date("2025-01-02T01:00:00Z"), page: "/checkout", visitors: 53, page_views: 85, bounce_rate: 0.10, avg_session_sec: 395 },
  { timestamp: new Date("2025-01-03T00:00:00Z"), page: "/", visitors: 298, page_views: 762, bounce_rate: 0.35, avg_session_sec: 230 },
  { timestamp: new Date("2025-01-03T00:00:00Z"), page: "/products", visitors: 189, page_views: 545, bounce_rate: 0.20, avg_session_sec: 310 },
  { timestamp: new Date("2025-01-03T00:00:00Z"), page: "/checkout", visitors: 87, page_views: 139, bounce_rate: 0.09, avg_session_sec: 400 },
  { timestamp: new Date("2025-01-03T00:00:00Z"), page: "/blog", visitors: 156, page_views: 423, bounce_rate: 0.45, avg_session_sec: 185 },
  { timestamp: new Date("2025-01-03T01:00:00Z"), page: "/blog", visitors: 78, page_views: 198, bounce_rate: 0.52, avg_session_sec: 150 },
  { timestamp: new Date("2025-01-04T00:00:00Z"), page: "/", visitors: 410, page_views: 1020, bounce_rate: 0.27, avg_session_sec: 275 },
  { timestamp: new Date("2025-01-04T00:00:00Z"), page: "/products", visitors: 265, page_views: 790, bounce_rate: 0.15, avg_session_sec: 350 },
  { timestamp: new Date("2025-01-04T00:00:00Z"), page: "/checkout", visitors: 125, page_views: 198, bounce_rate: 0.06, avg_session_sec: 440 },
  { timestamp: new Date("2025-01-04T00:00:00Z"), page: "/blog", visitors: 178, page_views: 467, bounce_rate: 0.42, avg_session_sec: 195 },
  { timestamp: new Date("2025-01-04T00:00:00Z"), page: "/contact", visitors: 45, page_views: 52, bounce_rate: 0.60, avg_session_sec: 90 }
]);

// ============================================================
// Indexes
// ============================================================
db.customers.createIndex({ email: 1 }, { unique: true });
db.orders.createIndex({ customer_id: 1 });
db.orders.createIndex({ status: 1 });
db.categories.createIndex({ slug: 1 }, { unique: true });
db.categories.createIndex({ parent_id: 1 });
db.reviews.createIndex({ product_id: 1 });
db.reviews.createIndex({ customer_id: 1 });
db.reviews.createIndex({ rating: -1 });
db.inventory_log.createIndex({ product_id: 1 });
db.inventory_log.createIndex({ created_at: -1 });
db.shipping_addresses.createIndex({ customer_id: 1 });
db.notifications.createIndex({ customer_id: 1 });
db.notifications.createIndex({ type: 1 });

// ============================================================
// Views
// ============================================================

// Customer order summary
db.createView('customer_order_summary', 'customers', [
  { $lookup: { from: 'orders', localField: '_id', foreignField: 'customer_id', as: 'orders' } },
  { $project: {
    name: 1,
    email: 1,
    country: 1,
    order_count: { $size: '$orders' },
    total_spent: { $sum: '$orders.total' }
  }}
]);

// Product catalog with stock status
db.createView('product_catalog', 'products', [
  { $project: {
    name: 1,
    category: 1,
    price: 1,
    stock: 1,
    in_stock: { $gt: ['$stock', 0] }
  }}
]);

// Recent orders with item count
db.createView('recent_orders', 'orders', [
  { $sort: { created_at: -1 } },
  { $limit: 50 },
  { $project: {
    customer_id: 1,
    status: 1,
    total: 1,
    created_at: 1,
    item_count: { $size: '$items' }
  }}
]);

// Top rated products
db.createView('top_rated_products', 'reviews', [
  { $group: {
    _id: '$product_id',
    avg_rating: { $avg: '$rating' },
    review_count: { $sum: 1 },
    total_helpful_votes: { $sum: '$helpful_votes' }
  }},
  { $sort: { avg_rating: -1, review_count: -1 } },
  { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
  { $unwind: '$product' },
  { $project: {
    product_name: '$product.name',
    category: '$product.category',
    price: '$product.price',
    avg_rating: { $round: ['$avg_rating', 1] },
    review_count: 1,
    total_helpful_votes: 1
  }}
]);

// Active categories with product count
db.createView('active_categories', 'categories', [
  { $match: { active: true } },
  { $lookup: { from: 'products', localField: 'name', foreignField: 'category', as: 'products' } },
  { $project: {
    name: 1,
    slug: 1,
    description: 1,
    parent_id: 1,
    product_count: { $size: '$products' }
  }}
]);

// Low stock alerts
db.createView('low_stock_alerts', 'products', [
  { $match: { stock: { $lte: 30 } } },
  { $sort: { stock: 1 } },
  { $project: {
    name: 1,
    category: 1,
    stock: 1,
    price: 1,
    needs_restock: { $lte: ['$stock', 10] }
  }}
]);

// Unread notifications
db.createView('unread_notifications', 'notifications', [
  { $match: { read: false } },
  { $sort: { created_at: -1 } },
  { $lookup: { from: 'customers', localField: 'customer_id', foreignField: '_id', as: 'customer' } },
  { $unwind: '$customer' },
  { $project: {
    customer_name: '$customer.name',
    type: 1,
    title: 1,
    message: 1,
    created_at: 1
  }}
]);
