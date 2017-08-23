const _ = require('lodash');
const cheerio = require('cheerio');
const rp = require('request-promise-native');
const log = require('log4js').getLogger('mtr');
const Discord = require('discord.js');

const MTR_ADDRESS = process.env.MTR_ADDRESS || 'https://sites.google.com/site/mtgfamiliar/rules/MagicTournamentRules-light.html';

class MTR {
    constructor(initialize = true) {
        this.location = 'http://blogs.magicjudges.org/rules/mtr';
        this.maxLength = 2040;
        this.commands = ['mtr'];
        this.thumbnail = 'https://assets.magicjudges.org/judge-banner/images/magic-judge.png';
        this.mtrData = {
            description: '',
            chapters: {},
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
        // get description from body
        this.mtrData.description = $('body').get(0).childNodes[4].data.trim();

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
        $('h4').filter((i, e) => /^(\d+\.\d+\s)/.test($(e).text().trim())).addClass('section-header');
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

    handleSectionContent($, sectionHeader, title, number) {
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
        sectionContent.find('h4').replaceWith((i, e) => `<p>\n\n**${$(e).text().trim()}**\n\n</p>`);

        // clean up line breaks
        return sectionContent.text().trim().replace(/\n\s*\n/g, '#break#').replace(/\n/g,' ').replace(/#break#/g,'\n\n');
    }

    generateLink(key) {
        if (/^\d/.test(key)) {
            return this.location + key.replace('.', '-');
        } else {
            return this.location + '-' + key;
        }
    }

    formatChapter(chapter) {
        const availableSections = chapter.sections.map(s => '• '+this.mtrData.sections[s].title).join('\n');
        return new Discord.RichEmbed({
            title: `MTR - ${chapter.title}`,
            description: availableSections,
            thumbnail: {url: this.thumbnail},
            url: 'https://blogs.magicjudges.org/rules/mtr/#'+chapter.title.toLowerCase().replace(/ +/g,'-')
        });
    }

    formatSection(section) {
        return new Discord.RichEmbed({
            title: `MTR - ${section.title}`,
            description: _.truncate(section.content, {length: this.maxLength, separator: '\n'}),
            thumbnail: {url: this.thumbnail},
            url: this.generateLink(section.key)
        });
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
            return new Discord.RichEmbed({
                title: 'MTR - Error',
                description: 'This section does not exist. Try asking for a chapter to get a list of available sections for that chapter.',
                color: 0xff0000
            });
        }

        const chapter =  this.mtrData.chapters[parameter];
        if (chapter) {
            return this.formatChapter(chapter);
        }
        return new Discord.RichEmbed({
            title: 'MTR - Error',
            description: 'This chapter does not exist.',
            color: 0xff0000
        }).addField('Available Chapters', _.values(this.mtrData.chapters).map(c => '• '+c.title));
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            const embed = this.find(parameter.toLowerCase().trim().split(" ")[0]);
            return msg.channel.send('', {embed});
        }
        return msg.channel.send('', {embed: new Discord.RichEmbed({
            title: 'Magic Tournament Rules',
            description: this.mtrData.description,
            thumbnail: {url: this.thumbnail},
            url: this.location
        }).addField('Available Chapters', _.values(this.mtrData.chapters).map(c => '• '+c.title))});
    }
}

module.exports = MTR;
