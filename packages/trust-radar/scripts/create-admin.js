#!/usr/bin/env node
// Usage: node scripts/create-admin.js <email> <password> [plan]
// Outputs the wrangler d1 execute commands to create an admin user.

const [email, password, plan = "enterprise"] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/create-admin.js <email> <password> [plan]");
  process.exit(1);
}

const crypto = require("crypto");
const hash = crypto.createHash("sha256").update(password).digest("hex");
const id = crypto.randomUUID();

const sql = `INSERT INTO users (id, email, password_hash, plan, scans_limit, is_admin) VALUES ('${id}', '${email}', '${hash}', '${plan}', 99999, 1);`;

console.log("\n── Local (dev) ──────────────────────────────────────────────");
console.log(`npx wrangler d1 execute radar-db --local --command "${sql}"`);
console.log("\n── Production ───────────────────────────────────────────────");
console.log(`npx wrangler d1 execute radar-db --remote --command "${sql}"`);
console.log("\nCredentials:");
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log(`  Plan:     ${plan}`);
console.log(`  ID:       ${id}\n`);
