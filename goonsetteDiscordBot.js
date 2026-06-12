const dotenv = require("dotenv");
const {
  ChannelType,
  Client,
  PermissionFlagsBits,
  GatewayIntentBits,
} = require("discord.js");

dotenv.config();

// Permissions granted to a raider when they are added to a private RaiderHub channel.
const allowedRaiderHubPermissionNames = [
  "ViewChannel",
  "SendMessages",
  "ReadMessageHistory",
  "AttachFiles",
  "EmbedLinks",
  "AddReactions",
  "UseExternalEmojis",
  "UseExternalStickers",
];

const raiderHubPermissionOverwrites = Object.fromEntries(
  Object.keys(PermissionFlagsBits).map((permission) => [
    permission,
    allowedRaiderHubPermissionNames.includes(permission),
  ]),
);

const prefix = ".";
const token = process.env.DISCORD_BOT_TOKEN;
const startedAt = Date.now();
const fs = require("fs");
const path = require("path");
const defaultConfigPath = path.join(__dirname, "guildMessage.json");
const helpMessagePath = path.join(__dirname, "helpMessage.json");
const defaultTrackedMessagesPath = path.join(__dirname, "trackedMessages.json");
const defaultRaiderHubPostsPath = path.join(__dirname, "raiderHubPosts.json");

// Railway uses a persistent volume for live-edited JSON; local runs use the repo file.
const liveConfigPath = () => {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "guildMessage.json")
    : defaultConfigPath;
};

const config = () => {
  return JSON.parse(fs.readFileSync(liveConfigPath(), "utf8"));
};

const liveTrackedMessagesPath = () => {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "trackedMessages.json")
    : defaultTrackedMessagesPath;
};

const liveRaiderHubPostsPath = () => {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "raiderHubPosts.json")
    : defaultRaiderHubPostsPath;
};

// Categories where specific commands are allowed to run.
const allowedCategories = [
  "1363092698093064424",
  "1322990758847844423",
  "1364685463729999945",
];
const commands = new Map([
  ["raiderhub", { allowedCategories }],
  ["r34", {}],
  ["random", {}],
  ["help", {}],
  ["edit", {}],
  ["links", {}],
  ["newraiderhub", {}],
  ["addraider", { allowedCategories: ["1363092698093064424"] }],
  ["postallrh", { allowedCategories: ["1363092698093064424"] }],
]);
const rule34UserId = process.env.RULE34_USER_ID;
const rule34ApiKey = process.env.RULE34_API_KEY;
const randomURL =
  process.env.RANDOM_URL ?? "https://rule34.xxx/index.php?page=post&s=random";
