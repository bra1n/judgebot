import _ from "lodash";
import * as utils from "../utils.js";
import MtgCardLoader from "./card.js";
import {
  ActionRowBuilder,
  BaseInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  Interaction,
  InteractionCollector,
  Message,
  MessageOptions,
  MessageReaction,
  ReactionCollector,
} from "discord.js";
import { Discord, Slash, SlashChoice, SlashOption } from "discordx";
import * as Scry from "scryfall-sdk";

const log = utils.getLogger("hangman");
const cardFetcher = new MtgCardLoader();

const GAME_TIME = 3 * 60 * 1000; // minutes

enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

interface HangmanGameProps {
  id: string;
  gameList: Record<string, HangmanGame>;
  message?: Message;
  collector?: InteractionCollector<any>;
  card: Scry.Card;
  difficulty: Difficulty;
}

class HangmanGame {
  static ALPHABET = [..."abcdefghijklmnopqrstuvwxyz"];
  // This is A-Z in emoji symbols
  static EMOJI_ALPHABET = new Set(
    Array(26)
      .fill("🇦")
      .map((str: string, i) => String.fromCharCode(str.charCodeAt(0) + i))
  );
  card: Scry.Card;
  collector: InteractionCollector<any> | null;
  difficulty: Difficulty;
  done: boolean;
  gameList: Record<string, HangmanGame>;
  gameSuccess: boolean;
  id: string;
  letters: Set<string>;
  message: Message | null;
  wrongGuesses: number;

  constructor({
    id,
    gameList,
    message,
    collector,
    card,
    difficulty = Difficulty.MEDIUM,
  }: HangmanGameProps) {
    this.id = id;
    this.gameList = gameList;
    this.message = message || null;
    this.collector = collector || null;
    this.card = card;
    this.difficulty = difficulty;

    // Letters that have been guessed
    this.letters = new Set();
    this.wrongGuesses = 0;
    this.done = false;
    this.gameSuccess = false;
  }

  static letterToEmoji(letter: string): string {
    return String.fromCodePoint(
      (letter.toLowerCase().codePointAt(0) as number) +
        ("🇦".codePointAt(0) as number) -
        ("a".codePointAt(0) as number)
    );
  }

  /**
   * Handle a user guessing a letter in the card name
   */
  async handleLetter(interaction: ButtonInteraction) {
    // Letters is a set, which handles duplicates for us
    this.letters.add(interaction.customId);
    const done = await this.checkDone(interaction);
    if (!done) {
      await this.updateEmbed(interaction);
    }
  }

  /**
   * Handle a user guessing the entire card name
   */
  async handleGuess(guess: string, interaction: CommandInteraction) {
    const correct = this.card.name.toLowerCase();
    if (guess.includes(correct)) {
      await this.setDone(true);
      await interaction.reply("✅");
      await this.updateEmbed(interaction);
    } else {
      this.wrongGuesses++;
      await this.checkDone(interaction);
      await interaction.reply("❎");
      await this.updateEmbed(interaction);
    }
  }

  /**
   * Checks if the game should finish
   * Returns true if we are now done.
   */
  async checkDone(interaction?: BaseInteraction): Promise<boolean> {
    if (!this.missing.length) {
      await this.setDone(true, interaction);
      return true;
    }
    if (this.wrong > 6) {
      await this.setDone(false, interaction);
      return true;
    }
    return false;
  }

  /**
   * Indicates that this game is finished
   */
  async setDone(correct: boolean = false, interaction?: BaseInteraction) {
    this.done = true;
    this.gameSuccess = correct;
    await this.updateEmbed(interaction);
    if (this.collector) {
      this.collector.stop("cancelled");
    }

    // remove guild / author ID from running games
    delete this.gameList[this.id];
  }

  /**
   * Using the stored parameters, updates the embed for the specified game
   */
  async updateEmbed(interaction?: BaseInteraction) {
    // We have to reply to the correct interaction to make discord happy
    if (interaction && interaction.isButton()) {
      await interaction.update(this.generateMessage());
    } else if (this.message) {
      await this.message.edit(this.generateMessage());
    }
  }

  /**
   * An array of letters in the card that have not yet been guessed
   */
  get missing(): string[] {
    const letterArr: string[] = Array.from(this.letters.values());
    return _.difference(
      _.uniq(
        this.card.name
          .replace(/[^a-z]/gi, "")
          .toLowerCase()
          .split("")
      ),
      letterArr
    );
  }

  /**
   * The number of wrong guesses made in this game
   */
  get wrong(): number {
    const letterArr: string[] = Array.from(this.letters.values());

    // The total number of mistakes is the sum of the incorrect letters, and incorrect guesses
    return (
      letterArr.filter((c) => this.card.name.toLowerCase().indexOf(c) === -1)
        .length + this.wrongGuesses
    );
  }

