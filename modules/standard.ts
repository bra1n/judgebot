import * as utils from "../utils.js";
import { Discord, Slash, SlashChoice, SlashOption } from "discordx";
import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import _ from "lodash";
import fetch from "node-fetch";

const log = utils.getLogger("standard");

interface WhatsInStandard {
  deprecated: boolean;
  sets: StandardSet[];
}

interface StandardSet {
  name: string;
  enterDate: StandardDate;
  exitDate: StandardDate;
}

interface StandardDate {
  exact: string;
  rough: string;
}

@Discord()
export default class Standard {
  static api = "https://whatsinstandard.com/api/v6/standard.json";
  static cacheExpireTime = 24 * 60 * 60 * 1000; //day in milliseconds

  cachedEmbed: EmbedBuilder | null;
  cachedTime: number | null;

  constructor() {
    this.cachedEmbed = null;
    this.cachedTime = null;
    this.loadList().then(() => {
      log.info("Standard is cached");
    });
  }

  generateEmbed(setList: WhatsInStandard): EmbedBuilder {
    const currentDate = new Date();
    const removedFutureAndPastSetList = setList.sets.filter((set) => {
      // A set is in standard if:
      // It has been released, and
      return (
        set.enterDate.exact !== null &&
        // It was released before today, and
        currentDate.getTime() >= new Date(set.enterDate.exact).getTime() &&
        // The exit date is unknown, or in the future
        (set.exitDate.exact === null ||
          currentDate.getTime() < new Date(set.exitDate.exact).getTime())
      );
    });
    const groupedSetList = _.groupBy(
      removedFutureAndPastSetList,
      (set) => set.exitDate.rough
    );
    const descriptions: string[] = [];
    _.forEach(groupedSetList, (value, key) => {
      descriptions.push(
        "*Rotates ",
        key,
        ":*```",
        value.map((set) => set.name).join(" | "),
        "```\n"
      );
    });
    const embed = new EmbedBuilder({
      title: "Currently in Standard",
      url: "http://whatsinstandard.com/",
      description: descriptions.join(""),
    });
    this.cachedEmbed = embed;
    this.cachedTime = currentDate.getTime();
    return embed;
  }

  async loadList(): Promise<EmbedBuilder> {
    try {
      const res = await fetch(Standard.api);
      const body = await res.json();
      return await this.generateEmbed(body as WhatsInStandard);
    } catch (err) {
      log.error("Error getting Standard list", err);
      return new EmbedBuilder({
        title: "Standard - Error",
        description: "Couldn't create Standard list.",
        color: 0xff0000,
      });
    }
  }

  @Slash({
    name: "standard",
    description:
      "Lists the currently standard legal sets and when they will rotate",
  })
  async standard(interaction: CommandInteraction) {
    if (
      this.cachedEmbed !== null &&
      this.cachedTime !== null &&
      new Date().getTime() - this.cachedTime < Standard.cacheExpireTime
    ) {
      await interaction.reply({ embeds: [this.cachedEmbed] });
    } else {
      const embed = await this.loadList();
      await interaction.reply({ embeds: [embed] });
    }
  }
}