const rule34BlockedTags = [
  "loli",
  "shota",
  "cub",
  "young",
  "underage",
  "child",
  "minor",
  "ai",
  "ai_generated",
];
const normalizedBlockedTags = rule34BlockedTags.map((tag) =>
  tag.replaceAll(" ", "_"),
);
//const formatCommand = ({ command, args }) =>
//  `${prefix}${[command, ...args].join(" ")}`;
const isVideoUrl = (url) => /\.(mp4|webm)(?:[?#].*)?$/i.test(url);
const allowedChannel = ["1466449507972812924", "1322991455542710456"];
const allowedRoles = ["1466907960272748696"];
const WATCHED_CHANNEL_ID = "1396550738691493969";
const OFFICER_CHANNEL_ID = "1322991455542710456";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const trackedMessages = {};
const raiderHubPosts = {};

function loadTrackedMessages() {
  if (!fs.existsSync(liveTrackedMessagesPath())) return;
  const savedMessages = JSON.parse(
    fs.readFileSync(liveTrackedMessagesPath(), "utf8"),
  );
  Object.assign(trackedMessages, savedMessages);
}

function saveTrackedMessages() {
  fs.writeFileSync(
    liveTrackedMessagesPath(),
    JSON.stringify(trackedMessages, null, 2),
  );
}

function loadRaiderHubPosts() {
  if (!fs.existsSync(liveRaiderHubPostsPath())) return;
  const savedPosts = JSON.parse(
    fs.readFileSync(liveRaiderHubPostsPath(), "utf8"),
  );
  Object.assign(raiderHubPosts, savedPosts);
}

function saveRaiderHubPosts() {
  fs.writeFileSync(
    liveRaiderHubPostsPath(),
    JSON.stringify(raiderHubPosts, null, 2),
  );
}

const isRaiderHubInfoMessage = (message, payload) => {
  if (message.author.id !== client.user.id) return false;
  if (message.embeds.length !== payload.embeds.length) return false;

  return payload.embeds.every((embed, index) => {
    const postedEmbed = message.embeds[index];

    return (
      postedEmbed?.description === embed.description &&
      postedEmbed?.color === embed.color
    );
  });
};

async function deleteSavedRaiderHubPost(channel, reason) {
  const previousMessageId = raiderHubPosts[channel.id];
  if (!previousMessageId) return false;

  try {
    const previousMessage = await channel.messages.fetch(previousMessageId);
    if (previousMessage.author.id !== client.user.id) return false;

    await previousMessage.delete(reason);
    return true;
  } catch (error) {
    if (error.code === 10008) return false;
    throw error;
  } finally {
    delete raiderHubPosts[channel.id];
  }
}

// Replaces {{linkName}} placeholders in JSON embeds with live links.
const applyLinks = (text, links) => {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return links[key] || match;
  });
};

const guildMessagePayload = () => {
  const guildConfig = config();

  const embeds = guildConfig.embeds.map((embed) => ({
    ...embed,
    description: embed.description
      ? applyLinks(embed.description, guildConfig.links)
      : embed.description,
  }));

  return {
    embeds,
    components: guildConfig.components,
  };
};

const helpMessagePayloads = (includeR34Commands) => {
  const helpConfig = JSON.parse(fs.readFileSync(helpMessagePath, "utf8"));
  const payloads = [...helpConfig.messages];

  if (includeR34Commands) {
    payloads.push(helpConfig.r34Message);
  }

  return payloads;
};

if (!fs.existsSync(liveConfigPath())) {
  fs.copyFileSync(defaultConfigPath, liveConfigPath());
}

