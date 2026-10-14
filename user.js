const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

// Parse command-line arguments
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && i + 1 < args.length) {
      result.user = args[i + 1];
      i++;
    } else if (args[i] === '--password' && i + 1 < args.length) {
      result.password = args[i + 1];
      i++;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

if (!args.user || !args.password) {
  console.error('Usage: node user.js --user <username> --password <password>');
  console.error('Example: node user.js --user testuser --password secret123');
  process.exit(1);
}

// Generate salt and hash
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(args.password, salt, 100000, 64, 'sha512').toString('hex');

// Load existing users
let users = [];
try {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  users = JSON.parse(data);
} catch (err) {
  console.error('Warning: Could not load users.json, creating new file.');
}

// Check if user already exists
const existingIndex = users.findIndex(u => u.user === args.user);
if (existingIndex !== -1) {
  users[existingIndex] = { user: args.user, salt, hash };
  console.log(`Updated user: ${args.user}`);
} else {
  users.push({ user: args.user, salt, hash });
  console.log(`Added user: ${args.user}`);
}

// Save to file
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + '\n', 'utf-8');
console.log('Users saved to:', USERS_FILE);