  getButtons(): ActionRowBuilder<ButtonBuilder>[] {
    if (this.done) {
      return [];
    }
    // We can only show 25 characters at a time, so hide q or the first letter we guessed
    const alphabet = new Set(HangmanGame.ALPHABET);
    if (this.letters.size == 0) {
      alphabet.delete("q");
    } else {
      for (let letter of this.letters) {
        alphabet.delete(letter);
        break;
      }
    }
    // Can only have up to 25 buttons
    // const options = _.difference(HangmanGame.ALPHABET, Array.from(this.letters)).slice(0, 25);
    return _.chunk(Array.from(alphabet), 5).map((grp) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        grp.map((letter) =>
          new ButtonBuilder()
            .setLabel(HangmanGame.letterToEmoji(letter))
            .setCustomId(letter)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              // Disable it if it has been guessed
              this.letters.has(letter)
            )
        )
      );
    });
  }

  /**
   * Return a discord Embed derived from this game
   */
  generateMessage() {
    const missing = this.missing;
    const wrong = this.wrong;
    let totalGuesses = this.letters.size + this.wrongGuesses;

    const letterArr = Array.from(this.letters.values());

    const correctPercent = Math.round((1 - wrong / (totalGuesses || 1)) * 100);

    // generate embed title
    const title = this.card.name.replace(/[a-z]/gi, (c) =>
      !this.letters.has(c.toLowerCase()) ? "⬚" : c
    );
    let description = "";
    // hard is without mana cost
    if (this.difficulty !== "hard") {
      description +=
        cardFetcher.renderEmojis(this.card?.mana_cost || "") + "\n";
    }
    // easy is with type line
    if (this.difficulty === "easy") {
      description += "**" + this.card.type_line + "**\n";
    }

    description +=
      "```\n" +
      "   ____     \n" +
      `  |    |    Missing: ${missing.length} letter(s)\n` +
      `  |    ${wrong > 0 ? "o" : " "}    Guessed: ${letterArr
        .join("")
        .toUpperCase()}\n` +
      `  |   ${wrong > 2 ? "/" : " "}${wrong > 1 ? "|" : " "}${
        wrong > 3 ? "\\" : " "
      }   Correct: ${correctPercent}%\n` +
      `  |    ${wrong > 1 ? "|" : " "}    \n` +
      `  |   ${wrong > 4 ? "/" : " "} ${wrong > 5 ? "\\" : " "}   \n` +
      " _|________\n```\n" +
      "Use the buttons below to guess letters, or use `/solve` to guess outright.";

    // instantiate embed object
    const embed = new EmbedBuilder({
      title,
      description,
      footer: {
        text: "You have " + GAME_TIME / 60000 + " minutes to guess the card.",
      },
    });

    // game is over
    if (this.done) {
      embed.setTitle(this.card.name);
      embed.setFooter({
        text: this.gameSuccess
          ? "You guessed the card!"
          : "You failed to guess the card!",
      });
      embed.setURL(this.card.scryfall_uri);
      // @ts-ignore https://github.com/ChiriVulpes/scryfall-sdk/pull/42
      if (
        (this.card.layout === "transform" ||
          this.card.layout === "modal_dfc") &&
        this.card.card_faces &&
        this.card.card_faces[0].image_uris
      ) {
        embed.setImage(this.card.card_faces[0].image_uris.normal);
      } else if (this.card.image_uris) {
        embed.setImage(this.card.image_uris.normal);
      }
      embed.setColor(this.gameSuccess ? 0x00ff00 : 0xff0000);
    }

    return {
      embeds: [embed],
      components: this.getButtons(),
    };
  }
}

@Discord()
export default class MtgHangman {
  runningGames: Record<string, HangmanGame>;

  constructor() {
    this.runningGames = {};
  }

  @Slash({
    name: "solve",
    description: "Outright guess the hangman magic card.",
  })
  async solve(
    @SlashOption({
      name: "card",
      description:
        "Name of the card you believe is the answer to the hangman puzzle",
    })
    guess: string,
    interaction: CommandInteraction
  ) {
    const id = interaction.guildId || interaction.user.id;

    if (id in this.runningGames) {
      const game = this.runningGames[id];
      // // The user can !hangman guess Some Card Name
      await game.handleGuess(guess, interaction);
    } else {
      // Handle the case where we "!hangman guess" but no game has started
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(
              "No hangman game is currently running in this server. Guess ignored."
            )
            .setColor(0xff0000),
        ],
      });
    }
  }

  @Slash({
    name: "hangman",
    description:
      "Start a game of hangman, where you have to guess the card name with reaction letters",
  })
  async hangman(
    @SlashChoice("Easy", "easy")
    @SlashChoice("Medium", "medium")
    @SlashChoice("Hard", "hard")
    @SlashOption({
      name: "difficulty",
      description: "How difficult the hangman game should be",
    })
    difficulty: string,
    interaction: CommandInteraction
  ) {
    // check for already running games
    const id = interaction.guildId || interaction.user.id;
    if (id in this.runningGames) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(
              "You can only start one hangman game every " +
                GAME_TIME / 60000 +
                " minutes."
            )
            .setColor(0xff0000),
        ],
      });
    } else {
      // Create the new game
      let card: Scry.Card;
      try {
        card = await Scry.Cards.random();
      } catch {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("Error")
              .setDescription(
                "Scryfall is currently offline and can't generate us a random card, please try again later."
              )
              .setColor(0xff0000),
          ],
        });
        return;
      }
      const game = (this.runningGames[id] = new HangmanGame({
        card: card,
        id: id,
        difficulty: difficulty as Difficulty,
        gameList: this.runningGames,
      }));

      const message = game.generateMessage();
      game.message = <Message>(
        await interaction.reply({ ...message, fetchReply: true })
      );
      game.collector = game.message
        .createMessageComponentCollector({
          time: GAME_TIME,
        })
        .on("collect", async (interaction: ButtonInteraction) => {
          // get emoji character (we only accept :regional_indicator_X: emojis)
          await game.handleLetter(interaction);
        })
        .on("end", (collected, reason) => {
          // If we cancelled the collector, the game state has already been updated
          // If the time ran out, however, we know that the game was lost
          if (reason === "time") game.setDone(false);
        });
    }
  }
}
