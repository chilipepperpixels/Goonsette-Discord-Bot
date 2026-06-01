const dotenv = require("dotenv");
const { ChannelType, Client, GatewayIntentBits } = require("discord.js");

dotenv.config();

const prefix = ".";
const token = process.env.DISCORD_BOT_TOKEN;
const startedAt = Date.now();
const fs = require("fs");
const path = require("path");
const defaultConfigPath = path.join(__dirname, "guildMessage.json");

const liveConfigPath = () => {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "guildMessage.json")
    : defaultConfigPath;
};

const config = () => {
  return JSON.parse(fs.readFileSync(liveConfigPath(), "utf8"));
};

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
const applyLinks = (text, links) => {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return links[key] || match;
  });
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
  ],
});

client.once("clientReady", () => {
  console.log(` ${client.user.tag} is online!`);
});

client.on("messageCreate", async (message) => {
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
    const guildConfig = config();

    const embeds = guildConfig.embeds.map((embed) => ({
      ...embed,
      description: embed.description
        ? applyLinks(embed.description, guildConfig.links)
        : embed.description,
    }));

    message.reply({
      embeds,
      components: guildConfig.components,
    });
  }

  if (command === "r34") {
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
    if (allowedChannel.includes(message.channel.id)) {
      return message.reply({
        content:
          "Available commands:\n- `.r34 <tags>`: Fetch a random image from Rule34 based on tags (i.e., '.r34 kaine_(nier)')\n- `.random`: Fetch a random image from Rule34",
      });
    } else {
      return message.reply(
        "Available commands:\n- `.raiderhub`: Get the RaiderHub info",
      );
    }
  }

  if (command === "edit") {
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

    const guildConfig = config();

    const embeds = guildConfig.embeds.map((embed) => ({
      ...embed,
      description: embed.description
        ? applyLinks(embed.description, guildConfig.links)
        : embed.description,
    }));

    await createdChannel.send({
      embeds,
      components: guildConfig.components,
    });

    return message.reply(`Created new RaiderHub channel: ${createdChannel}`);
  }
});

client.login(token);
