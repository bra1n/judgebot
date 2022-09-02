import {ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, AutocompleteInteraction, CommandInteraction} from "discord.js";
import * as utils from "../utils.js";
import fetch from "node-fetch";
import _ from "lodash";
const log = utils.getLogger('ipg');
const IPG_ADDRESS = process.env.IPG_ADDRESS || "https://raw.githubusercontent.com/hgarus/mtgdocs/master/docs/ipg.json";
import {DApplicationCommand, Discord, Slash, SlashChoice, SlashOption, SlashOptionOptions, MetadataStorage} from "discordx";
import { EmbedBuilder } from "@discordjs/builders";

interface IpgEntry {
        title: string;
        url: string;
        text: string;
}

interface IpgChapter extends  IpgEntry{
    sections: string[];
}

interface IpgSection extends IpgEntry {
    subsections: string[];
    penalty: string;
    subsectionContents: Record<string, IpgSubSection>;
}

interface IpgSubSection {
    title: string;
    text: string[];
}

type IpgData = Record<string, IpgChapter | IpgSection>

@Discord()
export default class IPG {
    ipgData: IpgData;
    suggestions: ApplicationCommandOptionChoiceData[];
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

    constructor(initialize: boolean = true) {
        this.ipgData = {};
        this.suggestions = [];
        if (initialize) {
            setTimeout(this.init.bind(this));
        }
    }

    /**
     * Run startup for this module
     */
    async init(){
        let res;
        try {
            res = await fetch(IPG_ADDRESS);
        }
        catch (err) {
            log.error(`Error loading IPG: ${err}`);
            return;
        }
        if (res.status === 200) {
            this.ipgData = await res.json() as IpgData;
            log.info("IPG Successfully Parsed");
        } else {
            log.error("Error loading IPG, server returned status code " + res.status);
        }

        for (let key in this.ipgData){
            this.suggestions.push({
                value: key,
                name: this.ipgData[key].title
            });
        }
        // for (let key in IPG.aliases){
        //     this.suggestions.push({
        //         value: key,
        //         name: this.ipgData[IPG.aliases[key]].title
        //     });
        // }
    }

    formatPreview(entry: IpgEntry | IpgSubSection) {
        let text : string;
        if (Array.isArray(entry.text)){
            text = entry.text.join(" ");
        }
        else {
            text = entry.text;
        }
        return `**${entry.title}**\n${text}`;
    }

    // IPG Chapter (like "2")
    formatChapterEntry(entry: IpgChapter) {
        const text = entry.text || this.formatPreview(this.ipgData[entry.sections[0]]);

        return new EmbedBuilder().
            setTitle(`IPG - ${entry.title}`).
            setDescription(_.truncate(text, {length: IPG.maxLength, separator: '\n'})).
            setThumbnail(IPG.thumbnail).
            setURL(entry.url)
            .setFields({
                name:'Available Sections',
                value: entry.sections.map((s) => `• ${this.ipgData[s].title}`).join("\n") 
            });
    }

    // IPG Section (like "2.1")
    formatSectionEntry(entry: IpgSection) {
        const text = entry.text || this.formatPreview(entry.subsectionContents[entry.subsections[0]]);
        const embed = new EmbedBuilder()
            .setTitle(`IPG - ${entry.title}`).
            setDescription(_.truncate(text, {length: IPG.maxLength, separator: '\n'})).
            setThumbnail(IPG.thumbnail).
            setURL(entry.url)
        if (entry.penalty) {
            embed.addFields({name: 'Penalty',  value: entry.penalty});
        }
        if (entry.subsections.length) {
            embed.addFields({name: 'Available Subsections', value: entry.subsections.map((s) => `• ${s}`).join('\n')});
        }

        return embed;
    }

    // IPG Subsection (like "2.1 definition")
    formatSubsectionEntry(sectionEntry: IpgSection, subsectionEntry: IpgSubSection) {
        const otherSections = sectionEntry.subsections.filter((s) => s !== _.kebabCase(subsectionEntry.title));

        return new EmbedBuilder().setTitle(`IPG - ${sectionEntry.title} - ${subsectionEntry.title}`).setDescription(_.truncate(subsectionEntry.text.join("\n\n"),{length: IPG.maxLength, separator: '\n'})).
            setThumbnail(IPG.thumbnail).
            setFooter({text: `Other available subsections: ${otherSections.join(', ')}`}).
            setURL(sectionEntry.url + '#' + subsectionEntry.title.toLowerCase().replace(/ /g,'-'))
    }

    // main lookup method
    find(lookup: string, subsection?: string) {
        const entry = this.ipgData[lookup];
        if (!entry) {
            let availableEntries = _.keys(this.ipgData);
            availableEntries.sort();
            return new EmbedBuilder().
                setTitle('IPG - Error').
                setDescription('These parameters don\'t match any entries in the IPG.').
                setColor(0xff0000).setFields(
                    {
                        name: 'Available Chapters',
                        value: this.getChapters()
                    }
                )
        }

        // This is a type guard, since subsections distinguishes between chapters and sections
        if ('subsections' in entry){
            if (subsection && entry.subsections && entry.subsectionContents[subsection]) {
                // we have a second parameter and available subsections that match it
                return this.formatSubsectionEntry(entry, entry.subsectionContents[subsection]);
            } else {
                return this.formatSectionEntry(entry);
            }
        }
        else {
            return this.formatChapterEntry(entry);
        }
    }

    getChapters(): string {
        return Object
            .values(this.ipgData)
            .filter((c) => c.title.match(/^\d+\s/))
            .map((c) => '• '+c.title.replace(/^(\d+)\s/,'$1. '))
            .join("\n");
    }

    @Slash({
        name: "ipg",
        description: "Show an entry from the Infraction Procedure Guide",
    })
    async ipg(
        @SlashOption({
            name: "section", 
            description: 'IPG section number e.g. "2.5", or an alias for one e.g. "grv" (Game Rule Violation)',
            type: ApplicationCommandOptionType.String,
            autocomplete: async function(this: IPG, interaction: AutocompleteInteraction, cmd: DApplicationCommand){
                const query = interaction.options.data.filter(opt => opt.name === "section")[0];
                await interaction.respond(
                    this.suggestions
                        .filter(hit => hit.name.startsWith(query.value as string))
                        .slice(0, 25)
                );
            }
        })
       lookup: string,
        @SlashOption({
            name: "subsection", 
            description: 'Subsection name, e.g. "philosophy"',
            required: false
        })
            subsection: string,
        interaction: CommandInteraction,
    ){
        const embed = this.find(lookup, subsection);
        await interaction.reply({
            embeds: [embed]
        })
    }
}