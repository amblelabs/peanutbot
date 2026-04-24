export default {
  guildId: ["1213989169878274068"],
  clientId: "1287095017596387500",
  logging: "debug",
  welcome: {
    channel: "1213989170964340878",
    message: `
## Welcome to AmbleLabs discord server!
- Make sure to get the mod roles in <id:customize>
- If you require support you can use the \`?support\` command! Just type it followed by your problem, e.g.:
\`?support for some reason tardis boti has buggy rendering, im on forge btw\`
- The bot will try to assist you, howver if you need human support you can ping our support members by doing \`?support ping\`!
- We have an official wiki too! You can quickly access it by running \`?wiki\` or \`?search whatever goes here\` to search the wiki.

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
        ping: "<@&1359062510518538351> by <@{0}>",
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
        "# [Click here to report a ](<https://github.com/amblelabs/stargate/issues/new?template=1-bug-report.yaml>)<:al_stargate:1393920339016417340>[ Stargate bug](<https://github.com/amblelabs/stargate/issues/new?template=1-bug-report.yaml>)",
      wikiAit:
        "# <:al_ait:1393920126645960704>[ AIT Wiki](https://amblelabs.dev/ait-wiki/)",
      wikiStargate:
        "# <:al_stargate:1393920339016417340>[ Stargate Wiki](https://amblelabs.github.io/stargate-wiki/)",
      eta: `
There's no ETA. The mod will be out when it's out.
Check the <#1213995158178242631> for public WIP posts.
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
- ?search [<query>] - searches the AIT wiki
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
      min: 120,
      max: 360,
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
      timer: 120 * 2, // 2 hours
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
  wikisearch: {
    indexUrl: "https://amblelabs.dev/ait-wiki/en.search-data.json",
    baseUrl: "https://amblelabs.dev/ait-wiki/",
    empty: "*There was nothing on the wiki*",
    header: "## Searching in <:al_ait:1393920126645960704> AIT Wiki:",
  },
  wikisearch2: {
    baseUrl: "https://amblelabs.dev/wiki",
    index: "/api/search",
    header:
      "## :mag: Searching in <:al_logo:1492686347666980944> [AmbleLabs Wiki](https://amblelabs.dev/wiki/):",
    format: {
      results: '-# Search results for "{0}":',
      page: "\n## {num}. [{title}](<{url}>)",
      header: "### {0}",
      text: "> {0}",
      breadcrumbs: "-# - {0}",
      sep: "\n",
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
    },
    emojis: {
      "<:al_clueless:1258762246398410854>": ":01KHEG7QM5DPK1BSRD2SCPQNBJ:",
      "<:al_unclueless:1426311299024945254>": ":01KHEG0T4JNKXKTYVY7FMN99ZZ:",
      "<:al_house:1356903328671334451>": ":01KHFBMFYJE4SW8M9XYPF70SP7:",
    },
  },
};
