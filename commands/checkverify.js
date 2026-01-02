const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const noblox = require('noblox.js');
const { pendingVerifications } = require('./verify');
const { db } = require('../database.js');
const config = require('../config.json'); // Import config

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkverify')
        .setDescription('Checks your Roblox profile for the verification code.')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)),
    async execute(interaction) {
        // --- SECURITY CHECK ---
        if (interaction.guild.id !== process.env.DISCORD_GUILD_ID) {
            return await interaction.reply({ content: 'This command cannot be used here.', flags: [MessageFlags.Ephemeral] });
        }

        const userId = interaction.user.id;
        const robloxUsername = interaction.options.getString('username');

        if (!pendingVerifications.has(userId)) {
            return await interaction.reply({ content: 'You have no pending verification. Please run `/verify` first.', flags: [MessageFlags.Ephemeral] });
        }

        const verification = pendingVerifications.get(userId);

        try {
            const robloxId = await noblox.getIdFromUsername(robloxUsername);
            const userInfo = await noblox.getPlayerInfo(robloxId);

            if (userInfo.blurb && userInfo.blurb.includes(verification.code)) {
                pendingVerifications.delete(userId);

                // --- DATABASE SAVE LOGIC ---
                const stmt = db.prepare('INSERT OR REPLACE INTO verified_users (discord_id, roblox_id, roblox_username) VALUES (?, ?, ?)');
                stmt.run(userId, robloxId, robloxUsername);
                console.log(`[DATABASE] Saved verification for ${interaction.user.tag} -> ${robloxUsername}`);
                // --- END DATABASE SAVE LOGIC ---

                // --- ROLE ASSIGNMENT LOGIC ---
                const member = interaction.member;
                const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRole);
                const defaultRole = interaction.guild.roles.cache.get(config.defaultRole);

                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                    console.log(`[ROLE] Added 'Verified' role to ${member.user.tag}`);
                }
                if (defaultRole && member.roles.cache.has(defaultRole.id)) {
                    await member.roles.remove(defaultRole);
                    console.log(`[ROLE] Removed 'Outsider' role from ${member.user.tag}`);
                }
                // --- END ROLE ASSIGNMENT LOGIC ---

                const embed = new EmbedBuilder()
                    .setTitle('Verification Successful!')
                    .setColor(0x00FF00)
                    .setDescription(`Your Discord account is now linked to **${robloxUsername}**.`)
                    .addFields({ name: 'Next Step', value: 'Use `/updateroles` to get your group roles.' });
                return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('Verification Failed')
                    .setColor(0xFF0000)
                    .setDescription(`Could not find the code \`${verification.code}\` in **${robloxUsername}**'s profile.`)
                    .addFields({ name: 'Troubleshooting', value: 'Ensure you saved your profile and the code is in the "About Me" section.' });
                return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
            }
        } catch (error) {
            console.error(error);
            return await interaction.reply({ content: `An error occurred: ${error.message}`, flags: [MessageFlags.Ephemeral] });
        }
    },
};