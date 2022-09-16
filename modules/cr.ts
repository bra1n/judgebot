import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  CommandInteraction,
  DiscordAPIError,
  EmbedBuilder,
  InteractionResponse,
} from "discord.js";
import * as utils from "../utils.js";
import fetch from "node-fetch";
import _ from "lodash";
import iconv from "iconv-lite";
import {
  DApplicationCommand,
  Discord,
  Slash,
  SlashOption,
} from "discordx";
import flexsearch from "flexsearch";

const log = utils.getLogger("cr");
const CR_ADDRESS =
  process.env.CR_ADDRESS || "https://api.academyruins.com/link/cr";

// the glossary dict also stores shorthand keys for fuzzy searching, so we need to store the full entry to properly link to it
class GlossaryEntry {
  term: string;
  definition: string;

  constructor(term: string, definition: string) {
    this.term = term;
    this.definition = definition;
  }
}

@Discord()
export default class CR {
  suggestions: flexsearch.Index;
  glossary: Record<string, GlossaryEntry>;
  crData: Record<string, string>;
  static location = "https://yawgatog.com/resources/magic-rules/";
  static thumbnail =
    "https://yawgatog.com/icon-180x180.png";
  static maxLength = 2040;
  constructor() {
    this.glossary = {};
    // Define the dataset
    this.crData = {};
    this.suggestions = new flexsearch.Index({
      // Go as fast as possible, as we only have 3 seconds to respond
      preset: "performance",
      tokenize: "forward",
      cache: true,
      context: true,
    });

    setTimeout(this.init.bind(this));
  }

  async init() {
    try {
      const res = await fetch(CR_ADDRESS);
      const buff = await res.buffer();
      this.parseCr(iconv.decode(buff, "utf-8"));
      this.buildSuggestions();
    } catch (err) {
      log.error("Error loading CR: " + err);
    }
  }

  buildSuggestions() {
    for (let key in this.crData) {
      this.suggestions.add(key, this.crData[key].replaceAll(/[*_]/g, ""));
    }
    // this.suggestions = lunr(function(){
    //     this.ref("key");
    //     this.metadataWhitelist = ['position']
    //     this.field("body");
    //     for (let key in crData){
    //         this.add({
    //             key: key,
    //             body: crData[key].replaceAll(/[*_]/g, "")
    //         })
    //     }
    // });

    // this.suggestions = Object.keys(this.crData).map(key => ({
    //         // Cut down suggestions to 100 chars, and remove formatting characters
    //         name: this.crData[key].replaceAll(/[*_]/g, "").slice(0, 100),
    //         value: key
    //     })
    // );
  }

  parseCr(crText: string) {
    // Standardise all linebreaks. \r\n → \n for pre-2020 rules, but for 2020 we have to \r → \n
    crText = crText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    let rulesText = crText.substring(crText.search("\nCredits\n") + 9).trim();
    const glossaryStartIndex = rulesText.search("\nGlossary\n") + 10;
    const glossaryText = rulesText
      .substring(glossaryStartIndex, rulesText.search("\nCredits\n"))
      .trim();
    rulesText = rulesText.substring(0, glossaryStartIndex);

    this.glossary = this.parseGlossary(glossaryText);
    this.crData = this.parseRules(rulesText, this.glossary);
    const descr = crText.match(/effective as of (.*?)\./);
    this.crData.description = descr ? descr[1] : "";
    log.info("CR Ready, effective " + this.crData.description);
  }

  parseGlossary(glossaryText: string) {
    const glossaryEntries: Record<string, GlossaryEntry> = {};

    for (const entry of glossaryText.split("\n\n")) {
      if (!entry.trim()) {
        continue;
      }
      let [term, ...def] = entry.split("\n");
      if (!term || !def.length) {
        continue;
      }
      const definition = `**${term}**\n${this.highlightRules(def.join("\n"))}`;
      term = term.toLowerCase();
      const entry = new GlossaryEntry(term, definition);
      for (const t of term.split(",")) {
        glossaryEntries[t.trim()] = entry;
      }
    }
    return glossaryEntries;
  }

  parseRules(
    crText: string,
    glossaryEntries: Record<string, GlossaryEntry>
  ): Record<string, string> {
    const ruleNumberPrefixRe = /^(\d{3}\.\w*)\.?/;
    const crEntries: Record<string, string> = {};

    for (let entry of crText.split("\n\n")) {
      if (!ruleNumberPrefixRe.test(entry)) {
        continue;
      }
      const number = entry.split(" ", 1)[0].replace(/\.$/, "");
      entry = entry.replace(ruleNumberPrefixRe, "__**$1**__");
      const newEntry = [];
      for (const word of entry.split(" ")) {
        if (glossaryEntries[word]) {
          newEntry.push(`__${word}__`);
        } else {
          newEntry.push(word);
        }
      }
      entry = this.highlightRules(newEntry.join(" "));

      crEntries[number] = "";
      entry.split("\n").forEach((line) => {
        if (line.match(/^Example: /i)) {
          if (!crEntries[number + " ex"]) crEntries[number + " ex"] = "";
          crEntries[number + " ex"] +=
            line.replace(/^Example: /i, "**Example:** ") + "\n\n";
        } else {
          crEntries[number] += line + "\n";
        }
      });
    }
    return crEntries;
  }

