#!/bin/sh
# Zequel seed data for Redis
# This script is run by the redis-seed sidecar service after Redis is ready.

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASS:-zequel}"

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "Redis is ready. Seeding data..."

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" <<'COMMANDS'

# ── Strings: app configuration ──
SET app:config:site_name "Zequel Store"
SET app:config:currency "USD"
SET app:config:tax_rate "0.08"
SET app:config:free_shipping_threshold "50"
SET app:config:max_cart_items "20"
SET app:config:session_ttl "3600"
SET app:config:maintenance_mode "false"

# ── Hashes: user profiles ──
HSET user:1 name "Alice Johnson" email "alice@example.com" city "New York" country "USA" orders "2" total_spent "189.97"
HSET user:2 name "Bob Smith" email "bob@example.com" city "Los Angeles" country "USA" orders "2" total_spent "549.98"
HSET user:3 name "Carlos García" email "carlos@example.com" city "Madrid" country "Spain" orders "2" total_spent "249.97"
HSET user:4 name "Diana Chen" email "diana@example.com" city "Shanghai" country "China" orders "1" total_spent "259.98"
HSET user:5 name "Erik Müller" email "erik@example.com" city "Berlin" country "Germany" orders "2" total_spent "579.98"
HSET user:6 name "Fatima Al-Rashid" email "fatima@example.com" city "Dubai" country "UAE" orders "2" total_spent "499.97"
HSET user:7 name "George Papadopoulos" email "george@example.com" city "Athens" country "Greece" orders "1" total_spent "174.98"
HSET user:8 name "Hana Tanaka" email "hana@example.com" city "Tokyo" country "Japan" orders "2" total_spent "649.98"
HSET user:9 name "Ivan Petrov" email "ivan@example.com" city "Moscow" country "Russia" orders "3" total_spent "339.96"
HSET user:10 name "Julia Santos" email "julia@example.com" city "São Paulo" country "Brazil" orders "1" total_spent "109.99"

# ── Lists: email queue ──
RPUSH queue:emails '{"to":"alice@example.com","subject":"Order Shipped","body":"Your order #16 has been shipped."}'
RPUSH queue:emails '{"to":"bob@example.com","subject":"Order Confirmation","body":"Thank you for your order #22."}'
RPUSH queue:emails '{"to":"erik@example.com","subject":"Welcome!","body":"Welcome to Zequel Store."}'
RPUSH queue:emails '{"to":"hana@example.com","subject":"Order Delivered","body":"Your order #8 has been delivered."}'
RPUSH queue:emails '{"to":"priya@example.com","subject":"New Products","body":"Check out our latest arrivals."}'
RPUSH queue:emails '{"to":"marco@example.com","subject":"Order Confirmation","body":"Thank you for your order #13."}'
RPUSH queue:emails '{"to":"nina@example.com","subject":"Refund Processed","body":"Your refund for order #14 has been processed."}'
RPUSH queue:emails '{"to":"kevin@example.com","subject":"Back in Stock","body":"Ergonomic Chair is back in stock!"}'

# ── Lists: recent orders ──
RPUSH queue:recent_orders "order:30" "order:29" "order:28" "order:27" "order:26" "order:25" "order:24" "order:23" "order:22" "order:21"

# ── Sets: popular tags ──
SADD tags:popular "electronics" "audio" "accessories" "home-office" "furniture" "storage" "new-arrival" "bestseller" "on-sale" "free-shipping"

# ── Sets: product categories ──
SADD categories:all "Electronics" "Audio" "Accessories" "Home Office" "Furniture" "Storage"

# ── Sets: active sessions ──
SADD sessions:active "sess:abc123" "sess:def456" "sess:ghi789" "sess:jkl012" "sess:mno345"

# ── Sorted Sets: leaderboard (customer spending) ──
ZADD leaderboard:spending 189.97 "Alice Johnson"
ZADD leaderboard:spending 549.98 "Bob Smith"
ZADD leaderboard:spending 249.97 "Carlos García"
ZADD leaderboard:spending 259.98 "Diana Chen"
ZADD leaderboard:spending 579.98 "Erik Müller"
ZADD leaderboard:spending 499.97 "Fatima Al-Rashid"
ZADD leaderboard:spending 174.98 "George Papadopoulos"
ZADD leaderboard:spending 649.98 "Hana Tanaka"
ZADD leaderboard:spending 339.96 "Ivan Petrov"
ZADD leaderboard:spending 109.99 "Julia Santos"
ZADD leaderboard:spending 449.98 "Kevin O'Brien"
ZADD leaderboard:spending 29.99 "Leila Ahmadi"
ZADD leaderboard:spending 199.99 "Marco Rossi"
ZADD leaderboard:spending 84.98 "Nina Johansson"
ZADD leaderboard:spending 304.97 "Oscar Nguyen"
ZADD leaderboard:spending 249.99 "Priya Sharma"
ZADD leaderboard:spending 89.98 "Quentin Dubois"
ZADD leaderboard:spending 534.98 "Rosa Hernández"
ZADD leaderboard:spending 34.99 "Sven Eriksson"
ZADD leaderboard:spending 219.97 "Tanya Kowalski"

# ── Sorted Sets: product popularity (views) ──
ZADD products:popular 342 "Wireless Mouse"
ZADD products:popular 289 "Mechanical Keyboard"
ZADD products:popular 256 "USB-C Hub"
ZADD products:popular 198 "Laptop Stand"
ZADD products:popular 187 "Webcam HD 1080p"
ZADD products:popular 312 "Noise-Cancelling Headphones"
ZADD products:popular 167 "Bluetooth Speaker"
ZADD products:popular 234 "Monitor 27in"
ZADD products:popular 145 "Desk Lamp LED"
ZADD products:popular 278 "Ergonomic Chair"

COMMANDS

echo "Redis seed data loaded successfully."
