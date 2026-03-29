import config from "config.json";
import { type Message, EmbedBuilder } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
  name: "proposals",
};

const propRe = /ait-(\d+)/gi;
const propSearchRe = /ait-\/(.+?)\/(a)?/g;

async function onMessage(ctx: Ctx, message: Message) {
  for (const propNum of [
    ...message.content.matchAll(propRe).map((e) => e[1]),
  ]) {
    message.reply(
      `**<:al_ait:1393920126645960704> AIT \`2.x\` [Proposal #${propNum}](https://codeberg.org/AmbleLabs/ait-next/issues/${propNum}) **`,
    );
  }

  for (const searchQuery of [
    ...message.content.matchAll(propSearchRe),
  ]) {
    handleSearch(message, searchQuery[1], searchQuery[2] ?? false);
  }
}

async function handleSearch(message: Message, query: string, onlyActive: bool) {
  try {
    const url = new URL("https://codeberg.org/api/v1/repos/AmbleLabs/ait-next/issues");
    url.searchParams.append("q", query);
    url.searchParams.append("limit", "5");
    url.searchParams.append("sort", "relevance");
    url.searchParams.append("access_token", config.codebergToken)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GitHub search error:", errorData);
      await message.reply("⚠️ An error occurred while searching GitHub.");
      return;
    }

    const data = await response.json();
    const items: Array<any> = data.items;

    if (items.length === 0) {
      await message.reply(`🔍 No results found for \`${query}\`.`);
      return;
    }

    // Build an embed with the search results
    const embed = new EmbedBuilder()
      .setColor(0x2dbe60)
      .setTitle(`🔍 Proposal Search Results for "${query}"`)
      .setURL(
        `https://github.com/amblelabs/ait-next/issues?q=${encodeURIComponent(query)}`,
      )
      .setDescription(`Top ${items.length} matching proposals.`);

    items
      .map((e) => {
        return {
          state: e.state,
          approved: e.labels.some((l: any) => l.name.includes("Approval")),
          discussion: e.labels.some((l: any) => l.name.includes("Discussion")),
          stateReason: e.state_reason,
          notPlanned: e.state_reason === "not_planned",
          isPR: !!e.pull_request,
          title: e.title,
          number: e.number,
          html_url: e.html_url,
        };
      })
      .sort((a, b) => {
        return (
          b.approved -
          a.approved -
          100 * ((a.notPlanned ? -1 : 0) - (b.notPlanned ? 1 : 0))
        );
      })
      .forEach((item, index) => {
        if (item.isPR) return;
        if (onlyActive && item.notPlanned) return;

        const type = item.isPR ? "Pull Request" : "Proposal";

        let stateEmoji = "🟡";
        let reason = "Not approved";

        if (item.state === "open") {
          if (item.approved) {
            stateEmoji = "🟢";
            reason = "Approved";
          }

          if (item.discussion) {
            reason = "Undergoing discussion."
          }
        } else {
          if (item.notPlanned) {
            stateEmoji = "⚪";
            reason = "Not planned.";
          } else {
            stateEmoji = "🟣";
            reason = "Implemented.";
            //stateEmoji = "🔴";
            //reason = "Declined.";
          }
        }

        if (reason) {
          reason = ": " + reason;
        }

        embed.addFields({
          name: `${index + 1}. ${item.title}`,
          value: `${stateEmoji} [${type} **#${item.number}**](${item.html_url})${reason}`,
          inline: false,
        });
      });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Fetch error:", error);
    await message.reply(
      "⚠️ An error occurred while communicating with GitHub.",
    );
  }
}

export default {
  data,
  onMessage,
} as Cmd;
