const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../database.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unverify')
        .setDescription('[STAFF] Removes a user\'s verification data from the database.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unverify.')
                .setRequired(true)),
    async execute(interaction) {
        // --- STAFF SECURITY CHECK ---
        if (!interaction.member.roles.cache.has(config.staffRoleId)) {
            return await interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
        }

        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRole);
        const defaultRole = interaction.guild.roles.cache.get(config.defaultRole);

        try {
            // --- DATABASE DELETE LOGIC ---
            const stmt = db.prepare('DELETE FROM verified_users WHERE discord_id = ?');
            const result = stmt.run(targetUser.id);
            
            if (result.changes === 0) {
                return await interaction.reply({ content: `${targetUser.tag} was not found in the verification database.`, flags: [MessageFlags.Ephemeral] });
            }
            console.log(`[DATABASE] ${interaction.user.tag} unverified ${targetUser.tag}.`);
            // --- END DATABASE DELETE LOGIC ---

            // --- ROLE REMOVAL LOGIC ---
            if (verifiedRole && targetMember.roles.cache.has(verifiedRole.id)) {
                await targetMember.roles.remove(verifiedRole);
                console.log(`[ROLE] Removed 'Verified' role from ${targetUser.tag}.`);
            }
            if (defaultRole && !targetMember.roles.cache.has(defaultRole.id)) {
                await targetMember.roles.add(defaultRole);
                console.log(`[ROLE] Added 'Outsider' role to ${targetUser.tag}.`);
            }
            // --- END ROLE REMOVAL LOGIC ---

            const embed = new EmbedBuilder()
                .setTitle('User Unverified')
                .setColor(0xFFA500)
                .setDescription(`Successfully unverified ${targetUser.tag}. They can now re-verify.`)
                .setFooter({ text: `Executed by ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: `An error occurred: ${error.message}`, flags: [MessageFlags.Ephemeral] });
        }
    },
};