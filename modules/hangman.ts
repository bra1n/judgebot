const rp = require('request-promise-native');
const _ = require('lodash');
const Discord = require('discord.js');
const utils = require('../utils');
const log = utils.getLogger('hangman');
const Card = require('./card');
const cardFetcher = new Card();

const GAME_TIME = 3 * 60 * 1000; // minutes

class HangmanGame {
    constructor({
                    id,
                    gameList,
                    message = null,
                    collector = null,
                    card = null,
                    difficulty = 'medium',
                } = {}) {
        this.id = id;
        this.gameList = gameList;
        this.message = message;
        this.collector = collector;
        this.card = card;
        this.difficulty = difficulty;

        this.letters = new Set();
        this.wrongGuesses = 0;
        this.done = false;
        this.gameSuccess = false;
    }

    /**
     * Handle a user guessing a letter in the card name
     * @param {String} char The character that was guessed
     */
    handleLetter(char) {
        // Letters is a set, which handles duplicates for us
        this.letters.add(char);
        this.checkDone();
        this.updateEmbed(false);
    }

    /**
     * Handle a user guessing the entire card name
     * @param {String} guess
     * @param {Discord.Message} msg
     */
    handleGuess(guess, msg) {
        const correct = this.card.name.toLowerCase();
        if (guess.includes(correct)) {
            // If they're correct, pretend we guessed all the letters individually
            this.setDone(true);
            this.updateEmbed();
        }
        else {
            this.wrongGuesses++;
            this.checkDone();
            msg.react('❎');
            this.updateEmbed();
        }
    }

    /**
     * Checks if the game should finish
     */
    checkDone() {
        if (!this.missing.length) {
            this.setDone(true);
        }
        if (this.wrong > 6) {
            this.setDone(false);
        }
    }

    /**
     * Indicates that this game is finished
     */
    setDone(correct = false) {
        this.done = true;
        this.gameSuccess = correct;
        this.updateEmbed();
        this.collector.stop('cancelled');

        // remove guild / author ID from running games
        delete this.gameList[this.id];
    }

    /**
     * Using the stored parameters, updates the embed for the specified game
     */
    updateEmbed() {
        this.message.edit('', {embed: this.generateEmbed()});
    }

    /**
     * An array of letters that have not yet been guessed
     * @returns {Array}
     */
    get missing() {
        const letterArr = Array.from(this.letters.values());
        return _.difference(_.uniq(this.card.name.replace(/[^a-z]/ig, '').toLowerCase().split('')), letterArr);
    }

    /**
     * The number of wrong guesses made in this game
     * @returns {number}
     */
    get wrong() {
        const letterArr = Array.from(this.letters.values());

        // The total number of mistakes is the sum of the incorrect letters, and incorrect guesses
        return letterArr.filter(c => this.card.name.toLowerCase().indexOf(c) === -1).length + this.wrongGuesses;
    }

    /**
     * Return a discord Embed derived from this game
     * @returns {module:"discord.js".MessageEmbed}
     */
    generateEmbed() {
        const missing = this.missing;
        const wrong = this.wrong;
        let totalGuesses = this.letters.size + this.wrongGuesses;

        const letterArr = Array.from(this.letters.values());

        const correctPercent = Math.round((1 - (wrong / (totalGuesses || 1))) * 100);

        // generate embed title
        const title = this.card.name.replace(/[a-z]/ig, c => !this.letters.has(c.toLowerCase()) ? '⬚' : c);
        let description = '';
        // hard is without mana cost
        if (this.difficulty !== 'hard') {
            description += cardFetcher.renderEmojis(this.card.mana_cost) + '\n';
        }
        // easy is with type line
        if (this.difficulty === 'easy') {
            description += '**' + this.card.type_line + '**\n';
        }

        description += '```\n' +
            '   ____     \n' +
            `  |    |    Missing: ${missing.length} letter(s)\n` +
            `  |    ${wrong > 0 ? 'o' : ' '}    Guessed: ${letterArr.join('').toUpperCase()}\n` +
            `  |   ${wrong > 2 ? '/' : ' '}${wrong > 1 ? '|' : ' '}${wrong > 3 ? '\\' : ' '}   Correct: ${correctPercent}%\n` +
            `  |    ${wrong > 1 ? '|' : ' '}    \n` +
            `  |   ${wrong > 4 ? '/' : ' '} ${wrong > 5 ? '\\' : ' '}   \n` +
            ' _|________\n```\n' +
            'Use :regional_indicator_a::regional_indicator_b::regional_indicator_c: ... :regional_indicator_z: ' +
            'reactions to pick letters.';

        // instantiate embed object
        const embed = new Discord.MessageEmbed({
            author: {name: 'Guess the card:'},
            title,
            description,
            footer: {text: 'You have ' + GAME_TIME / 60000 + ' minutes to guess the card.'}
        });

        // game is over
        if (this.done) {
            embed.setTitle(this.card.name);
            embed.setFooter(this.gameSuccess ? 'You guessed the card!' :'You failed to guess the card!');
            embed.setURL(this.card.scryfall_uri);
            if ((this.card.layout === 'transform' || this.card.layout === 'modal_dfc') && this.card.card_faces && this.card.card_faces[0].image_uris) {
                embed.setImage(this.card.card_faces[0].image_uris.normal);
            }
            else if (this.card.image_uris) {
                embed.setImage(this.card.image_uris.normal);
            }
            embed.setColor(this.gameSuccess ? 0x00ff00 : 0xff0000);
        }

        return embed;
    }
}

