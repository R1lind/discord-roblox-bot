const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database.js');
const { pendingVerifications } = require('./verificationStore'); // Import from our new store

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account to link it to your Discord.'),
    async execute(interaction) {
        // --- SECURITY CHECK ---
        if (interaction.guild.id !== process.env.DISCORD_GUILD_ID) {
            return await interaction.reply({ content: 'This command cannot be used here.', flags: [MessageFlags.Ephemeral] });
        }

        const userId = interaction.user.id;

        // --- CHECK IF ALREADY VERIFIED ---
        const stmt = db.prepare('SELECT 1 FROM verified_users WHERE discord_id = ?');
        const isVerified = stmt.get(userId);

        if (isVerified) {
            return await interaction.reply({ content: 'You are already verified.', flags: [MessageFlags.Ephemeral] });
        }
        // --- END CHECK ---

        // Remove any existing verification for this user
        if (pendingVerifications.has(userId)) {
            pendingVerifications.delete(userId);
        }

        const verificationCode = uuidv4().substring(0, 8).toUpperCase();

        pendingVerifications.set(userId, {
            code: verificationCode,
            timestamp: Date.now(),
        });

        console.log(`[VERIFY] Generated code ${verificationCode} for user ${interaction.user.tag}`);

        const embed = new EmbedBuilder()
            .setTitle('Roblox Verification')
            .setColor(0x0099FF)
            .setDescription('To complete verification, put the code below in your **Roblox About Me** section.')
            .addFields(
                { name: 'Your Verification Code', value: `\`${verificationCode}\`` },
                { name: 'Instructions', value: '1. Go to your Roblox profile\n2. Click "Edit Profile"\n3. Paste the code in the "About" box\n4. Click "Save"\n5. Run `/checkverify`' }
            )
            .setFooter({ text: 'This code expires in 10 minutes.' });

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });

        // Set a timeout to remove the verification code after 10 minutes
        setTimeout(() => {
            if (pendingVerifications.has(userId)) {
                console.log(`[VERIFY] Expired verification code for user ${userId}`);
                pendingVerifications.delete(userId);
            }
        }, 10 * 60 * 1000);
    },
};