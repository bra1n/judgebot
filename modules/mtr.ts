import _ from "lodash";
import cheerio from "cheerio";
import * as utils from "../utils.js";
import {
  CommandInteraction,
  EmbedBuilder,
  MessageInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import fetch from "node-fetch";

const log = utils.getLogger("mtr");
const MTR_ADDRESS =
  process.env.MTR_ADDRESS ||
  "https://raw.githubusercontent.com/AEFeinstein/GathererScraper/master/rules/MagicTournamentRules-light.html";

interface Chapter {
  key: string;
  title: string;
  sections: string[];
}

interface Section {
  key: string;
  title: string;
  content: string;
}

@Discord()
export default class MTR {
  static location = "http://blogs.magicjudges.org/rules/mtr";
  static maxLength = 2040;
  static thumbnail =
    "https://assets.magicjudges.org/judge-banner/images/magic-judge.png";
  mtrData: {
    description: string;
    chapters: Record<string, Chapter>;
    sections: Record<string, Section>;
  };
  constructor(initialize = true) {
    this.mtrData = {
      description: "",
      chapters: {},
      sections: {},
    };

    if (initialize) {
      setTimeout(this.init.bind(this));
    }
  }

  /**
   * Sets up the MTR data
   */
  async init() {
    const mtrDocument = await this.download(MTR_ADDRESS);
    await this.parse(mtrDocument);
  }

  /**
   * Returns the MTR data as a string
   */
  async download(url: string): Promise<string> {
    const res = await fetch(url);
    if (res.status === 200) {
      return await res.text();
    } else {
      log.error(`Error loading MTR, server returned status code ${res.status}`);
      return "";
    }
  }

  /**
   * Parses the MTR data and updates class state
   */
  parse(mtrDocument: string) {
    const $ = cheerio.load(mtrDocument);
    this.cleanup($);
    this.handleChapters($);
    this.handleSections($);
    log.info("MTR Ready");
  }

  cleanup($: cheerio.Root) {
    // get description from body
    const body = $("body");
    this.mtrData.description = body.get(0).childNodes[0].data.trim() || "";

    // wrap standalone text nodes in p tags
    // @ts-ignore
    const nodes: Node[] = body.contents();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // Text Node
      if (node.nodeType === 3) {
        $(node).wrap("p");
      }
    }

    // strip out p tags containing only whitespace
    $("p")
      .filter((i, e) => /^\s*$/.test($(e).text()))
      .remove();

    // mark chapter headers
    $("h2")
      .filter((i, e) => /^\d+\.\s/.test($(e).text().trim()))
      .addClass("chapter-header");
    // mark section headers
    $("h1")
      .filter((i, e) => /^MTR (\d+\.\d+\s)/.test($(e).text().trim()))
      .addClass("section-header");
  }

  handleChapters($: cheerio.Root) {
    $(".chapter-header").each((i, e) => {
      const title = $(e).text().trim();
      const number = title.split(".", 1)[0];
      this.mtrData.chapters[number] = {
        key: number,
        title: title,
        sections: [],
      };
    });
  }

  handleSections($: cheerio.Root) {
    $(".section-header").each((i, e) => {
      const title = $(e).text().substr(4).trim();
      const key = title.split(/\s/, 1)[0];
      const chapter = key.split(".", 1)[0];
      const content = this.handleSectionContent($, $(e), title, key);

      this.mtrData.sections[key] = {
        key: key,
        title: title,
        content: content,
      };
      this.mtrData.chapters[chapter].sections.push(key);
    });
  }

  handleSectionContent(
    $: cheerio.Root,
    sectionHeader: cheerio.Cheerio,
    title: string,
    number: string
  ) {
    /* on most sections we can just use the text, special cases are:
     *   - banlists (sections ending in deck construction), these are basically long lists of sets and cards
     */
    if (/Format Deck Construction$/.test(title)) {
      // Asking a bot for the banlist has to be one of the worst ways to inquire about card legality that I can imagine,
      // defer handling this until I'm really bored and redirect people to the annotated mtr in the meantime
      return `You can find the full text of ${title} on <${this.generateLink(
        number
      )}>`;
    }

    // there are some headers which are neither section nor chapter headers interspersed in the sections
    const sectionContent = sectionHeader
      .nextUntil(".section-header,.chapter-header")
      .wrap("<div></div>")
      .parent();
    sectionContent
      .find("h4")
      // @ts-ignore
      .replaceWith((_i, e) => `<p>\n\n**${$(e).text().trim()}**\n\n</p>`);

    // clean up line breaks
    return sectionContent
      .text()
      .trim()
      .replace(/\n\s*\n/g, "#break#")
      .replace(/\n/g, " ")
      .replace(/#break#/g, "\n\n");
  }

  generateLink(key: string): string {
    if (/^\d/.test(key)) {
      return MTR.location + key.replace(".", "-");
    } else {
      return MTR.location + "-" + key;
    }
  }

  formatChapter(chapter: Chapter): EmbedBuilder {
    const availableSections = chapter.sections
      .map((s) => "• " + this.mtrData.sections[s].title)
      .join("\n");
    return new EmbedBuilder({
      title: `MTR - ${chapter.title}`,
      description: availableSections,
      thumbnail: { url: MTR.thumbnail },
      url:
        "https://blogs.magicjudges.org/rules/mtr/#" +
        chapter.title.toLowerCase().replace(/ +/g, "-"),
    });
  }

  formatSection(section: Section): EmbedBuilder {
    return new EmbedBuilder({
      title: `MTR - ${section.title}`,
      description: _.truncate(section.content, {
        length: MTR.maxLength,
        separator: "\n",
      }),
      thumbnail: { url: MTR.thumbnail },
      url: this.generateLink(section.key),
    });
  }

  find(parameter: string): EmbedBuilder {
    if (parameter.indexOf("-") !== -1 || parameter.indexOf(".") !== -1) {
      // looks like a section query
      const section = this.mtrData.sections[parameter];
      if (section) {
        return this.formatSection(section);
      }
      return new EmbedBuilder({
        title: "MTR - Error",
        description:
          "This section does not exist. Try asking for a chapter to get a list of available sections for that chapter.",
        color: 0xff0000,
      });
    }

    const chapter = this.mtrData.chapters[parameter];
    if (chapter) {
      return this.formatChapter(chapter);
    }
    return new EmbedBuilder({
      title: "MTR - Error",
      description: "This chapter does not exist.",
      color: 0xff0000,
    }).addFields({
      name: "Available Chapters",
      value: _.values(this.mtrData.chapters)
        .map((c) => "• " + c.title)
        .join("\n"),
    });
  }

  @Slash({
    name: "mtr",
    description: "Show an entry from Magic: The Gathering Tournament Rules",
  })
  async mtr(
    @SlashOption({
      name: "lookup",
      description: "Section of the MTR to look up",
      required: false,
    })
    lookup: string,
    interaction: CommandInteraction
  ) {
    if (lookup) {
      const embed = this.find(lookup.toLowerCase().trim().split(" ")[0]);
      await interaction.reply({ embeds: [embed] });
    } else {
      return interaction.reply({
        embeds: [
          new EmbedBuilder({
            title: "Magic Tournament Rules",
            description: this.mtrData.description,
            thumbnail: { url: MTR.thumbnail },
            url: MTR.location,
          }).addFields({
            name: "Available Chapters",
            value: _.values(this.mtrData.chapters)
              .map((c) => "• " + c.title)
              .join("\n"),
          }),
        ],
      });
    }
  }
}
