# MTG Discord Bot
Discord Bot for Magic / Judge related content

[Add the bot to your server](https://discordapp.com/oauth2/authorize?client_id=240537940378386442&scope=bot)

## Setup

Clone the Git repository and run the following commands:
```sh
npm install
export DISCORD_TOKEN="<your Discord bot token>"
export CR_ADDRESS="http://media.wizards.com/2016/docs/MagicCompRules_20160930.txt"
node server.js
```

## Supported commands

- **!card \<partial cardname\>**: searches for an (English) card by name and outputs the card together with an image, if available, *Example: !card Tarmogoyf*
- **!cr \<paragraph number\>**: shows the chosen paragraph from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !cr 100.6b*

## Coming soon

- **!mtr \<paragraph number\>**
- **!ipg \<paragraph number\>**
- **!jar \<paragraph number\>**
- **!help**
