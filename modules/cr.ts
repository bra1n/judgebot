import {CommandInteraction, MessageEmbed} from "discord.js";
import * as utils from "../utils.js";
import fetch from 'node-fetch';
import _ from "lodash";
import iconv from "iconv-lite";
import {Discord, Slash, SlashChoice, SlashOption, SlashOptionParams} from "discordx";

const log = utils.getLogger('cr');
const CR_ADDRESS = process.env.CR_ADDRESS || "http://cr.vensersjournal.com";

@Discord()
export default class CR {
    crData: any;
    glossary: any;
    maxLength: any;
    static location = "http://blogs.magicjudges.org/rules/cr";
    static thumbnail = 'https://assets.magicjudges.org/judge-banner/images/magic-judge.png';
    static maxLength = 2040;
    constructor() {
        this.glossary = {};
        this.crData = {};

        this.initCr();
    }

    async initCr(){
        try {
            const res = await fetch(CR_ADDRESS);
            const buff = await res.buffer();
            this.parseCr(iconv.decode(buff, 'utf-8'));
        } catch (err: any) {
            log.error("Error loading CR: " + err);
        }
    }

    parseCr(crText: any) {
        // Standardise all linebreaks. \r\n → \n for pre-2020 rules, but for 2020 we have to \r → \n
        crText = crText.replace(/\r\n/g, "\n").replace(/\r/g, '\n');

        let rulesText = crText.substring(crText.search("\nCredits\n") + 9).trim();
        const glossaryStartIndex = rulesText.search("\nGlossary\n") + 10;
        const glossaryText = rulesText.substring(glossaryStartIndex, rulesText.search("\nCredits\n")).trim();
        rulesText = rulesText.substring(0, glossaryStartIndex);

        this.glossary = this.parseGlossary(glossaryText);
        this.crData = this.parseRules(rulesText, this.glossary);
        this.crData.description = crText.match(/effective as of (.*?)\./)[1];
        log.info("CR Ready, effective "+this.crData.description);
    }

    parseGlossary(glossaryText: string) {
        const glossaryEntries: Record<string, string> = {};

        for (const entry of glossaryText.split("\n\n")) {
            if (!entry.trim()) {
                continue;
            }
            let [term, ...def] = entry.split("\n");
            if (!term || !def.length) {
                continue;
            }
            const definition = `**${term}**\n${this.highlightRules(def.join("\n"))}`;
            for (const t of term.split(",")) {
                glossaryEntries[t.trim().toLowerCase()] = definition;
            }
        }
        return glossaryEntries;
    }

    parseRules(crText: string, glossaryEntries: Record<string, string>): Record<string, string> {
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

            crEntries[number] = '';
            entry.split('\n').forEach((line: any) => {
                if (line.match(/^Example: /i)) {
                    if (!crEntries[number+' ex']) crEntries[number+' ex'] = '';
                    crEntries[number+' ex'] += line.replace(/^Example: /i, '**Example:** ') + '\n\n';
                } else {
                    crEntries[number] += line + '\n';
                }
            })
        }
        return crEntries;
    }

    highlightRules(text: string): string {
        return text.replace(/rule \d{3}\.\w*\.?/ig, "`$&`");
    }

    appendSubrules(parameter: string, length: number = CR.maxLength): string {
        let description = this.crData[parameter];
        if (description && this.crData[parameter + 'a']) {
            // keep looking for subrules, starting with "123a" and going until "123z" or we don't find another subrule
            for(let x = 'a'.charCodeAt(0); this.crData[parameter + String.fromCharCode(x)]; x++) {
                description += '\n' + this.crData[parameter + String.fromCharCode(x)];
            }
        } else if (description && this.crData[parameter + '.1']) {
            description += '\n' + this.crData[parameter + '.1'];
        }
        return _.truncate(description, {length, separator: '\n'});
    }

    @Slash("cr", {
        description: "Show a rule or definition from the Comprehensive Rulebook",
    })
    async cr(
        @SlashOption("rule", {
            description: "Rule number, e.g. 101.1b"
        })
        rule: string,
        @SlashOption("examples", {
            description: "Show the examples",
            required: false
        })
        ex: boolean,
        interaction: CommandInteraction
    ): Promise<void> {
        rule = rule.replace(/\.$/, "");
        // prepare embed
        const embed = new MessageEmbed({
            title: 'Comprehensive Rules',
            description: 'Effective '+this.crData.description,
            thumbnail: {url: CR.thumbnail},
            url: CR.location + '/'
        });

        // check first for CR paragraph match
        if (this.crData[rule]) {
            // in case there is a second parameter "ex", append it
            if (ex) { rule += ' ex'; }
            embed.setTitle('CR - Rule ' + rule.replace(/ ex$/,' Examples'))
                .setDescription(this.appendSubrules(rule))
                .setURL(CR.location + rule.substr(0,3) + '/');
            if (this.crData[rule + ' ex']) {
                embed.setFooter(`Use /${interaction.command} examples: true to see examples.`);
            }
        } else {
            // try to find a match in the glossary while stripping of parameters until there are none left or they match
                if (this.glossary[rule]) {
                    embed.setTitle(`CR - Glossary for "${rule}"`)
                        .setDescription(this.glossary[rule])
                        .setURL(CR.location + '/cr-glossary/');
                    const gloss = this.glossary[rule].match(/rule (\d+\.\w+)/i);
                    if (gloss && this.crData[rule[1]]) {
                        embed.addField('CR - Rule '+rule[1], this.appendSubrules(rule[1], 1020));
                    }
                }
        }
        return await interaction.reply({embeds: [embed]});
    }
}