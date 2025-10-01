import type { Cmd } from "~/util/base";
import { Client, Guild, GuildMember, type RoleResolvable } from 'discord.js';
import { logger } from "~/util/logger";

interface RoleUpdateResult {
  success: number;
  failed: number;
  errors: string[];
}

async function assignRoleToEligibleMembers(
  guild: Guild,
  roleIdA: string,
  roleIdB: string,
  joinDateThreshold: Date = new Date('2025-07-07'),
  batchSize: number = 50,
  delayBetweenBatches: number = 1000
): Promise<RoleUpdateResult> {
  const result: RoleUpdateResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  try {
    // Fetch all members (this might take a while for large guilds)
    console.log('Fetching all guild members...');
    const allMembers = await guild.members.fetch();
    console.log(`Fetched ${allMembers.size} members`);

    // Filter members based on criteria
    const eligibleMembers = Array.from(allMembers.values()).filter(member => {
      // Check if member has role A
      const hasRoleA = member.roles.cache.has(roleIdA);
      
      // Check if member doesn't have role B
      const hasRoleB = member.roles.cache.has(roleIdB);
      
      // Check if member joined before the threshold date
      const joinedBeforeThreshold = member.joinedAt && member.joinedAt < joinDateThreshold;
      
      return hasRoleA && !hasRoleB && joinedBeforeThreshold;
    });

    console.log(`Found ${eligibleMembers.length} eligible members`);

    if (eligibleMembers.length === 0) {
      console.log('No members to update');
      return result;
    }

    // Process members in batches to avoid rate limits
    for (let i = 0; i < eligibleMembers.length; i += batchSize) {
      const batch = eligibleMembers.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eligibleMembers.length / batchSize)}`);
      
      // Process each member in the current batch
      const batchPromises = batch.map(async (member) => {
        try {
          await member.roles.add(roleIdB);
          await member.roles.remove(roleIdA);
          result.success++;
          console.log(`Successfully added role to ${member.user.tag}`);
        } catch (error) {
          result.failed++;
          const errorMessage = `Failed to add role to ${member.user.tag}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          console.error(errorMessage);
        }
      });

      // Wait for all members in this batch to be processed
      await Promise.all(batchPromises);
      
      // Wait before processing the next batch (rate limiting)
      if (i + batchSize < eligibleMembers.length) {
        console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`Role assignment complete. Success: ${result.success}, Failed: ${result.failed}`);
    return result;

  } catch (error) {
    const errorMessage = `Error fetching members or processing roles: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMessage);
    console.error(errorMessage);
    throw error;
  }
}

export default {
    data: {
        name: 'fix_perms_just_this_once'
    },
    async execute(ctx, message, channel, args) {
        if (message.author.id !== "691552610519613440") return;
        const result = await assignRoleToEligibleMembers(
            message.guild!,
            '1213989169878274069',
            '1391860964411838484'
        );

    logger.info(`
      Role Assignment Summary:
      - Successfully updated: ${result.success} members
      - Failed updates: ${result.failed} members
      - Errors: ${result.errors.length}
    `);
    },
} as Cmd