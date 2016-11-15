# MTG Discord Bot
[![Code Climate](https://codeclimate.com/github/bra1n/judgebot/badges/gpa.svg)](https://codeclimate.com/github/bra1n/judgebot)

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
- **!define \<keyword\>**: shows the chosen keyword definition from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !define banding*
- **!ipg \<paragraph number\>**: shows the chosen paragraph from the [Infraction Procedure Guide](http://blogs.magicjudges.org/rules/ipg/), *Example: !ipg 2.1, !ipg hce*
- **!help**: show a list of available commands (in a direct message)

## Coming soon

- **!mtr \<paragraph number\>**
- **!jar \<paragraph number\>**
