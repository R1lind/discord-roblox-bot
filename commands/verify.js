const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

const pendingVerifications = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account to link it to your Discord.'),
    async execute(interaction) {
        // --- SECURITY CHECK: Ensure command is only used in the authorized server ---
        if (interaction.guild.id !== process.env.DISCORD_GUILD_ID) {
            return await interaction.reply({ content: 'This command cannot be used here.', flags: [MessageFlags.Ephemeral] });
        }

        const userId = interaction.user.id;
        const verificationCode = uuidv4().substring(0, 8).toUpperCase();

        pendingVerifications.set(userId, {
            code: verificationCode,
            timestamp: Date.now(),
        });

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

        setTimeout(() => {
            if (pendingVerifications.has(userId)) {
                pendingVerifications.delete(userId);
            }
        }, 10 * 60 * 1000);
    },
    pendingVerifications,
};