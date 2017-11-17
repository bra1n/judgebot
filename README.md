# MTG Discord Bot 
[![Discord Bots](https://discordbots.org/api/widget/240537940378386442.png)](https://discordbots.org/bot/240537940378386442?utm_source=widget)

Discord Bot for Magic / Judge related content

[Add the bot to your server](https://discordapp.com/oauth2/authorize?client_id=240537940378386442&scope=bot&permissions=314432)

## Setup

Clone the Git repository and run the following commands:
```sh
npm install
export DISCORD_TOKEN="<your Discord bot token>"
export GOOGLE_TOKEN="<your Google (Maps) API key>"
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
- **!stores \<location name\>**: searches for the closest Magic stores near the provided location, *Example: !stores new york*
- **!events \<store name\>**: shows the next 6 Magic events for the provided store, *Example: !events funtainment*
- **!hangman \<easy|medium|hard\>**: starts a game of Hangman where you guess a Magic card name with Discord reactions, *Example: !hangman easy*
- **!standard**: shows all sets that are currently legal in Standard
- **!cr \<paragraph number\>**: shows the chosen paragraph from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !cr 100.6b*
- **!define \<keyword\>**: shows the chosen keyword definition from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !define banding*
- **!ipg \<paragraph number\>**: shows the chosen (sub-)section from the [Infraction Procedure Guide](http://blogs.magicjudges.org/rules/ipg/), *Example: !ipg 2.1, !ipg hce philosophy*
- **!mtr \<paragraph number\>**: shows the chose section from the [Magic: The Gathering Tournament Rules](http://blogs.magicjudges.org/rules/mtr/), *Example: !mtr 3, !mtr 4.2*
- **!help \<optional command name\>**: show a list of available commands (in a direct message), or detailed help for the provided command name, *Example: !help events*

## Badges
[![Code Climate](https://codeclimate.com/github/bra1n/judgebot/badges/gpa.svg)](https://codeclimate.com/github/bra1n/judgebot)
