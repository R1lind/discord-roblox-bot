const express = require('express'); // ADD THIS LINE
const app = express(); // ADD THIS LINE
const { Client, GatewayIntentBits, Events, Collection, MessageFlags } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');
const { db, setupDatabase } = require('./database.js');
require('dotenv').config();

// --- WEB SERVER SETUP ---
// Render needs a web server to know your app is running correctly.
// This simple server won't interfere with your bot.
const port = process.env.PORT || 3000; // Use the port Render provides, or 3000 for local testing
app.get('/', (req, res) => {
  res.send('Bot is running!'); // A simple health check endpoint
});
// --- END WEB SERVER SETUP ---


// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

// Login to Roblox
async function loginToRoblox() {
    try {
        await noblox.setCookie(process.env.ROBLOX_COOKIE);
        const currentUser = await noblox.getAuthenticatedUser();
        console.log('Successfully logged into Roblox as:', currentUser.name);
    } catch (err) {
        console.error('Failed to log into Roblox:', err);
    }
}
loginToRoblox();

// Set up the database tables
setupDatabase();

// Load commands from the /commands directory
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Handle new member join
client.on(Events.GuildMemberAdd, async member => {
    console.log(`New member joined: ${member.user.tag}`);
    const role = member.guild.roles.cache.get(config.defaultRole);
    if (role) {
        try {
            await member.roles.add(role);
            console.log(`Added default role to ${member.user.tag}`);
        } catch (error) {
            console.error(`Error adding default role to ${member.user.tag}:`, error);
        }
    } else {
        console.error(`Default role with ID ${config.defaultRole} not found.`);
    }
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
    }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// --- START WEB SERVER ---
// This starts the web server, which must be done after the bot logs in.
app.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});
// --- END WEB SERVER SETUP ---