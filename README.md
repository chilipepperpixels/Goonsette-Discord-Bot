# Goonsette Discord Bot

Tiny Discord bot for guild officer stuff, RaiderHub channels, editable guild links, and a couple of definitely-normal side quests.

Built with `discord.js`. Hosted on Railway. Held together with code, spite, and a persistent volume so edited JSON does not vanish into the void.

## What It Does

- posts the RaiderHub info embed from `guildMessage.json`
- lets officers edit stored links with `.edit`
- replaces `{{linkName}}` placeholders in embeds with real links
- creates numbered private RaiderHub channels with `.newraiderhub`
- adds a mentioned raider to a RaiderHub channel with `.addraider @user`
- renames the RaiderHub channel after the added member
- has R34 commands restricted to specific channels
- stores live-edited JSON on Railway volume storage

## Commands

### `.raiderhub`

Posts the full RaiderHub message from `guildMessage.json`.

### `.links`

Posts only the important links embed.

### `.edit fieldName <https://new-link>`

Updates a link in `guildMessage.json`.

Editable fields:

```txt
absenceForm
consumableRequestForm
raidAssignments
thatsMyBis
wowSims
```

Example:

```txt
.edit raidAssignments <https://docs.google.com/spreadsheets/d/example>
```

Needs the allowed officer role.

### `.newraiderhub`

Creates a new private RaiderHub channel in the RaiderHub category.

It names them automatically:

```txt
new-raider-hub-1
new-raider-hub-2
new-raider-hub-3
```

No channel name needed. Do not get creative. The bot has a system.

### `.addraider @user`

Adds a real mentioned Discord user to the current RaiderHub channel and renames the channel after them.

Use a real mention:

```txt
.addraider @TheirDiscordAccount
```

Not plain text:

```txt
.addraider TheirDisplayName
```

The bot needs the actual Discord mention so it can find the member ID and set channel permissions.

### `.r34 <tags>`

Searches R34 by tags and posts a random result.

Example:

```txt
.r34 kaine_(nier)
```

Only works in the allowed R34 channels.

### `.random`

Gets a random R34 post, with blocked tags filtered out.

Only works in the allowed R34 channels.

## Setup

Install dependencies:

```bash
npm install
```

Start locally:

```bash
npm start
```

Format the code:

```bash
npm run format
```

Syntax check:

```bash
node --check goonsetteDiscordBot.js
```

## Environment Variables

Do not commit `.env`. Seriously. Tiny siren.

Required variables:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
RULE34_USER_ID=your_rule34_user_id
RULE34_API_KEY=your_rule34_api_key
RANDOM_URL=https://rule34.xxx/index.php?page=post&s=random
```

Railway variables go in the Railway dashboard, not in GitHub.

## Railway Notes

The bot uses Railway volume storage for the live editable `guildMessage.json`.

Mount the volume at:

```txt
/app/data
```

Railway provides:

```txt
RAILWAY_VOLUME_MOUNT_PATH
```

The bot uses that path automatically.

Local dev uses:

```txt
guildMessage.json
```

Railway uses:

```txt
/app/data/guildMessage.json
```

If the Railway volume file does not exist yet, the bot copies the default `guildMessage.json` into the volume on startup.

## Discord Permissions

The bot needs enough permissions to:

- read messages
- send messages
- send embeds
- manage channels
- edit channel permission overwrites

Also enable Message Content Intent in the Discord Developer Portal, because this bot uses prefix commands like `.raiderhub`.

## Notes For Future Me

- Channel IDs and role IDs are strings. Keep the quotes.
- `.addraider` needs an actual `@mention`, not someone typing a display name and hoping.
- If Railway redeploys and edited links disappear, check the volume mount first.
- If the bot replies twice, you probably started two local Node processes again. Congratulations, you made an echo.
