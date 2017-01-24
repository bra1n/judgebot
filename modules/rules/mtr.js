const _ = require('lodash');
const cheerio = require('cheerio');
const rp = require('request-promise-native');
const Table = require('tty-table');
const log = require('log4js').getLogger('mtr');

const MTR_ADDRESS = process.env.MTR_ADDRESS || 'https://sites.google.com/site/mtgfamiliar/rules/MagicTournamentRules-light.html';

class MTR {
    constructor(initialize = true) {
        this.location = 'http://blogs.magicjudges.org/rules/mtr';
        this.maxLength = 1500;
        this.commands = ['mtr'];
        this.mtrData = {
            chapters: {appendices: {key: 'appendices', title: 'Appendices', sections: []}},
            sections: {}
        };

        if (initialize) {
            this.download(MTR_ADDRESS).then(mtrDocument => this.init(mtrDocument));
        }
    }

    download(url) {
        return rp({url: url, simple: false, resolveWithFullResponse: true }).then(response => {
                if (response.statusCode === 200) {
                    return response.body;
                } else {
                    log.error('Error loading MTR, server returned status code ' + response.statusCode);
                }
            }).catch(e => log.error('Error loading MTR: ' + e, e));
    }

    init(mtrDocument) {
        const $ = cheerio.load(mtrDocument);
        this.cleanup($);
        this.handleChapters($);
        this.handleSections($);
        log.info('MTR Ready');
    }

    cleanup($) {
        // wrap standalone text nodes in p tags
        const nodes = $('body').contents();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            // Text Node
            if (node.nodeType === 3) {
                $(node).wrap('p');
            }
        }

        // strip out p tags containing only whitespace
        $('p').filter((i, e) => /^\s*$/.test($(e).text())).remove();

        // mark chapter headers
        $('h4').filter((i, e) => /^\d+\.\s/.test($(e).text().trim())).addClass('chapter-header');
        // mark section headers
        $('h4').filter((i, e) => /^(\d+\.\d+\s|Appendix)/.test($(e).text().trim())).addClass('section-header');
    }

    handleChapters($) {
        $('.chapter-header').each((i, e) => {
            const title = $(e).text().trim();
            const number = title.split('.', 1)[0];
            this.mtrData.chapters[number] = {
                key: number,
                title: title,
                sections: []
            };
        });
    }

    handleSections($) {
        $('.section-header').each((i, e) => {

            const title = $(e).text().trim();
            const key = title.startsWith('Appendix') ? _.kebabCase(title.split('-', 1)[0]) : title.split(/\s/, 1)[0];
            const chapter = key.startsWith('appendix') ? 'appendices' : key.split('.', 1)[0];
            const content = this.handleSectionContent($, $(e), title, key);

            this.mtrData.sections[key] = {
                key: key,
                title: title,
                content: content
            };
            this.mtrData.chapters[chapter].sections.push(key);
        });
    }

    handleSectionContent($, sectionHeader, title, number) {
        /* on most sections we can just use the text, special cases are:
         *   - banlists (sections ending in deck construction), these are basically long lists of sets and cards
         *   - some sections containing tables (draft timings and recommended number of rounds)
         */
        if (/Format Deck Construction$/.test(title)) {
            // Asking a bot for the banlist has to be one of the worst ways to inquire about card legality that I can imagine,
            // defer handling this until I'm really bored and redirect people to the annotated mtr in the meantime
            return `You can find the full text of ${title} on <${this.generateLink(number)}>`;
        }

        // there are some headers which are neiter section nor chapter headers interspersed in the secions
        const sectionContent = sectionHeader.nextUntil('.section-header,.chapter-header').wrap('<div></div>').parent();
        sectionContent.find('h4').replaceWith((i, e) => `<p>\n\n**${$(e).text().trim()}**\n\n</p>`);

        // replace tables with an ASCII representation
        sectionContent.find('table').replaceWith((i, e) => {         
            const tableString = this.generateTextTable($, $(e));
            return `<p>\n${tableString}\n</p>`;
        });
        // mark each line as a Codeblock (uses monospace font), otherwise message splitting will mess up the formatting
        return sectionContent.text().trim().replace(/\n\s+\n/, '\n\n');
    }

    generateTextTable($, table) {
        const rows = table.find('tr:has("td,th")').map((i, e) => $(e).children()).get();
        const data = rows.map(r => r.map((i, e) => $(e).text().trim()).get());
        const textTable = new Table(null, data).render();
        return  textTable.split('\n').filter(l => !/^\s*$/.test(l)).map(l => '`' + l + '`').join('\n');
    }

    generateLink(key) {
        if (/^\d/.test(key)) {
            return this.location + key.replace('.', '-');
        } else {
            return this.location + '-' + key;
        }
    }

    formatChapter(chapter) {
        const availableSections = chapter.sections.map(s => `*${_.truncate(this.mtrData.sections[s].title)}* (${s})`).join(', ');
        return [
            `**MTR - ${chapter.title}**`,
            `**Available Sections**: ${availableSections}`
        ].join('\n\n');
    }

    formatSection(section) {
        const sectionContent = [
            `**MTR - ${section.title}**`,
            section.content
        ].join('\n\n');
        if (sectionContent.length <= this.maxLength) {
            return sectionContent;
        }
        // truncate long sections and provide a link to the full text
        const sectionURL = `\n\u2026\n\nSee <${this.generateLink(section.key)}> for full text.`
        return _.truncate(sectionContent, {length: this.maxLength, separator: '\n', omission: sectionURL  });
    }

    getCommands() {
        return this.commands;
    }

    find(parameter) {
        if (parameter.indexOf('-') !== -1 || parameter.indexOf('.') !== -1) {
            // looks like a section query
            const section = this.mtrData.sections[parameter];
            if (section) {
                return this.formatSection(section);
            }
            return 'This section does not exist. Try asking for a chapter to get a list of available sections for that chapter.';
        }

        const chapter =  this.mtrData.chapters[parameter];
        if (chapter) {
            return this.formatChapter(chapter);
        }
        const availableChapters = _.values(this.mtrData.chapters).map(c => `*${c.title}*`).join(', ');
        return `This chapter does not exist.\n**Available Chapters**: ${availableChapters}`;
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            const result = this.find(parameter.trim());
            return msg.channel.sendMessage(result, {split: true});
        }
        return msg.channel.sendMessage('**Magic Tournament Rules**: <' + this.location + '>');
    }
}

module.exports = MTR;
