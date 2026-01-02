const Database = require('better-sqlite3');
const path = require('path');

// Create a path to the database file in the same folder
const dbPath = path.join(__dirname, 'database.db');

// Connect to the database (or create it if it doesn't exist)
const db = new Database(dbPath);

// Function to set up the database tables
function setupDatabase() {
    // Create a table to store verified users
    // IF NOT EXISTS prevents an error if the table already exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS verified_users (
            discord_id TEXT PRIMARY KEY,
            roblox_id INTEGER NOT NULL,
            roblox_username TEXT NOT NULL
        )
    `);
    console.log('Database is ready.');
}

// Export the database object and the setup function
module.exports = {
    db,
    setupDatabase
};