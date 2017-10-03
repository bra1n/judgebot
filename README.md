# MTG Discord Bot
[![Code Climate](https://codeclimate.com/github/bra1n/judgebot/badges/gpa.svg)](https://codeclimate.com/github/bra1n/judgebot)

Discord Bot for Magic / Judge related content

[Add the bot to your server](https://discordapp.com/oauth2/authorize?client_id=240537940378386442&scope=bot&permissions=314432)

## Setup

Clone the Git repository and run the following commands:
```sh
npm install
export DISCORD_TOKEN="<your Discord bot token>"
export CR_ADDRESS="http://media.wizards.com/2016/docs/MagicCompRules_20160930.txt"
export IPG_ADDRESS="https://sites.google.com/site/mtgfamiliar/rules/InfractionProcedureGuide-light.html"
export MTR_ADDRESS="https://sites.google.com/site/mtgfamiliar/rules/MagicTournamentRules-light.html"
node server.js
```

## Supported commands

Any supported command can be entered at any place in your message and should end with a second `!` or the end of the message.
For example: `I'm looking for !card tarmogoyf! and !card noble hierarch` would show the cards Tarmogoyf and Noble Hierarch.

- **!card \<partial cardname\>**: searches for an (English) card by name and outputs the card together with an image, if available, supports the full [Scryfall syntax](https://scryfall.com/docs/reference), *Example: !card Tarmogoyf*
- **!price \<partial cardname\>**: searches for an (English) card by name and outputs the card together with prices in USD, EUR and TIX, *Example: !price Tarmogoyf*
- **!legal \<partial cardname\>**: searches for an (English) card by name and outputs the card together with a list of formats where it is legal, *Example: !legal Tarmogoyf*
- **!ruling \<partial cardname\>**: searches for an (English) card by name and outputs the Gatherer rulings for that card, *Example: !ruling Tarmogoyf*
- **!cr \<paragraph number\>**: shows the chosen paragraph from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !cr 100.6b*
- **!define \<keyword\>**: shows the chosen keyword definition from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !define banding*
- **!ipg \<paragraph number\>**: shows the chosen (sub-)section from the [Infraction Procedure Guide](http://blogs.magicjudges.org/rules/ipg/), *Example: !ipg 2.1, !ipg hce philosophy*
- **!mtr \<paragraph number\>**: shows the chose section from the [Magic: The Gathering Tournament Rules](http://blogs.magicjudges.org/rules/mtr/), *Example: !mtr 3, !mtr 4.2*
- **!help**: show a list of available commands (in a direct message)
