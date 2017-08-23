const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");
const log = require("log4js").getLogger('hangman');
const cardFetcher = new (require("./card"))();

class MtgHangman {
    constructor() {
        this.commands = ["hangman"];
        this.cardApi = "https://api.scryfall.com/cards/random";
        this.gameTime = 3*60*1000; // minutes
        this.runningGames = [];
    }

    getCommands() {
        return this.commands;
    }

    // generate the embed card
    generateEmbed(card, difficulty, letters = [], done = false) {
        // count number of wrong letters and missing letters
        const wrong = letters.filter(c => card.name.toLowerCase().indexOf(c) === -1).length;
        const missing = _.difference(_.uniq(card.name.replace(/[^a-z]/ig,'').toLowerCase().split("")), letters);

        // generate embed title
        const title = 'Guess the card: '+card.name.replace(/[a-z]/ig, c => letters.indexOf(c.toLowerCase()) < 0 ? '-':c);
        let description = "";
        // hard is without mana cost
        if(difficulty !== "hard") {
            description += cardFetcher.renderEmojis(card.mana_cost)+'\n';
        }
        // easy is with type line
        if(difficulty === "easy") {
            description += "**"+card.type_line+"**\n";
        }

        description += '```' +
            '   ____     \n' +
            `  |    |    Missing: ${missing.length} letter(s)\n` +
            `  |    ${wrong > 0 ? 'o':' '}    Guessed: ${letters.join("").toUpperCase()}\n` +
            `  |   ${wrong > 2 ? '/':' '}${wrong > 1 ? '|':' '}${wrong > 3 ? '\\':' '}   Correct: ${Math.round(100-(wrong/(letters.length || 1))*100)}%\n` +
            `  |    ${wrong > 1 ? '|':' '}    \n` +
            `  |   ${wrong > 4 ? '/':' '} ${wrong > 5 ? '\\':' '}   \n` +
            ' _|________```';

        // instantiate embed object
        const embed = new Discord.RichEmbed({
            title,
            description,
            footer: {text: "You have "+this.gameTime/60000+" minutes to guess the card."}
        });

        // game is over
        if (done || !missing.length || wrong > 6) {
            embed.setTitle(card.name);
            embed.setFooter(missing.length ? 'You failed to guess the card!':'You guessed the card!');
            embed.setURL(card.scryfall_uri);
            embed.setImage(card.image_uri);
            embed.setColor(missing.length ? 0xff0000 : 0x00ff00);
        }

        return embed;
    }

    handleMessage(command, parameter, msg) {
        // check for already running games
        const id = msg.guild ? msg.guild.id : msg.author.id;
        if (this.runningGames.indexOf(id) > -1) {
            msg.channel.send('', {embed: new Discord.RichEmbed({
                title: "Error",
                description: "You can only start one hangman game every "+this.gameTime/60000+" minutes.",
                color: 0xff0000
            })});
            return;
        }

        // add guild / author to running IDs
        this.runningGames.push(id);

        const difficulty = parameter.toLowerCase().split(" ")[0]; // can be "easy" or "hard" or blank (=medium)

        // fetch data from API
        rp({url: this.cardApi, json: true}).then(body => {
            if (body.name) {
                const letters = [];
                const embed = this.generateEmbed(body, difficulty);
                return msg.channel.send('', {embed}).then(sentMessage => {
                    sentMessage.react('❓');
                    sentMessage.createReactionCollector(
                        ({emoji}) => emoji.name.charCodeAt(0) === 55356 && emoji.name.charCodeAt(1) >= 56806 && emoji.name.charCodeAt(1) <= 56831,
                        {time: this.gameTime, max: 30}
                    ).on('collect', (reaction, collector) => {
                        // get emoji character (we only accept :regional_indicator_X: emojis)
                        const char = String.fromCharCode(reaction.emoji.name.charCodeAt(1) - 56709);
                        if (letters.indexOf(char) < 0) {
                            letters.push(char);
                        }
                        const embed = this.generateEmbed(body, difficulty, letters);
                        sentMessage.edit('', {embed});
                        // is the game over? then stop the collector
                        if (embed.image && embed.image.url) {
                            collector.stop('finished');
                        }
                    }).on('end', (collected, reason) => {
                        // game is already over, don't edit message again
                        if (reason != "finished") {
                            sentMessage.edit('', {embed: this.generateEmbed(body, difficulty, letters, true)});
                        }
                        // remove guild / author ID from running games
                        _.pull(this.runningGames, id);
                    });
                });
            }
        }, err => {
            log.error("Error getting random card from API", err.error.details);
            _.pull(this.runningGames, id);
        });
    }
}

module.exports = MtgHangman;
