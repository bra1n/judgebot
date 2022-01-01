import {CommandInteraction, MessageEmbed} from "discord.js";
import * as utils from "../utils.js";
import fetch from "node-fetch";
import _ from "lodash";
const log = utils.getLogger('ipg');
const IPG_ADDRESS = process.env.IPG_ADDRESS || "https://raw.githubusercontent.com/hgarus/mtgdocs/master/docs/ipg.json";
import {Discord, Slash, SlashChoice, SlashOption, SlashOptionParams} from "discordx";

@Discord()
export default class IPG {
    aliases: any;
    commands: any;
    ipgData: any;
    thumbnail: any;
    static location = "http://blogs.magicjudges.org/rules/ipg";
    static maxLength = 2040;
    static thumbnail = 'https://assets.magicjudges.org/judge-banner/images/magic-judge.png';
    static aliases: Record<string, string> = {
        'definition': '1.1',
        'applying': '1.1',
        'backup': '1.4',
        'randomizing': '1.3',
        'random': '1.3',
        'mt': '2.1',
        'trigger': '2.1',
        'l@ec': '2.2',
        'laec': '2.2',
        'hce': '2.3',
        'dec': '2.3',
        'mulligan': '2.4',
        'mpe': '2.4',
        'grv': '2.5',
        'ftmgs': '2.6',
        'f2mgs': '2.6',
        'gpe': '2',
        'te': '3',
        'general': '1',
        'tardiness': '3.1',
        'tardy': '3.1',
        'oa': '3.2',
        'sp': '3.3',
        'slowplay': '3.3',
        'is': '3.9',
        'shuffling': '3.9',
        'dp': '3.5',
        'deckproblem': '3.5',
        'dlp': '3.4',
        'decklistproblem': '3.4',
        'lpv': '3.6',
        'cpv': '3.7',
        'mc': '3.8',
        'usc': '4',
        'uscminor': '4.1',
        'uscmajor': '4.2',
        'idw': '4.3',
        'idaw': '4.3',
        'bribery': '4.4',
        'wagering': '4.4',
        'baw': '4.4',
        'ab': '4.5',
        'aggressive': '4.5',
        'theft': '4.6',
        'totm': '4.6',
        'tot': '4.6',
        'stalling': '4.7',
        'cheating': '4.8'
    };

    constructor(initialize = true) {
        // this.commands = {
        //     ipg: {
        //         aliases: [],
        //         inline: true,
        //         description: "Show an entry from the Infraction Procedure Guide",
        //         help: '',
        //         examples: ["!ipg 4.2", "!ipg grv", "!ipg hce examples"]
        //     }
        // };
        this.ipgData = {};
        if (initialize) {
            (async () => {
                let res;
                try {
                    res = await fetch(IPG_ADDRESS);
                }
                catch (err : any) {
                    log.error(`Error loading IPG: ${err}`);
                    return;
                }
                if (res.status === 200) {
                    this.ipgData = await res.json();
                    log.info("IPG Ready");
                } else {
                    log.error("Error loading IPG, server returned status code " + res.status);
                }
            })();
        }
    }

    formatPreview(entry: any) {
        return `**${entry.title}**\n${entry.text}`;
    }

    // IPG Chapter (like "2")
    formatChapterEntry(entry: any) {
        const text = entry.text || this.formatPreview(this.ipgData[entry.sections[0]]);

        return new MessageEmbed({
            title: `IPG - ${entry.title}`,
            description: _.truncate(text, {length: IPG.maxLength, separator: '\n'}),
            thumbnail: {url: this.thumbnail},
            url: entry.url
        }).addField('Available Sections', entry.sections.map((s: any) => `• ${this.ipgData[s].title}`).join("\n"));
    }

    // IPG Section (like "2.1")
    formatSectionEntry(entry: any) {
        const text = entry.text || this.formatPreview(entry.subsectionContents[entry.subsections[0]]);
        const embed = new MessageEmbed({
            title: `IPG - ${entry.title}`,
            description: _.truncate(text, {length: IPG.maxLength, separator: '\n'}),
            thumbnail: {url: this.thumbnail},
            url: entry.url
        });
        if (entry.penalty) {
            embed.addField('Penalty', entry.penalty);
        }
        if (entry.subsections.length) {
            embed.addField('Available Subsections', entry.subsections.map((s: any) => `• ${s}`));
        }

        return embed;
    }

    // IPG Subsection (like "2.1 definition")
    formatSubsectionEntry(sectionEntry: any, subsectionEntry: any) {
        const otherSections = sectionEntry.subsections.filter((s: any) => s !== _.kebabCase(subsectionEntry.title));

        return new MessageEmbed({
            title: `IPG - ${sectionEntry.title} - ${subsectionEntry.title}`,
            description: _.truncate(subsectionEntry.text.join("\n\n"),{length: IPG.maxLength, separator: '\n'}),
            thumbnail: {url: this.thumbnail},
            footer: {text: `Other available subsections: ${otherSections.join(', ')}`},
            url: sectionEntry.url + '#' + subsectionEntry.title.toLowerCase().replace(/ /g,'-')
        });
    }

    // main lookup method
    find(parameters: any) {
        const entry = this.ipgData[parameters[0]];
        if (!entry) {
            let availableEntries = _.keys(this.ipgData);
            availableEntries.sort();
            return new MessageEmbed({
                title: 'IPG - Error',
                description: 'These parameters don\'t match any entries in the IPG.',
                color: 0xff0000
            }).addField('Available Chapters', this.getChapters());
        }

        if (parameters[1] && entry.subsections && entry.subsectionContents[parameters[1]]) {
            // we have a second parameter and available subsections that match it
            return this.formatSubsectionEntry(entry, entry.subsectionContents[parameters[1]]);
        } else {
            // only show the main entry
            if (parameters[0].indexOf('.') === -1) {
                return this.formatChapterEntry(entry);
            } else {
                return this.formatSectionEntry(entry);
            }
        }
    }

    getChapters(): string {
        return Object
            .values(this.ipgData)
            .filter((c: any) => c.title.match(/^\d+\s/))
            .map((c: any) => '• '+c.title.replace(/^(\d+)\s/,'$1. '))
            .join("\n");
    }

    // handleParameters(parameter: any) {
    //     let parameters = parameter.trim().toLowerCase().split(/\s+/);
    //     if (this.aliases[parameters[0]]) {
    //         parameters[0] = this.aliases[parameters[0]];
    //     }
    //     return parameters;
    // }

    @Slash("ipg", {
        description: "Show an entry from the Infraction Procedure Guide",
    })
    async ipg(
        @SlashOption("lookup")
       lookup: string,
       interaction: CommandInteraction
    ){
        const embed = this.find(lookup);
        await interaction.reply({
            embeds: [embed]
        })
    }

    // handleMessage(command: any, parameter: any, msg: any) {
    //     if (parameter) {
    //         const embed = this.find(this.handleParameters(parameter));
    //         return msg.channel.send('', {embed});
    //     } else {
    //         return msg.channel.send('', {embed: new MessageEmbed({
    //             title: 'Magic Infraction Procedure Guide',
    //             description: this.ipgData.description,
    //             thumbnail: {url: this.thumbnail},
    //             url: IPG.location
    //         }).addField('Available Chapters', this.getChapters())});
    //     }
    // }
}