// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable '_'.
const _ = require('lodash');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'cheerio'.
const cheerio = require('cheerio');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rp'.
const rp = require('request-promise-native');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
const utils = require("../../utils");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const log = utils.getLogger('mtr');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Discord'.
const Discord = require('discord.js');

const MTR_ADDRESS = process.env.MTR_ADDRESS || 'https://raw.githubusercontent.com/AEFeinstein/GathererScraper/master/rules/MagicTournamentRules-light.html';

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'MTR'.
class MTR {
    commands: any;
    location: any;
    maxLength: any;
    mtrData: any;
    thumbnail: any;
    constructor(initialize = true) {
        this.location = 'http://blogs.magicjudges.org/rules/mtr';
        this.maxLength = 2040;
        this.commands = {
            mtr: {
                aliases: [],
                inline: true,
                description: "Show an entry from Magic: The Gathering Tournament Rules",
                help: '',
                examples: ["!mtr 2", "!mtr 4.2"]
            }
        };
        this.thumbnail = 'https://assets.magicjudges.org/judge-banner/images/magic-judge.png';
        this.mtrData = {
            description: '',
            chapters: {},
            sections: {}
        };

        if (initialize) {
            this.download(MTR_ADDRESS).then((mtrDocument: any) => this.init(mtrDocument));
        }
    }

    download(url: any) {
        return rp({url: url, simple: false, resolveWithFullResponse: true }).then((response: any) => {
                if (response.statusCode === 200) {
                    return response.body;
                } else {
                    log.error('Error loading MTR, server returned status code ' + response.statusCode);
                }
            }).catch((e: any) => log.error('Error loading MTR: ' + e, e));
    }

    init(mtrDocument: any) {
        const $ = cheerio.load(mtrDocument);
        this.cleanup($);
        this.handleChapters($);
        this.handleSections($);
        log.info('MTR Ready');
    }

    cleanup($: any) {
        // get description from body
        this.mtrData.description = $('body').get(0).childNodes[0].data.trim() || '';

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
        $('p').filter((i: any, e: any) => /^\s*$/.test($(e).text())).remove();

        // mark chapter headers
        $('h2').filter((i: any, e: any) => /^\d+\.\s/.test($(e).text().trim())).addClass('chapter-header');
        // mark section headers
        $('h1').filter((i: any, e: any) => /^MTR (\d+\.\d+\s)/.test($(e).text().trim())).addClass('section-header');
    }

    handleChapters($: any) {
        $('.chapter-header').each((i: any, e: any) => {
            const title = $(e).text().trim();
            const number = title.split('.', 1)[0];
            this.mtrData.chapters[number] = {
                key: number,
                title: title,
                sections: []
            };
        });
    }

    handleSections($: any) {
        $('.section-header').each((i: any, e: any) => {

            const title = $(e).text().substr(4).trim();
            const key = title.split(/\s/, 1)[0];
            const chapter = key.split('.', 1)[0];
            const content = this.handleSectionContent($, $(e), title, key);

            this.mtrData.sections[key] = {
                key: key,
                title: title,
                content: content
            };
            this.mtrData.chapters[chapter].sections.push(key);
        });
    }

    handleSectionContent($: any, sectionHeader: any, title: any, number: any) {
        /* on most sections we can just use the text, special cases are:
         *   - banlists (sections ending in deck construction), these are basically long lists of sets and cards
         */
        if (/Format Deck Construction$/.test(title)) {
            // Asking a bot for the banlist has to be one of the worst ways to inquire about card legality that I can imagine,
            // defer handling this until I'm really bored and redirect people to the annotated mtr in the meantime
            return `You can find the full text of ${title} on <${this.generateLink(number)}>`;
        }

        // there are some headers which are neither section nor chapter headers interspersed in the sections
        const sectionContent = sectionHeader.nextUntil('.section-header,.chapter-header').wrap('<div></div>').parent();
        sectionContent.find('h4').replaceWith((i: any, e: any) => `<p>\n\n**${$(e).text().trim()}**\n\n</p>`);

        // clean up line breaks
        return sectionContent.text().trim().replace(/\n\s*\n/g, '#break#').replace(/\n/g,' ').replace(/#break#/g,'\n\n');
    }

    generateLink(key: any) {
        if (/^\d/.test(key)) {
            return this.location + key.replace('.', '-');
        } else {
            return this.location + '-' + key;
        }
    }

    formatChapter(chapter: any) {
        const availableSections = chapter.sections.map((s: any) => '• '+this.mtrData.sections[s].title).join('\n');
        return new Discord.MessageEmbed({
            title: `MTR - ${chapter.title}`,
            description: availableSections,
            thumbnail: {url: this.thumbnail},
            url: 'https://blogs.magicjudges.org/rules/mtr/#'+chapter.title.toLowerCase().replace(/ +/g,'-')
        });
    }

    formatSection(section: any) {
        return new Discord.MessageEmbed({
            title: `MTR - ${section.title}`,
            description: _.truncate(section.content, {length: this.maxLength, separator: '\n'}),
            thumbnail: {url: this.thumbnail},
            url: this.generateLink(section.key)
        });
    }

    getCommands() {
        return this.commands;
    }

    find(parameter: any) {
        if (parameter.indexOf('-') !== -1 || parameter.indexOf('.') !== -1) {
            // looks like a section query
            const section = this.mtrData.sections[parameter];
            if (section) {
                return this.formatSection(section);
            }
            return new Discord.MessageEmbed({
                title: 'MTR - Error',
                description: 'This section does not exist. Try asking for a chapter to get a list of available sections for that chapter.',
                color: 0xff0000
            });
        }

        const chapter =  this.mtrData.chapters[parameter];
        if (chapter) {
            return this.formatChapter(chapter);
        }
        return new Discord.MessageEmbed({
            title: 'MTR - Error',
            description: 'This chapter does not exist.',
            color: 0xff0000
        }).addField('Available Chapters', _.values(this.mtrData.chapters).map((c: any) => '• '+c.title));
    }

    handleMessage(command: any, parameter: any, msg: any) {
        if (parameter) {
            const embed = this.find(parameter.toLowerCase().trim().split(" ")[0]);
            return msg.channel.send('', {embed});
        }
        return msg.channel.send('', {embed: new Discord.MessageEmbed({
            title: 'Magic Tournament Rules',
            description: this.mtrData.description,
            thumbnail: {url: this.thumbnail},
            url: this.location
        }).addField('Available Chapters', _.values(this.mtrData.chapters).map((c: any) => '• '+c.title))});
    }
}

module.exports = MTR;
