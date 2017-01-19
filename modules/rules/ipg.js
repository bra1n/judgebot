const rp = require("request-promise-native");
const cheerio = require("cheerio");
const _ = require("lodash");
const log = require("log4js").getLogger('ipg');

const IPG_ADDRESS = process.env.IPG_ADDRESS || "https://sites.google.com/site/mtgfamiliar/rules/InfractionProcedureGuide-light.html";

class IPG {
    constructor(initialize = true) {
        this.location = "http://blogs.magicjudges.org/rules/ipg/";
        this.maxPreview = 200;
        this.commands = ["ipg"];
        this.ipgData = {};
        this.aliases = {
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
            'is': '3.4',
            'shuffling': '3.4',
            'ddlp': '3.5',
            'd/dlp': '3.5',
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
        if (initialize) {
            rp({url: IPG_ADDRESS, simple: false, resolveWithFullResponse: true }).then(response => {
                if (response.statusCode === 200) {
                    this.init(response.body);
                } else {
                    log.error("Error loading IPG, server returned status code " + response.statusCode);
                }
            }).catch(e => log.error("Error loading IPG: " + e, e));
        }
    }

    init(ipgHtml) {
        const $ = cheerio.load(ipgHtml);
        this.cleanup($);
        this.handleChapters($);
        this.handleSections($);
        this.handleSubsections($);
        log.info("IPG Ready");
    }

    cleanup($) {
        //remove appendices
        $('b:contains("APPENDIX")').parent().nextAll().addBack().remove();

        // wrap standalone text nodes in p tags
        const nodes = $("body").contents();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            // Text Node
            if (node.nodeType === 3) {
                $(node).wrap("p");
            }
        }

        /* mark various different headers
         * the ipg is grouped into chapters, denoted by a header starting with a single digit,
         * these contain sections, denoted by a header starting with multiple digits separated by a period.
         * Most sections consist of several subsections with an additional header such as "Definition" or "Philosophy".
         * In addition there are some paragraphs which behave more like subsections (currently paragraphs describing Upgrades and Downgrades)
         */
        const chapterHeaders = $("h4").filter((i, e) => $(e).text().match(/^\d+\s/)).addClass("chapter-header");
        const sectionHeaders = $("h4").filter((i, e) => $(e).text().match(/^\d+\.\d+\s/)).addClass("section-header");
        $("h4").not(chapterHeaders).not(sectionHeaders).addClass("subsection-header");
        $("p").each((i, p) => {
            var $p = $(p);
            const pseudoSubsectionStart = /^\s*(Upgrade|Downgrade):/;
            const matchedPseudoSubsection = $p.text().match(pseudoSubsectionStart);
            if (matchedPseudoSubsection) {
                $p.before($('<h4 class="subsection-header">' + matchedPseudoSubsection[1] + "</h4>"));
                $p.text($p.text().replace(pseudoSubsectionStart, "").trim());
            }
        });
    }

    titleCase(str) {
        return str.split(/\s+/).map(s => s.toLowerCase()).map(_.upperFirst).join(" ");
    }

    collapseWhitespace(str) {
        return str.trim().replace(/\n\s*\n/g, "\n\n");
    }

    handleChapters($) {
        $('.chapter-header').each((i, h) => {
            const titleText = this.titleCase($(h).text().trim());
            const number = titleText.split(" ", 1)[0];

            this.ipgData[number] = {
                title: titleText,
                sections: [],
                text: this.collapseWhitespace($(h).nextUntil("h4").text())
            };
        });
    }

    handleSections($) {
        $('.section-header').each((i, h) => {
            const titleText = this.titleCase($(h).text().trim());
            const number = titleText.split(" ", 1)[0];
            const chapterNumber = number.split(".", 1)[0];
            const penalty = $(h).nextAll("table").first().find("td").text().trim();

            this.ipgData[number] = {
                title: titleText,
                penalty: penalty,
                subsections: [],
                subsectionContents: {},
                text: this.collapseWhitespace($(h).nextUntil("h4").filter("p").text())
            };

            this.ipgData[chapterNumber].sections.push(number);
        });
    }

