# MTG Discord Bot
![image](https://user-images.githubusercontent.com/325521/188140411-1940ede3-045c-47db-adef-0ee9f9cfe0bc.png)

Discord Bot for Magic / Judge related content

[Add the bot to your server](https://discord.com/api/oauth2/authorize?client_id=240537940378386442&permissions=274878187520&scope=applications.commands%20bot)

## Supported commands

You can list the judgebot commands by typing `/` in discord and clicking on the Judgebot icon.

## Development Setup

Clone the Git repository and run the following commands:
```sh
npm install
export DISCORD_TOKEN="<your Discord bot token>"
export GOOGLE_TOKEN="<your Google (Maps) API key>"
export CR_ADDRESS="https://media.wizards.com/2020/downloads/MagicCompRules%2020200417.txt"
export IPG_ADDRESS="https://raw.githubusercontent.com/hgarus/mtgdocs/master/docs/ipg.json"
export MTR_ADDRESS="https://sites.google.com/site/mtgfamiliar/rules/MagicTournamentRules-light.html"
npm run build
node updateInteractions.js
node server.js
```

## Badges
[![Code Climate](https://codeclimate.com/github/bra1n/judgebot/badges/gpa.svg)](https://codeclimate.com/github/bra1n/judgebot)

## Acknowledgements

- Card images are all copyright Wizards of the Coast.
- Card database is provided by Scryfall.org.
- This bot is not affiliated with Wizards of the Coast in any way.
- The server is kindly provided by [SKnetworX](http://www.sknetworx.net)