if (!token) {
  console.error(
    "Error: DISCORD_BOT_TOKEN is not defined in the environment variables.",
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

loadTrackedMessages();
loadRaiderHubPosts();

client.once("clientReady", () => {
  console.log(` ${client.user.tag} is online!`);
  setInterval(checkUnreactedMessages, 15 * 60 * 1000);
});

async function checkUnreactedMessages() {
  const now = Date.now();

  for (const tracked of Object.values(trackedMessages)) {
    if (tracked.reminded) continue;
    if (now - tracked.createdAt < TWENTY_FOUR_HOURS_MS) continue;

    try {
      const channel = await client.channels.fetch(tracked.channelId);
      const message = await channel.messages.fetch(tracked.messageId);

      if (message.reactions.cache.size === 0) {
        const officerChannel = await client.channels.fetch(OFFICER_CHANNEL_ID);
        await officerChannel.send(`Reminder: This message has had no reactions for 24 hours:\n${message.url}`);
        tracked.reminded = true;
        saveTrackedMessages();
      } else {
        tracked.reminded = true;
        saveTrackedMessages();
      }
    } catch (error) {
      console.error(`Failed to check tracked message ${tracked.messageId}:`,
        error,
      );
      tracked.reminded = true;
      saveTrackedMessages();
    }
  }
}

client.on("messageCreate", async (message) => {
  const isFromThisBot = message.author.id === client.user.id;
  const isInWatchedChannel = message.channel.id === WATCHED_CHANNEL_ID;
  const isFromWebhook = Boolean(message.webhookId);



  if (!isFromThisBot && isInWatchedChannel && isFromWebhook) {
    trackedMessages[message.id] = {
      channelId: message.channel.id,
      messageId: message.id,
      createdAt: message.createdTimestamp,
      reminded: false,
    };
    saveTrackedMessages();
  }




  // Ignore bots, old messages, and messages that do not use the bot prefix.
  if (message.author?.bot) return;
  if (message.createdTimestamp < startedAt) return;

  const content = message.content?.trim();
  if (!content || !content.startsWith(prefix)) return;

  let args = content.slice(prefix.length).split(/ +/);
  let command = args.shift().toLowerCase();

  const cmd = commands.get(command);
  const channelCategoryId = message.channel.parentId;

  if (!channelCategoryId) {
    return message.reply(
      "You can't use this command here. You can look at my boobs though!",
    );
  }
  if (!cmd) return;

  // Some commands are locked to specific Discord categories.
  if (cmd.allowedCategories) {
    const channelCategoryId = message.channel.parentId;

    const allowed = cmd.allowedCategories.includes(channelCategoryId);

    if (!allowed) {
      return message.reply(
        "You can't use this command here. You can look at my boobs though!",
      );
    }
  }

  if (command === "raiderhub") {
    // Posts the full RaiderHub embed from guildMessage.json.
    message.reply(guildMessagePayload());
  }

  if (command === "r34") {
    // Searches Rule34 by tags and posts one random matching result.
    if (!allowedChannel.includes(message.channel.id)) {
      return message.reply(
        "That command only works in the allowed R34 channels.",
      );
    }

    if (!rule34UserId || !rule34ApiKey) {
      return message.reply(
        "R34 needs RULE34_USER_ID and RULE34_API_KEY in `.env` first.",
      );
    }

    await message.channel.sendTyping();

    try {
      const requestedTags = args.length ? args.join(" ") : "2b";
      const safeTags = [
        requestedTags,
        ...normalizedBlockedTags.map((tag) => `-${tag}`),
      ].join(" ");

      const url = new URL("https://api.rule34.xxx/index.php");
      url.search = new URLSearchParams({
        page: "dapi",
        s: "post",
        q: "index",
        limit: "100",
        json: "1",
        tags: safeTags,
        user_id: rule34UserId,
        api_key: rule34ApiKey,
      });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `R34 API returned ${response.status} ${response.statusText}`,
        );
      }

      const body = await response.text();

      if (!body) {
        return message.reply(
          `No R34 results found for \`${requestedTags}\`. Try the exact tag name, like \`kaine_(nier)\`.`,
        );
      }

      const data = JSON.parse(body);
      const posts = Array.isArray(data) ? data : (data.posts ?? []);
      const post = posts[Math.floor(Math.random() * posts.length)];
      const imageUrl = post?.file_url || post?.sample_url;

      if (!imageUrl) {
        throw new Error(`No image URL returned for tags: ${safeTags}`);
      }

      if (isVideoUrl(imageUrl)) {
        return message.reply({
          content: imageUrl,
          embeds: [
            {
              title: `R34: ${requestedTags}`,
              url: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
              color: 0xff69b4,
              footer: { text: "Source: rule34.xxx" },
            },
          ],
        });
      }

      return message.reply({
        embeds: [
          {
            title: `R34: ${requestedTags}`,
            url: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
            image: { url: imageUrl },
            color: 0xff69b4,
            footer: { text: "Source: rule34.xxx" },
          },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch R34 image:", error);
      return message.reply("Sorry, I could not fetch an R34 image right now.");
    }
  }
  if (command === "random") {
    // Uses Rule34's random URL and retries if a blocked tag appears.
    if (!allowedChannel.includes(message.channel.id)) {
      return message.reply(
        "That command only works in the allowed R34 channels.",
      );
    }

    if (!rule34UserId || !rule34ApiKey) {
      return message.reply(
        "R34 needs RULE34_USER_ID and RULE34_API_KEY in `.env` first.",
      );
    }

    await message.channel.sendTyping();

    try {
      let post;

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const randomResponse = await fetch(randomURL, { redirect: "manual" });
        const location = randomResponse.headers.get("location");
        const postId = location?.match(/[?&]id=(\d+)/)?.[1];

        if (!postId) {
          throw new Error("R34 random URL did not return a post id");
        }

        const url = new URL("https://api.rule34.xxx/index.php");
        url.search = new URLSearchParams({
          page: "dapi",
          s: "post",
          q: "index",
          json: "1",
          id: postId,
          user_id: rule34UserId,
          api_key: rule34ApiKey,
        });

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `R34 API returned ${response.status} ${response.statusText}`,
          );
        }

        const body = await response.text();

        if (!body) {
          continue;
        }

        const data = JSON.parse(body);
        const posts = Array.isArray(data) ? data : (data.posts ?? []);
        const randomPost = posts[0];
        const tags = randomPost?.tags?.split(" ") ?? [];
        const hasBlockedTag = normalizedBlockedTags.some((tag) =>
          tags.includes(tag),
        );

        if (randomPost && !hasBlockedTag) {
          post = randomPost;
          break;
        }
      }

      const imageUrl = post?.file_url || post?.sample_url;

      if (!imageUrl) {
        throw new Error("No safe random R34 image found");
      }

      if (isVideoUrl(imageUrl)) {
        return message.reply({
          content: imageUrl,
          embeds: [
            {
              title: "Random R34",
              url: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
              color: 0xff69b4,
              footer: { text: "Source: rule34.xxx/random" },
            },
          ],
        });
      }

      return message.reply({
        embeds: [
          {
            title: "Random R34",
            url: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
            image: { url: imageUrl },
            color: 0xff69b4,
            footer: { text: "Source: rule34.xxx/random" },
          },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch random R34 image:", error);
      return message.reply(
        "Sorry, I could not fetch a random R34 image right now.",
      );
    }
  }

  if (command === "help") {
    // Posts the pretty help guide from helpMessage.json.
    const helpPayloads = helpMessagePayloads(
      allowedChannel.includes(message.channel.id),
    );

    await message.reply(helpPayloads[0]);

    for (const payload of helpPayloads.slice(1)) {
      await message.channel.send(payload);
    }

    return;
  }

  if (command === "edit") {
    // Lets allowed officers update live links in guildMessage.json.
    const editableFields = Object.keys(config().links);
    const fieldName = args[0];
    const newUrl = args[1];
    const hasAllowedRole = allowedRoles.some((roleId) =>
      message.member.roles.cache.has(roleId),
    );

    if (!hasAllowedRole) {
      return message.reply(
        "You do not have permission to use this command. You can look at my boobs though!",
      );
    }

    if (!editableFields.includes(fieldName)) {
      return message.reply(
        `Unknown editable field. Valid fields are: ${editableFields.join(", ")}`,
      );
    }

    if (!newUrl?.startsWith("https://")) {
      return message.reply("Please give me a valid https link.");
    }

    const guildConfig = config();

    guildConfig.links[fieldName] = newUrl;

    fs.writeFileSync(liveConfigPath(), JSON.stringify(guildConfig, null, 2));

    return message.reply(`Updated ${fieldName} link.`);
  }
  if (command === "links") {
    // Posts only the important-links embed from guildMessage.json.
    const guildConfig = config();
    const linksEmbed = {
      ...guildConfig.embeds[1],
      description: applyLinks(
        guildConfig.embeds[1].description,
        guildConfig.links,
      ),
    };
    return message.reply({ embeds: [linksEmbed] });
  }

  if (command === "newraiderhub") {
    // Creates a numbered private RaiderHub channel and posts the intro embed there.
    const hasAllowedRole = allowedRoles.some((roleId) =>
      message.member.roles.cache.has(roleId),
    );

    if (!hasAllowedRole) {
      return message.reply(
        "You do not have permission to use this command. You can look at my boobs though!",
      );
    }
    const targetCategoryId = "1363092698093064424";
    const baseName = "new-raider-hub";

    const channelIsInCategory = message.guild.channels.cache.filter(
      (channel) => {
        return channel.parentId === targetCategoryId;
      },
    );

    const existingChannel = channelIsInCategory.map((channel) => channel.name);

    let number = 1;
    let newChannelName = `${baseName}-${number}`;

    while (existingChannel.includes(newChannelName)) {
      number++;
      newChannelName = `${baseName}-${number}`;
    }

    const createdChannel = await message.guild.channels.create({
      name: newChannelName,
      type: ChannelType.GuildText,
      parent: targetCategoryId,
    });

    const postedMessage = await createdChannel.send(guildMessagePayload());
    raiderHubPosts[createdChannel.id] = postedMessage.id;
    saveRaiderHubPosts();

    return message.reply(`Created new RaiderHub channel: ${createdChannel}`);
  }

  if (command === "addraider") {
    // Adds a mentioned guild member to the current RaiderHub channel and renames it.
    const hasAllowedRole = allowedRoles.some((roleId) =>
      message.member.roles.cache.has(roleId),
    );

    if (!hasAllowedRole) {
      return message.reply(
        "You do not have permission to use this command. You can look at my boobs though!",
      );
    }

    const raiderHubCategoryId = "1363092698093064424";

    if (message.channel.parentId !== raiderHubCategoryId) {
      return message.reply(
        "You can only use this command in a RaiderHub channel.",
      );
    }

    const targetMember = message.mentions.members.first();

    if (!targetMember) {
      return message.reply("Please mention a user to add to this RaiderHub.");
    }

    await message.channel.permissionOverwrites.edit(targetMember.id, {
      ...raiderHubPermissionOverwrites,
    });

    const safeName = targetMember.displayName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    await message.channel.setName(safeName);

    return message.reply(
      `Added ${targetMember} and renamed this RaiderHub to ${safeName}.`,
    );
  }

  if (command === "postallrh") {
    // Refreshes the pinned RaiderHub info message in every text channel in the category.
    const hasAllowedRole = allowedRoles.some((roleId) =>
      message.member.roles.cache.has(roleId),
    );

    if (!hasAllowedRole) {
      return message.reply(
        "You do not have permission to use this command. You can look at my boobs though!",
      );
    }

    const raiderHubCategoryId = "1363092698093064424";
    await message.guild.channels.fetch();

    const raiderHubChannels = message.guild.channels.cache
      .filter((channel) => {
        return (
          channel.parentId === raiderHubCategoryId &&
          channel.type === ChannelType.GuildText
        );
      })
      .sort((left, right) => left.position - right.position);

    if (!raiderHubChannels.size) {
      return message.reply("No RaiderHub text channels found in the category.");
    }

    const payload = guildMessagePayload();
    const deleteReason = "Refreshing RaiderHub guild message.";
    let deletedCount = 0;
    let refreshedCount = 0;
    const failedChannels = [];

    for (const channel of raiderHubChannels.values()) {
      try {
        if (await deleteSavedRaiderHubPost(channel, deleteReason)) {
          deletedCount++;
        }

        const pinnedMessages = await channel.messages.fetchPinned();

        for (const pinnedMessage of pinnedMessages.values()) {
          if (isRaiderHubInfoMessage(pinnedMessage, payload)) {
            await pinnedMessage.delete(deleteReason);
            deletedCount++;
          } else {
            await pinnedMessage.unpin(deleteReason);
          }
        }

        const postedMessage = await channel.send(payload);
        await postedMessage.pin(deleteReason);
        raiderHubPosts[channel.id] = postedMessage.id;
        refreshedCount++;
      } catch (error) {
        failedChannels.push(channel.name);
        console.error(
          `Failed to refresh RaiderHub channel ${channel.id}:`,
          error,
        );
      }
    }

    saveRaiderHubPosts();

    if (failedChannels.length) {
      return message.reply(
        `Refreshed ${refreshedCount}/${raiderHubChannels.size} RaiderHub channels and deleted ${deletedCount} old bot messages. Failed: ${failedChannels.join(", ")}`,
      );
    }

    return message.reply(
      `Refreshed and pinned RaiderHub info in ${refreshedCount} channels. Deleted ${deletedCount} old bot messages.`,
    );
  }





});

client.login(token);

//smile = "😊";
//frown = "☹️";
