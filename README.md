# MTG Discord Bot
[![Discord Bots](https://discordbots.org/api/widget/240537940378386442.png)](https://discordbots.org/bot/240537940378386442?utm_source=widget)

Discord Bot for Magic / Judge related content

[Add the bot to your server](https://discordapp.com/oauth2/authorize?client_id=240537940378386442&scope=bot&permissions=314432)

## Supported commands

Many supported command can be entered at any place in your message and should end with a second `!` or the end of the message.
For example: `I'm looking for !card tarmogoyf! and !card noble hierarch` would show the cards Tarmogoyf and Noble Hierarch.

- **!card \<partial cardname\>**: searches for an (English) card by name and outputs the card together with an image, if available, supports the full [Scryfall syntax](https://scryfall.com/docs/reference), *Example: !card Tarmogoyf*
- **!price \<partial cardname\>**: searches for an (English) card by name and outputs the card together with prices in USD, EUR and TIX, *Example: !price Tarmogoyf*
- **!legal \<partial cardname\>**: searches for an (English) card by name and outputs the card together with a list of formats where it is legal, *Example: !legal Tarmogoyf*
- **!ruling \<partial cardname\>**: searches for an (English) card by name and outputs the Gatherer rulings for that card, *Example: !ruling Tarmogoyf*
- **!art \<partial cardname\>**: searches for an (English) card by name and outputs the artwork for that card together with the artist's name, *Example: !art Tarmogoyf*
- **!stores \<location name\>**: searches for the closest Magic stores near the provided location, *Example: !stores new york*
- **!events \<store name\>**: shows the next 6 Magic events for the provided store, *Example: !events funtainment*
- **!hangman \<easy|medium|hard\>**: starts a game of Hangman where you guess a Magic card name with Discord reactions and the guess command, *Example: !hangman easy*
    - **!hangman guess \<cardname\>**: makes an outright guess of the target card in an existing  game of Hangman, *Example: !hangman guess yare*
- **!standard**: shows all sets that are currently legal in Standard
- **!cr \<paragraph number\>**: shows the chosen paragraph from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !cr 100.6b*
- **!define \<keyword\>**: shows the chosen keyword definition from the [Comprehensive Rules](https://rules.wizards.com/rulebook.aspx?game=Magic&category=Game+Rules), *Example: !define banding*
- **!ipg \<paragraph number\>**: shows the chosen (sub-)section from the [Infraction Procedure Guide](http://blogs.magicjudges.org/rules/ipg/), *Example: !ipg 2.1, !ipg hce philosophy*
- **!mtr \<paragraph number\>**: shows the chose section from the [Magic: The Gathering Tournament Rules](http://blogs.magicjudges.org/rules/mtr/), *Example: !mtr 3, !mtr 4.2*
- **!help \<optional command name\>**: show a list of available commands (in a direct message), or detailed help for the provided command name, *Example: !help events*

## Development Setup

Clone the Git repository and run the following commands:
```sh
npm install
export DISCORD_TOKEN="<your Discord bot token>"
export GOOGLE_TOKEN="<your Google (Maps) API key>"
export CR_ADDRESS="https://media.wizards.com/2020/downloads/MagicCompRules%2020200417.txt"
export IPG_ADDRESS="https://raw.githubusercontent.com/hgarus/mtgdocs/master/docs/ipg.json"
export MTR_ADDRESS="https://sites.google.com/site/mtgfamiliar/rules/MagicTournamentRules-light.html"
node server.js
```

## Badges
[![Code Climate](https://codeclimate.com/github/bra1n/judgebot/badges/gpa.svg)](https://codeclimate.com/github/bra1n/judgebot)

## Acknowledgements

- Card images are all copyright Wizards of the Coast.
- Card database is provided by Scryfall.org.
- This bot is not affiliated with Wizards of the Coast in any way.
- The server is kindly provided by [SKnetworX](http://www.sknetworx.net)