    handleSubsections($) {
        $('.subsection-header').each((i, h) => {
            const titleText = this.titleCase($(h).text());
            const subsectionName = _.kebabCase(titleText);
            const subsectionContent = this.collapseWhitespace($(h).nextUntil('h4').text());
            const sectionNumber = $(h).prevAll(".section-header").first().text().split(' ', 1)[0];
            const sectionEntry = this.ipgData[sectionNumber];

            if (sectionEntry.subsections.indexOf(subsectionName) === -1) {
                sectionEntry.subsections.push(subsectionName);
                sectionEntry.subsectionContents[subsectionName] = {
                    title: titleText,
                    text: [subsectionContent]
                };
            } else {
                sectionEntry.subsectionContents[subsectionName].text.push(subsectionContent);
            }
        });
    }

    getCommands() {
        return this.commands;
    }

    prettyPrintSectionTitle(section) {
        return this.titleCase(section.replace("-", " "));
    }

    formatSections(sections) {
        return sections.map(s => "*" + s + "*").join(", ");
    }

    formatPreview(entry) {
        const previewText = _.truncate(entry.text, {length: this.maxPreview, separator: ' '});
        return  `**${entry.title}**\n${previewText}`;
    }

    formatChapterEntry(entry) {
        const text = entry.text || this.formatPreview(this.ipgData[entry.sections[0]]);

        return `**IPG ${entry.title}**
${text}

**Available Sections**: ${this.formatSections(entry.sections)}`;
    }

    formatSectionEntry(entry) {
        const penalty = entry.penalty ? `\nPenalty: ${entry.penalty}\n` : '';
        const text = entry.text || this.formatPreview(entry.subsectionContents[entry.subsections[0]]);
        return `**IPG ${entry.title}**${penalty}
${text}

**Available Subsections**: ${this.formatSections(entry.subsections)}`;
    }

    formatSubsectionEntry(sectionEntry, subsectionEntry) {
        const otherSections = sectionEntry.subsections.filter(s => s !== _.kebabCase(subsectionEntry.title));

        return `**IPG ${sectionEntry.title} - ${subsectionEntry.title}**

${subsectionEntry.text.join("\n\n")}

**Other available subsections**: ${this.formatSections(otherSections)}`;
    }

    find(parameters) {
        const entry = this.ipgData[parameters[0]];
        if (!entry) {
            let availableEntries = _.keys(this.ipgData);
            availableEntries.sort();
            return `These parameters don't match any entries in the IPG.

**Available entries**: ${this.formatSections(availableEntries)}`;
        }

        if(parameters.length === 1) {
            if (parameters[0].indexOf('.') === -1){
                return this.formatChapterEntry(entry);
            } else {
                return this.formatSectionEntry(entry);
            }
        } else {
            if (!entry.subsections) {
                return `The entry ${entry.title} isn't a section, subsection queries are only available for sections.`;
            }
            const subsectionEntry = entry.subsectionContents[parameters[1]];
            if (!subsectionEntry) {
                const availableSubsections = this.formatSections(entry.subsections);
                return `The section ${entry.title} does not have a subsection with that name.

**Available Subsections**: ${availableSubsections}`;
            }
            return this.formatSubsectionEntry(entry, subsectionEntry);
        }
    }

    handleParameters(parameter) {
        let parameters = parameter.trim().toLowerCase().split(/\s+/);
        if(this.aliases[parameters[0]]) parameters[0] = this.aliases[parameters[0]];
        return parameters;
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            const result = this.find(this.handleParameters(parameter));
            return msg.channel.sendMessage(result, {split: true});
        } else {
            return msg.channel.sendMessage("**Infraction Procedure Guide**: <" + this.location + ">");
        }
    }
}
module.exports = IPG;
