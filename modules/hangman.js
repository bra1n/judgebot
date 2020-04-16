const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");
const utils = require("../utils");
const log = utils.getLogger('hangman');
const Card = require("./card");
const cardFetcher = new Card();

class MtgHangman {
    constructor() {
        this.commands = {
            hangman: {
                aliases: [],
                inline: false,
                description: 'Start a game of hangman, where you have to guess the card name with reaction letters',
                help: 'Selects a random Magic card, token oder plane and shows you the ' +
                'placeholders for each letter in its name. To guess a letter, add a reaction to the ' +
                'Hangman-message of the bot. Reactions have to be selected among the regional indicators ' +
                ':regional_indicator_a: to :regional_indicator_z:. You can only have one active game of ' +
                'Hangman per Discord server, but you can also start an additional one in a private query.\n\n' +
                '**Difficulty**:\n' +
                'With an optional parameter you can select the difficulty. Available are `easy`, `medium` ' +
                'and `hard`. Default is medium. "Easy" includes the mana cost and type line, "Medium" includes ' +
                'the mana cost and "Hard" doesn\'t include any hints.',
                examples: ["!hangman", "!hangman easy"]
            }
        };
        this.cardApi = "https://api.scryfall.com/cards/random";
        this.gameTime = 3*60*1000; // minutes
        this.runningGames = {};
    }

    getCommands() {
        return this.commands;
    }

    // generate the embed card
    generateEmbed(card, difficulty, letters = [], done = false, forceCorrect = false) {
        // count number of wrong letters and missing letters
        const wrong = letters.filter(c => card.name.toLowerCase().indexOf(c) === -1).length;
        let missing;
        
        // Allow guessing to force the correct answer
        if (forceCorrect){
            missing = 0;
        } else {
            missing = _.difference(_.uniq(card.name.replace(/[^a-z]/ig, '').toLowerCase().split("")), letters);
        }

        // generate embed title
        const title = card.name.replace(/[a-z]/ig, c => letters.indexOf(c.toLowerCase()) < 0 ? '⬚':c);
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
            ' _|________```\n' +
            'Use :regional_indicator_a::regional_indicator_b::regional_indicator_c: ... :regional_indicator_z: ' +
            'reactions to pick letters.';

        // instantiate embed object
        const embed = new Discord.MessageEmbed()
            .setTitle(title)
            .addFields({name: 'Guess the card:', value: description})
            .setFooter('You have ' + this.gameTime / 60000 + ' minutes to guess the card.');

        // game is over
        if (done || !missing.length || wrong > 6) {
            embed.setTitle(card.name);
            embed.setFooter(missing.length ? 'You failed to guess the card!':'You guessed the card!');
            embed.setURL(card.scryfall_uri);
            if (card.layout === 'transform' && card.card_faces && card.card_faces[0].image_uris) {
                embed.setImage(card.card_faces[0].image_uris.normal);
            } else if(card.image_uris) {
                embed.setImage(card.image_uris.normal);
            }
            embed.setColor(missing.length ? 0xff0000 : 0x00ff00);
        }

        return embed;
    }

    handleMessage(command, parameter, msg) {
        const [first, ...rest] = parameter.toLowerCase().split(" ");

        // check for already running games
        const id = msg.guild ? msg.guild.id : msg.author.id;
        if (id in this.runningGames) {
            const game = this.runningGames[id];
            // The user can !hangman guess Some Card Name
            if (first === 'guess'){
                const correct = this.runningGames[id].body.name.toLowerCase();
                const guess = rest.join(' ').toLowerCase();
                if (guess.includes(correct)){
                    // If they're correct, pretend we guessed all the letters individually
                    const embed = this.generateEmbed(
                        game.body,
                        game.difficulty,
                        game.letters,
                        true,
                        true
                    );
                    game.message.edit('', {embed});
                    game.collector.stop('finished');
                    msg.react('✅');
                }
                else {
                    msg.react('❎');
                }
            }
            else {
                msg.channel.send('', {
                    embed: new Discord.MessageEmbed({
                        title: "Error",
                        description: "You can only start one hangman game every " + this.gameTime / 60000 + " minutes.",
                        color: 0xff0000
                    })
                });
            }
            return;
        }

        // Add an empty dict to the running games dictionary so we don't make duplicates
        this.runningGames[id] = {};

        const difficulty = first; // can be "easy" or "hard" or blank (=medium)

        // fetch data from API
        rp({url: this.cardApi, json: true}).then(body => {
            if (body.name) {
                const letters = [];
                const embed = this.generateEmbed(body, difficulty);
                return msg.channel.send('', {embed}).then(sentMessage => {
                    sentMessage.react('❓');
                    const collector = sentMessage.createReactionCollector(
                        ({emoji}) => emoji.name.charCodeAt(0) === 55356 && emoji.name.charCodeAt(1) >= 56806 && emoji.name.charCodeAt(1) <= 56831,
                        {time: this.gameTime}
                    ).on('collect', (reaction) => {
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
                        if (reason !== "finished") {
                            sentMessage.edit('', {embed: this.generateEmbed(body, difficulty, letters, true)});
                        }
                        // remove guild / author ID from running games
                        delete this.runningGames[id];
                    });
                    // Update the game dictionary with pertinent information
                    this.runningGames[id] = {
                        message: sentMessage,
                        collector: collector,
                        body: body,
                        difficulty: difficulty,
                        letters: letters
                    };
                }).catch(() => {});
            }
        }, err => {
            log.error("Error getting random card from API", err.error.details);
            msg.channel.send('', {embed: new Discord.MessageEmbed({
                title: "Error",
                description: "Scryfall is currently offline and can't generate us a random card, please try again later.",
                color: 0xff0000
            })});
            delete this.runningGames[id];
        }).catch(() => {});
    }
}

module.exports = MtgHangman;
