const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../database.js');
const config = require('../config.json');
const axios = require('axios');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forceupdateall')
        .setDescription('[STAFF] Forces a role update for all verified users in the server.'),
    async execute(interaction) {
        // --- STAFF SECURITY CHECK ---
        if (!interaction.member.roles.cache.has(config.staffRoleId)) {
            return await interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ content: 'This will take a while. I will update you on my progress.', flags: [MessageFlags.Ephemeral] });

        try {
            // Get all verified users from the database
            const verifiedUsers = db.prepare('SELECT * FROM verified_users').all();
            const guild = interaction.guild;

            let updatedCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const user of verifiedUsers) {
                try {
                    const member = await guild.members.fetch(user.discord_id).catch(() => null);
                    if (!member) {
                        console.log(`[FORCE UPDATE] Could not find member ${user.discord_id}. Skipping.`);
                        continue;
                    }

                    // This is the same logic as your original updateroles command
                    const rolesResponse = await axios.get(`https://groups.roblox.com/v1/users/${user.roblox_id}/groups/roles`);
                    const userGroupRole = rolesResponse.data.data.find(group => group.group.id === 34630184);
                    
                    let userRank = 0;
                    if (userGroupRole) {
                        userRank = userGroupRole.role.rank;
                    }

                    const rolesToAdd = new Set();
                    const rankMap = config.groupRoleMappings[34630184];
                    if (rankMap && rankMap[userRank]) {
                        rolesToAdd.add(rankMap[userRank]);
                    }

                    const allGroupRoleIds = new Set();
                    for (const groupMap of Object.values(config.groupRoleMappings)) {
                        for (const roleId of Object.values(groupMap)) {
                            allGroupRoleIds.add(roleId);
                        }
                    }

                    const rolesToRemove = [];
                    member.roles.cache.forEach(role => {
                        if (allGroupRoleIds.has(role.id) && !rolesToAdd.has(role.id)) {
                            rolesToRemove.push(role.id);
                        }
                    });

                    if (rolesToAdd.size > 0) await member.roles.add(Array.from(rolesToAdd));
                    if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
                    
                    updatedCount++;
                    console.log(`[FORCE UPDATE] Successfully updated ${member.user.tag}`);

                } catch (e) {
                    errorCount++;
                    errors.push(`Failed to update ${user.roblox_username}: ${e.message}`);
                    console.error(`[FORCE UPDATE] Error for ${user.roblox_username}:`, e);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('Force Update Complete')
                .setColor(updatedCount > 0 ? 0x00FF00 : 0xFF0000)
                .setDescription(`Attempted to update ${verifiedUsers.length} verified users.`)
                .addFields(
                    { name: 'Successfully Updated', value: String(updatedCount), inline: true },
                    { name: 'Errors', value: String(errorCount), inline: true }
                )
                .setFooter({ text: `Executed by ${interaction.user.tag}` });

            if (errors.length > 0) {
                embed.addFields({ name: 'First Few Errors', value: errors.slice(0, 3).join('\n') });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `A critical error occurred: ${error.message}` });
        }
    },
};