  highlightRules(text: string): string {
    return text.replace(/rule \d{3}\.\w*\.?/gi, "`$&`");
  }

  appendSubrules(parameter: string, length: number = CR.maxLength): string {
    let description = this.crData[parameter];
    if (description && this.crData[parameter + "a"]) {
      // keep looking for subrules, starting with "123a" and going until "123z" or we don't find another subrule
      for (
        let x = "a".charCodeAt(0);
        this.crData[parameter + String.fromCharCode(x)];
        x++
      ) {
        description += "\n" + this.crData[parameter + String.fromCharCode(x)];
      }
    } else if (description && this.crData[parameter + ".1"]) {
      description += "\n" + this.crData[parameter + ".1"];
    }
    return _.truncate(description, { length, separator: "\n" });
  }

  // transform a rule / glossary name to a Yawgatog compatible HTML id
  ruleToUrlSegment(rule: string): string {
    return rule
      .replace(/ ex$/, "") // examples don't have an id, just link to the corresponding rule
      .replace(/["',.]/g, "") // quotes, commas and dots are removed
      .replace(/[^a-z0-9-]/g, "_") // anything besides alphanum chars and hyphens becomes underscores
      .replaceAll("_obsolete_", "") // "obsolete" is not part of the id
      .replace(/__+/g, "_") // reduce multiple consequent underscores to one
      .replace(/^_|_$/g, "") // remove leading/trailing underscores
  }

  @Slash({
    name: "cr",
    description: "Show a rule or definition from the Comprehensive Rulebook",
  })
  async cr(
    @SlashOption({
      name: "rule",
      description: "Rule number, e.g. 100.2a",
      type: ApplicationCommandOptionType.String,
      async autocomplete(
        this: CR,
        interaction: AutocompleteInteraction,
        cmd: DApplicationCommand
      ) {
        const query = interaction.options.data.filter(
          (opt) => opt.name === "rule"
        )[0];
        if (this.suggestions) {
          try {
            const hits = await this.suggestions.searchAsync(
              query.value as string,
              25
            );
            const response = hits.map((hit) => ({
              value: hit,
              name: this.crData[hit]
                .replaceAll(/[*_]/g, "")
                .slice(0, 100)
                .trim(),
            }));
            await interaction.respond(response);
          } catch (err) {
            log.error((err as DiscordAPIError).message);
          }
        }
      },
    })
    rule: string,
    @SlashOption({
      name: "examples",
      description: "Show the examples",
      required: false,
    })
    ex: boolean,
    interaction: CommandInteraction
  ): Promise<InteractionResponse<boolean> | void> {
    // prepare embed
    const embed = new EmbedBuilder()
      .setTitle("Comprehensive Rules")
      .setDescription("Effective " + this.crData.description)
      .setThumbnail(CR.thumbnail)
      .setURL(CR.location + "/");

    if (interaction.isAutocomplete()) {
      return;
    }

    rule = rule.toLowerCase(); // all dictionaries are keyed by lower case strings

    // check first for CR paragraph match
    if (this.crData[rule]) {
      if (ex) {
        rule += " ex";
      }
      embed
        .setTitle("CR - Rule " + rule.replace(/ ex$/, " Examples"))
        .setDescription(this.appendSubrules(rule))
        .setURL(CR.location + '#R' + this.ruleToUrlSegment(rule));
      if (this.crData[rule + " ex"]) {
        embed.setFooter({
          text: `Use /${interaction.commandName} examples: True to see examples.`,
        });
      }
    } else if (this.glossary[rule]) {
      const entry = this.glossary[rule];

      embed
        .setTitle(`CR - Glossary for "${rule}"`)
        .setDescription(entry.definition)
        .setURL(CR.location + "#" + this.ruleToUrlSegment(entry.term));
      const gloss = entry.definition.match(/rule (\d+\.\w+)/i);
      if (gloss && this.crData[rule[1]]) {
        embed.addFields({
          name: "CR - Rule " + rule[1],
          value: this.appendSubrules(rule[1], 1020),
        });
      }
    } else {
      embed.setTitle("CR - No Results");
      embed.setDescription("The rule you have requested does not exist.");
    }
    return interaction.reply({ embeds: [embed] });
  }
}
