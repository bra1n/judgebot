import _ from "lodash";
import * as utils from "../utils.js";
import MtgCardLoader from "./card.js";
import {CommandInteraction, Message, MessageEmbed, MessageReaction, ReactionCollector} from "discord.js";
import {Discord, Slash, SlashChoice, SlashOption} from "discordx";
import * as Scry from "scryfall-sdk";

const log = utils.getLogger('hangman');
const cardFetcher = new MtgCardLoader();

const GAME_TIME = 3 * 60 * 1000; // minutes

enum Difficulty {
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard"
}

interface HangmanGameProps {
        id: string;
        gameList: Record<string, HangmanGame>;
        message?: Message;
        collector?: ReactionCollector;
        card: Scry.Card;
        difficulty: Difficulty;

}

class HangmanGame {
    card: Scry.Card;
    collector: ReactionCollector | null;
    difficulty: Difficulty;
    done: boolean;
    gameList: Record<string, HangmanGame>;
    gameSuccess: boolean;
    id: string;
    letters: Set<string>;
    message: Message | null ;
    wrongGuesses: number;

    constructor({
                    id,
                    gameList,
                    message,
                    collector,
                    card,
                    difficulty = Difficulty.MEDIUM
                }: HangmanGameProps) {
        this.id = id;
        this.gameList = gameList;
        this.message = message || null;
        this.collector = collector || null;
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
    handleLetter(char: string) {
        // Letters is a set, which handles duplicates for us
        this.letters.add(char);
        this.checkDone();
        this.updateEmbed();
    }

    /**
     * Handle a user guessing the entire card name
     */
    async handleGuess(guess: string, msg: CommandInteraction) {
        const correct = this.card.name.toLowerCase();
        if (guess.includes(correct)) {
            // If they're correct, pretend we guessed all the letters individually
            this.setDone(true);
            this.updateEmbed();
        } else {
            this.wrongGuesses++;
            this.checkDone();
            await msg.reply('❎');
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
    setDone(correct: boolean = false) {
        this.done = true;
        this.gameSuccess = correct;
        this.updateEmbed();
        if (this.collector) {
            this.collector.stop('cancelled');
        }

        // remove guild / author ID from running games
        delete this.gameList[this.id];
    }

    /**
     * Using the stored parameters, updates the embed for the specified game
     */
    updateEmbed() {
        if (this.message) {
            this.message.edit({embeds: [this.generateEmbed()]});
        }
    }

    /**
     * An array of letters that have not yet been guessed
     */
    get missing(): string[] {
        const letterArr: string[] = Array.from(this.letters.values());
        return _.difference(_.uniq(this.card.name.replace(/[^a-z]/ig, '').toLowerCase().split('')), letterArr);
    }

    /**
     * The number of wrong guesses made in this game
     */
    get wrong(): number {
        const letterArr: string[] = Array.from(this.letters.values());

        // The total number of mistakes is the sum of the incorrect letters, and incorrect guesses
        return letterArr.filter(c => this.card.name.toLowerCase().indexOf(c) === -1).length + this.wrongGuesses;
    }

    /**
     * Return a discord Embed derived from this game
     */
    generateEmbed(): MessageEmbed {
        const missing = this.missing;
        const wrong = this.wrong;
        let totalGuesses = this.letters.size + this.wrongGuesses;

        const letterArr = Array.from(this.letters.values());

        const correctPercent = Math.round((1 - (wrong / (totalGuesses || 1))) * 100);

        // generate embed title
        const title = this.card.name.replace(/[a-z]/ig, (c) => !this.letters.has(c.toLowerCase()) ? '⬚' : c);
        let description = '';
        // hard is without mana cost
        if (this.difficulty !== 'hard') {
            description += cardFetcher.renderEmojis(this.card?.mana_cost || "") + '\n';
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
        const embed = new MessageEmbed({
            author: {name: 'Guess the card:'},
            title,
            description,
            footer: {text: 'You have ' + GAME_TIME / 60000 + ' minutes to guess the card.'}
        });

        // game is over
        if (this.done) {
            embed.setTitle(this.card.name);
            embed.setFooter(this.gameSuccess ? 'You guessed the card!' : 'You failed to guess the card!');
            embed.setURL(this.card.scryfall_uri);
            // @ts-ignore https://github.com/ChiriVulpes/scryfall-sdk/pull/42
            if ((this.card.layout === 'transform' || this.card.layout === 'modal_dfc') && this.card.card_faces && this.card.card_faces[0].image_uris) {
                embed.setImage(this.card.card_faces[0].image_uris.normal);
            } else if (this.card.image_uris) {
                embed.setImage(this.card.image_uris.normal);
            }
            embed.setColor(this.gameSuccess ? 0x00ff00 : 0xff0000);
        }

        return embed;
    }
}

@Discord()
export default class MtgHangman {
    runningGames: Record<string, HangmanGame>;

    constructor() {
        this.runningGames = {};
    }

    @Slash("guess", {
        description: 'Outright guess the hangman magic card.'
    })
    guess(
        @SlashOption("card", {
            description: "Name of the card you believe is the answer to the hangman puzzle"
        })
            guess: string,
        interaction: CommandInteraction
    ) {
        const id = interaction.guildId || interaction.user.id;

        if (id in this.runningGames) {
            const game = this.runningGames[id];
            // The user can !hangman guess Some Card Name
            game.handleGuess(guess, interaction);
        } else {
            // Handle the case where we "!hangman guess" but no game has started
            interaction.reply({
                embeds: [new MessageEmbed({
                    title: 'Error',
                    description: 'No hangman game is currently running in this server. Guess ignored.',
                    color: 0xff0000
                })]
            });
        }
    }

    @Slash("hangman", {
        description: 'Start a game of hangman, where you have to guess the card name with reaction letters'
    })
    async hangman(
        @SlashChoice("Easy", 'easy')
        @SlashChoice("Medium", 'medium')
        @SlashChoice("Hard", 'hard')
        @SlashOption("difficulty", { description: "How difficult the hangman game should be" })
        difficulty: string,
        interaction: CommandInteraction
    ) {
        // check for already running games
        const id = interaction.guildId || interaction.user.id;
        if (id in this.runningGames) {
            interaction.reply({
                embeds: [new MessageEmbed({
                    title: 'Error',
                    description: 'You can only start one hangman game every ' + GAME_TIME / 60000 + ' minutes.',
                    color: 0xff0000
                })]
            });
        } else {
            // Create the new game
            let card: Scry.Card;
            try {
                card = await Scry.Cards.random();
            }
            catch {
                await interaction.reply({
                    embeds: [new MessageEmbed({
                        title: 'Error',
                        description: 'Scryfall is currently offline and can\'t generate us a random card, please try again later.',
                        color: 0xff0000
                    })]
                });
                return;
            }
            const game = this.runningGames[id] = new HangmanGame({
                card: card,
                id: id,
                difficulty: difficulty as Difficulty,
                gameList: this.runningGames
            });

                const embed = game.generateEmbed();
                game.message = <Message>await interaction.reply({embeds: [embed], fetchReply: true});
                await game.message.react('❓');
            game.collector = game.message.createReactionCollector({
                    filter: ({emoji}) => !!emoji.name && emoji.name.charCodeAt(0) === 55356 && emoji.name.charCodeAt(1) >= 56806 && emoji.name.charCodeAt(1) <= 56831,
                    time: GAME_TIME
                }).on('collect', (reaction: MessageReaction) => {
                    // get emoji character (we only accept :regional_indicator_X: emojis)
                if (reaction.emoji.name) {
                    const char = String.fromCharCode(reaction.emoji.name.charCodeAt(1) - 56709);
                    game.handleLetter(char);
                }
                }).on('end', (collected, reason) => {
                    // If we cancelled the collector, the game state has already been updated
                    // If the time ran out, however, we know that the game was lost
                    if (reason === 'time')
                        game.setDone(false);
                });
            }

    }
}