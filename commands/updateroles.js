const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const noblox = require('noblox.js');
const config = require('../config.json');
const { db } = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updateroles')
        .setDescription('Updates your Discord roles based on your verified Roblox account.'),
    async execute(interaction) {
        // --- SECURITY CHECK ---
        if (interaction.guild.id !== process.env.DISCORD_GUILD_ID) {
            return await interaction.reply({ content: 'This command cannot be used here.', flags: [MessageFlags.Ephemeral] });
        }

        // --- SAFER DEFER ---
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            console.error('[ERROR] Failed to defer interaction:', error);
            // If we can't defer, we can't do anything else.
            return;
        }
        // --- END SAFER DEFER ---

        const userId = interaction.user.id;
        const member = interaction.member;
        const groupId = 34630184;

        const stmt = db.prepare('SELECT * FROM verified_users WHERE discord_id = ?');
        const userData = stmt.get(userId);

        if (!userData) {
            return await interaction.editReply({ content: 'You are not verified. Please run `/verify` first to link your Roblox account.' });
        }

        const robloxUsername = userData.roblox_username;
        console.log(`[DATABASE] Found verified user ${interaction.user.tag} -> ${robloxUsername}`);

        try {
            const robloxId = await noblox.getIdFromUsername(robloxUsername);
            console.log(`[DEBUG] Found Roblox ID for ${robloxUsername}: ${robloxId}`);

            console.log(`[DEBUG] Fetching user's group roles from official Roblox API...`);
            const rolesResponse = await axios.get(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
            
            const userGroupRole = rolesResponse.data.data.find(group => group.group.id === groupId);
            
            let userRank = 0;
            if (userGroupRole) {
                userRank = userGroupRole.role.rank;
                console.log(`[DEBUG] Found user in group. Their rank is: ${userRank}`);
            } else {
                console.log(`[DEBUG] User is not in the specified group.`);
                return await interaction.editReply({ content: `${robloxUsername} is not a member of the Roblox group.` });
            }

            const rolesToAdd = new Set();
            const allGroupRoleIds = new Set();

            for (const groupMap of Object.values(config.groupRoleMappings)) {
                for (const roleId of Object.values(groupMap)) {
                    allGroupRoleIds.add(roleId);
                }
            }

            const rankMap = config.groupRoleMappings[groupId];
            if (rankMap && rankMap[userRank]) {
                const discordRoleId = rankMap[userRank];
                console.log(`[DEBUG] Found matching Discord role in config: ${discordRoleId}`);
                rolesToAdd.add(discordRoleId);
            } else {
                console.log(`[DEBUG] No Discord role configured for rank ${userRank}.`);
            }

            const rolesToRemove = [];
            member.roles.cache.forEach(role => {
                if (allGroupRoleIds.has(role.id) && !rolesToAdd.has(role.id)) {
                    rolesToRemove.push(role.id);
                }
            });

            console.log(`[DEBUG] Final roles to add: ${Array.from(rolesToAdd)}`);
            console.log(`[DEBUG] Final roles to remove: ${rolesToRemove}`);

            if (rolesToAdd.size > 0) {
                await member.roles.add(Array.from(rolesToAdd));
                console.log(`[DEBUG] Successfully added roles.`);
            }
            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove);
                console.log(`[DEBUG] Successfully removed roles.`);
            }

            const embed = new EmbedBuilder()
                .setTitle('Roles Updated')
                .setColor(0x3498DB)
                .setDescription(`Roles for **${robloxUsername}** have been synchronized.`)
                .addFields(
                    { name: 'Roles Added', value: rolesToAdd.size > 0 ? `<@&${Array.from(rolesToAdd).join('>, <@&')}>` : 'None', inline: true },
                    { name: 'Roles Removed', value: rolesToRemove.length > 0 ? `<@&${rolesToRemove.join('>, <@&')}>` : 'None', inline: true }
                );
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};