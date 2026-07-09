export default {
  guildId: ["1213989169878274068"],
  clientId: "1520481807458504774",
  logging: "debug",
  welcome: {
    channel: "1213989170964340878",
    message: `
## Welcome to AmbleLabs discord server!
- Make sure to get the mod roles in <id:customize>
- If you require support you can use the \`?support\` command! Just type it followed by your problem, e.g.:
\`?support for some reason tardis boti has buggy rendering, im on forge btw\`
- The bot will try to assist you, however if you need human support you can ping our support members by doing \`?support ping\`!
- We have an official wiki too! You can quickly access it by running \`?wiki\` or \`/search whatever goes here\` to search the wiki.

Have fun, <@{0}>!`,
  },
  support: {
    serverIsDown: {
      channel: "1225097418165588049",
      cooldown: 5 * 60 * 1000,
      format: {
        success: "Notified MC Admins!",
        cooldown:
          "The command is on cooldown! Someone has already notified MC admins. Command will be usable again {0}.",
        error: "Failed to notify MC admins! Contact your server's admin.",
        ping: "<@&1358537058120896532> by <@{0}>",
      },
      enabled: true,
    },
    types: {},
    ping: `
Are you sure you want to ping support?
-# This message may delete in 5 seconds.
    `,
    searchWiki: true,
    role: "1358537058120896532",
    channels: [
      "1391860052637515847",
      "1391860052637515847",
      "1391860052637515847",
      "1391860052637515847",
    ],
    format: {
      header:
        "### <:al_peanuthigh:1389237149228073012> `P.E.A.N.U.T.` Autonomous System:",
      fail: "There's no support entry with those keywords!",
      keywords: "`{0}`",
      footer: "-# Type: `{type}`, weight: `{weight}`, keywords: {keywords}.",
    },
    short: {
      forge:
        "# <:al_ait:1393920126645960704> [ Forge FAQ](https://amblelabs.github.io/ait-wiki/forge/)",

      bugAit:
        "# [Click here to report an ](<https://github.com/amblelabs/ait/issues/new?template=1-bug-report.yaml>)<:al_ait:1393920126645960704>[ AIT bug](<https://github.com/amblelabs/ait/issues/new?template=1-bug-report.yaml>)",
      bugStargate:
        "# [Click here to report a ](<https://github.com/amblelabs/stargate/issues/new?template=1-bug-report.yaml>)<:al_stargate:1504663279421882378>[ Stargate bug](<https://github.com/amblelabs/stargate/issues/new?template=1-bug-report.yaml>)",
      wiki: "# <:al_logo:1492686347666980944>[ AmbleLabs Wiki](https://amblelabs.dev/wiki/)",
      eta: `
There's no ETA. The mod will be out when it's out.
Check the <#1213995158178242631> channel for public WIP posts.

Consider donating to one of the following people:
- [Theo](<https://boosty.to/dr.theo>)
- [Loqor](<https://ko-fi.com/loqor>)
- [Addie](<https://www.patreon.com/cw/Addie_Astarr>)
- [Classic](<https://ko-fi.com/redpanda39441>)
...or the discord server shop to access donator exclsusive WIP posts & releases and to help support our projects.
      `,
    },
  },
  help: {
    message: `
- ?help - displays this help message
- ?wiki [ait|stargate|th] - sends wiki link
- ?bug [ait|stargate|th] - sends bug report link
- ?eta - about ETA
- ?forge - forge FAQ
- ?support [ping|<query>] - provides support
- /search [<query>] - searches the AIT wiki
    `,
  },
  memos: {
    invalidTimestamp: "> <:al_fire:1257419592691875921> Invalid timestamp!",
    badNumbers: "> <:al_fire:1257419592691875921> Invalid timestamp!",
    success: "I will remind you <t:{0}:R>!",
    reminder: `
> <:al_peanutjudge:1388592112265592852> Reminder:
{0}
    `,
  },
  fun: {
    meow: {
      enabled: true,
      channel: "1213989171241426954",
      role: "1325521300860567683",
      min: 60*3,
      max: 60*6,
    },
    pet: {
      enabled: true,
    },
    play: {
      enabled: true,
      role: "1325521300860567683",
    },
    sleep: {
      enabled: true,
      channel: "1213989171241426954",
      role: "1325521300860567683",
      cmdDelay: 2,
      timer: 60 * 4, // 4 hours
      sticker: "1392176036216832080",
      awakeSticker: "1389237472340349139",
    },
    wrath: {
      message:
        "https://raw.githubusercontent.com/amblelabs/peanutbot/refs/heads/master/assets/angry.png",
    },
    highfives: [
      "https://tenor.com/view/high-five-cat-five-meow-five-bros-friends-gif-17956519",
      "https://tenor.com/view/cat-cat-high-five-okay-sour%27s-cat-cute-cat-gif-13717594879666614680",
    ],
    agree:[
      "https://tenor.com/bq1TWmhuIyk.gif"
    ],
    blame: {
      antifun: [
        "https://cdn.discordapp.com/attachments/1098448459717169191/1429812098455568434/togif-3.gif?ex=69acc608&is=69ab7488&hm=929a6282233220d13d95b344d8914336170ab5280ee5630989f560b8db50b63d",
      ],
      noUpdates: [
        "https://cdn.discordapp.com/attachments/865737835973312532/1346364113294721115/togif.gif?ex=69ad12ca&is=69abc14a&hm=674476d6de2e0743ed68578cbbef5f4d2b56371ec0ff582effe6fb2eece32ee3",
      ],
    },
    peanuts: [
      "1257682347470356621",
      "1389237403725725749",
      "1389237472340349139",
      "1392176036216832080",
      "1515646969064853635",
    ],
    peanutV:[
        "https://raw.githubusercontent.com/amblelabs/peanutbot/refs/heads/master/assets/peanut_blursed_1.webm"
    ],
    gemini:
      "https://raw.githubusercontent.com/amblelabs/peanutbot/refs/heads/master/assets/gemini.webp",
    claude:
      "https://raw.githubusercontent.com/amblelabs/peanutbot/refs/heads/master/assets/claude.webp",
  },
  arguing: {
    channel: "1213989170964340883",
    period: 60 * 60 * 1000,
    messages: 100,
  },
  honeypot:{
    channelId: "1520480898741567579",
    banDescription: "Automated ban, they went in the honeypot",
    deleteMessageSeconds: 7 * 24 * 60 * 60,
    logChannelId: "1225097418165588049",
    dossierChannelId: "1302637740973887488",
    banTag: "1406738115468722257",
    bypassId: "1257750834150637599"
  },
  economy: {
    shopItems: [
      {
        itemId: "beta_role_3",
        name: "Beta Access for 3 days",
        price: 500,
        description: "Purchase for access to beta builds!",
        roleId: "1510652320432521327",
        durationDays: 3,
        stock: -1
      },
      {
        itemId: "beta_role_7",
        name: "Beta Access for 7 days",
        price: 1000,
        description: "Purchase for access to beta builds!",
        roleId: "1510652320432521327",
        durationDays: 7,
        stock: -1
      },
      {
        itemId: "beta_role_30",
        name: "Beta Access for 30 days",
        price: 2500,
        description: "Purchase for access to beta builds!",
        roleId: "1510652320432521327",
        durationDays: 30,
        stock: -1
      },
      {
        itemId: "candy",
        name: "candy",
        price: 20,
        description: "Purchase many!",
        useMessage: "The taste is most pleasing",
        stock: 20
      },
    ],
    teamRole: ["1262624821582364703"],
    gambleChannel: ["1522846518829125642"],
    addMoney: "{emoji} **Transaction Complete:** Successfully added `${added}` to <@{user}>'s profile. Their new balance is `${newBalance}`.",
    coinEmoji: "<:al_logo:1492686347666980944>",
    cantAfford: "❌ You only have \\`${userBalance}\\`. You don't have enough money to bet!",
    isntStaff: "❌ You do not have a required staff role to use this command.",
    balanceMessage: "{emoji} <@{targetUser}> currently has **${balance}**.",
    shop:{
      notItem: "That item doesn't exist in our shop.",
      soldOut: "❌ Sorry, **${name}** is completely sold out!",
      cantAfford: "`❌ You can't afford that! **{name}** costs \`${price}\`, but you only have \`${balance}\`.",
      successBuy: "🎉 Successfully bought **{name}** for \`${price}\`{message}. Your remaining balance is \`$${balance}\`.",
      permaRole: " and granted you the <@&{roleId}> role permanently!",
      tempRole: ` and granted you the <@&{roleId}> role for **{durationDays} days**!`,
      permRoleOwned: "❌ You already have this permanent role!",
      notEnough: "❌ There are only **{stock}** of this item left in stock!",
      notMultiple: "❌ You can only purchase one role-based pass at a time!"
    },
    inv:{
      empty: "🎒 Your inventory is completely empty. Go buy something!",
      lack: "❌ You don't have any \`{item}\` in your inventory! Buy one from the shop first.",
      nonexistent: "❌ This item no longer exists in the server shop database.",
      nonconsumable: "❌ The **{name}** is not a consumable item. (If it's a role item, it was used automatically when you bought it!)"
    },
    limit: "❌ Please use an integer smaller than or equal to 1,000,000,000 and bigger than 0",
    setBalance:{
      invalid: "❌ Invalid amount range (0 to 2B).",
      setTo: "⚙️ **Database Updated:** <@{user}>'s balance has been explicitly set to \`${amount}\`."
    },
    betWin: "🎰 **JACKPOT!** The {thing} landed in your favor.\n{dice}\nYou won \`${betAmount}\`!\n{emoji} Your new balance is \`${balance}\`.",
    betLost: "📉 **Bust!** Lady Luck was not on your side today.\n{dice}\nYou lost \`${betAmount}\`.\n{emoji} Your remaining balance is \`${balance}\`.",
    roulette: {
      openMessage: "🎰 **<@{userId}>** opened a Roulette Table for **{seconds} seconds**! Join the thread below to place your bets.",
      threadName: "🎰 Roulette Table - {username}",
      guideMessage:
          "🎡 **Roulette Table Opened!** (Closes in {seconds} seconds)\n\n" +
          "To enter, type your bet choice followed by your amount. " +
          "**Example: `red 250`**\n" +
          "• `0-36 <amount>` (8x payout)\n" +
          "• `green <amount>` (8x payout) 🟢\n" +
          "• `red <amount>` (2x payout) 🔴\n" +
          "• `black <amount>` (2x payout) ⚫\n" +
          "• `even <amount>` (2x payout)\n" +
          "• `odd <amount>` (2x payout)\n\n" +
          " _The bot will react with ✅ if your bet is accepted, or ❌ if something is wrong._\n" +
          "👑 **<@{userId}>**, type `spin` when everyone is ready!",
      inactivityMessage: "⏰ Table closed automatically due to inactivity.",
      spinningMessage: "✨ *The wheel is spinning...* ✨",
      resultHeader: "🏁 **The wheel landed on {number} {color} {emoji} !**\n\n",
      betWonLine: "{betDisplay}: Won {amount}",
      betLostLine: "{betDisplay}: Lost {amount}",
      brokeEven: "Broke Even!",
      wonNet: "Won Net {amount}!",
      lostNet: "Lost Net {amount}!",
      userSummaryRow: "**{user}**:\n{breakdown}\n**{netStatus}**\n"
    },
    wages: {
      message: "{emoji} You worked a hard shift and claimed your wage of **${salary}**!\n🏦 **New Balance:** ${balance}",
      defaultAmount: 0,
      roleSalaries: {
        "1262624821582364703": 500,
      }
    }
  },
  swear: {
    period: 60 * 1000,
    reply: "GET TIMEOUT FOR SWEARING AT ME >:("
  },
  wikisearch: {
    baseUrl: "https://amblelabs.dev/wiki",
    index: "/api/search",
    format: {
      header:
        "## :mag: Searching in <:al_logo:1492686347666980944> [AmbleLabs Wiki](https://amblelabs.dev/wiki/):",
      results: '-# Search results for "{0}":',
      page: "\n## {num}. [{title}](<{url}>)",
      text: "> {0}",
      breadcrumbs: "-# - {0}",
      sep: "\n",
      empty: "*There was nothing on the wiki*",
    },
  },
  bridge: {
    stoat: {
      guild: "01KHEFHPG0YC7PWE8JF78ZBS0E",
    },
    discord: {
      guild: "1213989169878274068",
    },
    channels: {
      "1213989170964340883": "01KHEGJB9KF5Y8PWXQJBP5DF4H",
      "1213989171241426954": "01KHEFHPG9WDZJ8XTBM5A4J2ZV",
      "1214761460824150046": "01KHFFY893E1D84YG5YPHC51QE",
      "1391859999881564260": "01KVA74WYBY6FBJS1VZNVJTMD5",
    },
    emojis: {
      "<:al_clueless:1258762246398410854>": ":01KHEG7QM5DPK1BSRD2SCPQNBJ:",
      "<:al_unclueless:1426311299024945254>": ":01KHEG0T4JNKXKTYVY7FMN99ZZ:",
      "<:al_house:1356903328671334451>": ":01KHFBMFYJE4SW8M9XYPF70SP7:",
      "<a:al_explosion:1467652202356150272>": ":01KVAMF92JKDHM19513A2J82JG:",
    },
  },
};