class MtgHangman {
    constructor() {
        this.commands = {
            hangman: {
                aliases: [],
                inline: false,
                description: 'Start a game of hangman, where you have to guess the card name with reaction letters',
                help: 'Selects a random Magic card, token or plane and shows you the ' +
                    'placeholders for each letter in its name. To guess a letter, add a reaction to the ' +
                    'Hangman-message of the bot. Reactions have to be selected among the regional indicators ' +
                    ':regional_indicator_a: to :regional_indicator_z:. You can also use `!hangman guess some card` ' +
                    'to guess the card outright, but guessing wrongly will be penalised the same as a wrong letter. ' +
                    'You can only have one active game of ' +
                    'Hangman per Discord server, but you can also start an additional one in a private query.\n\n' +
                    '**Difficulty**:\n' +
                    'With an optional parameter you can select the difficulty. Available are `easy`, `medium` ' +
                    'and `hard`. Default is medium. "Easy" includes the mana cost and type line, "Medium" includes ' +
                    'the mana cost and "Hard" doesn\'t include any hints.',
                examples: ['!hangman', '!hangman easy', '!hangman guess yare']
            }
        };
        this.cardApi = 'https://api.scryfall.com/cards/random';
        this.runningGames = {};
    }

    getCommands() {
        return this.commands;
    }

    // generate the embed card

    handleMessage(command, parameter, msg) {
        const [first, ...rest] = parameter.toLowerCase().split(' ');

        // check for already running games
        const id = msg.guild ? msg.guild.id : msg.author.id;
        if (id in this.runningGames) {
            const game = this.runningGames[id];
            // The user can !hangman guess Some Card Name
            if (first === 'guess') {
                const guess = rest.join(' ').toLowerCase();
                game.handleGuess(guess, msg);
            }
            else {
                msg.channel.send('', {
                    embed: new Discord.MessageEmbed({
                        title: 'Error',
                        description: 'You can only start one hangman game every ' + GAME_TIME / 60000 + ' minutes.',
                        color: 0xff0000
                    })
                });
            }
            return;
        }
        else {
            // Handle the case where we "!hangman guess" but no game has started
            if (first === 'guess') {
                msg.channel.send('', {
                    embed: new Discord.MessageEmbed({
                        title: 'Error',
                        description: 'No hangman game is currently running in this server. Guess ignored.',
                        color: 0xff0000
                    })
                });
                return;
            }
        }

        // Create the new game
        const game = this.runningGames[id] = new HangmanGame({
            id: id,
            difficulty: first,
            gameList: this.runningGames
        });

        // fetch data from API
        rp({url: this.cardApi, json: true}).then(body => {
            if (body.name) {
                game.card = body;
                const embed = game.generateEmbed();
                return msg.channel.send('', {embed}).then(sentMessage => {
                    game.message = sentMessage;
                    sentMessage.react('❓');
                    const collector = sentMessage.createReactionCollector(
                        ({emoji}) => emoji.name.charCodeAt(0) === 55356 && emoji.name.charCodeAt(1) >= 56806 && emoji.name.charCodeAt(1) <= 56831,
                        {time: GAME_TIME}
                    ).on('collect', (reaction) => {
                        // get emoji character (we only accept :regional_indicator_X: emojis)
                        const char = String.fromCharCode(reaction.emoji.name.charCodeAt(1) - 56709);
                        game.handleLetter(char);
                    }).on('end', (collected, reason) => {
                        // If we cancelled the collector, the game state has already been updated
                        // If the time ran out, however, we know that the game was lost
                        if (reason === 'time')
                            game.setDone(false);
                    });

                    // Update the game object with pertinent information
                    game.collector = collector;
                }).catch(() => {
                });
            }
        }, err => {
            log.error('Error getting random card from API', err.error.details);
            msg.channel.send('', {
                embed: new Discord.MessageEmbed({
                    title: 'Error',
                    description: 'Scryfall is currently offline and can\'t generate us a random card, please try again later.',
                    color: 0xff0000
                })
            });
            delete this.runningGames[id];
        }).catch(() => {
        });
    }
}

module.exports = MtgHangman;
