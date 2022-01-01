const _ = require('lodash');
const iconv = require('iconv-lite');
const request = require("request");
const utils = require("../../utils");
const log = utils.getLogger('cr');
const Discord = require('discord.js');

const CR_ADDRESS = process.env.CR_ADDRESS || "http://cr.vensersjournal.com";

class CR {
    constructor() {
        this.commands = {
            cr: {
                aliases: ["define", "rule"],
                inline: true,
                description: "Show a rule or definition from the Comprehensive Rulebook",
                help: "This command can be used to look up rules (including subrules and examples), as well as Glossary definitions from the Comprehensive Rulebook.",
                examples: ["!cr 508.1d", "!rule 702.15", "!define lifelink"]
            }
        };
        this.location = "http://blogs.magicjudges.org/rules/cr";
        this.glossary = {};
        this.thumbnail = 'https://assets.magicjudges.org/judge-banner/images/magic-judge.png';
        this.crData = {};
        this.maxLength = 2040;

        request({url: CR_ADDRESS, encoding: null}, (error, response, body) => {
            if (!error && response.statusCode === 200 && body) {
                this.initCR(iconv.decode(body, 'utf-8'));
            } else {
                log.error("Error loading CR: " + error);
            }
        });
    }

    getCommands() {
        return this.commands;
    }

    initCR(crText) {
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

    parseGlossary(glossaryText) {
        const glossaryEntries = {};

        for (const entry of glossaryText.split("\n\n")) {
            if (!entry.trim()) {
                continue;
            }
            let [term, ...definition] = entry.split("\n");
            if (!term || !definition.length) {
                continue;
            }
            definition = `**${term}**\n${this.highlightRules(definition.join("\n"))}`;
            for (const t of term.split(",")) {
                glossaryEntries[t.trim().toLowerCase()] = definition;
            }
        }
        return glossaryEntries;
    }

    parseRules(crText, glossaryEntries) {
        const ruleNumberPrefixRe = /^(\d{3}\.\w*)\.?/;
        const crEntries = {};

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
            entry.split('\n').forEach(line => {
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

    highlightRules(text) {
        return text.replace(/rule \d{3}\.\w*\.?/ig, "`$&`");
    }

    appendSubrules(parameter, length = this.maxLength) {
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

    handleMessage(command, parameter, msg) {
        // use only the first parameter
        let params = parameter.trim().toLowerCase().split(" ").map(p => p.replace(/\.$/, ""));

        // prepare embed
        const embed = new Discord.MessageEmbed({
            title: 'Comprehensive Rules',
            description: 'Effective '+this.crData.description,
            thumbnail: {url: this.thumbnail},
            url: this.location + '/'
        });

        // check first for CR paragraph match
        if (params[0] && this.crData[params[0]]) {
            // in case there is a second parameter "ex", append it
            if (params[1] === "ex") params[0] += ' ex';
            embed.setTitle('CR - Rule ' + params[0].replace(/ ex$/,' Examples'))
                .setDescription(this.appendSubrules(params[0]))
                .setURL(this.location + params[0].substr(0,3) + '/');
            if (this.crData[params[0] + ' ex']) {
                embed.setFooter('Use "!'+Object.keys(this.commands)[0]+' '+params[0]+' ex" to see examples.');
            }
        } else {
            // try to find a match in the glossary while stripping of parameters until there are none left or they match
            for (;params.length;params.pop()) {
                if (this.glossary[params.join(" ")]) {
                    embed.setTitle('CR - Glossary for "'+params.join(" ")+'"')
                        .setDescription(this.glossary[params.join(" ")])
                        .setURL(this.location + '/cr-glossary/');
                    const rule = this.glossary[params.join(" ")].match(/rule (\d+\.\w+)/i);
                    if (rule && this.crData[rule[1]]) {
                        embed.addField('CR - Rule '+rule[1], this.appendSubrules(rule[1], 1020));
                    }
                    break;
                }
            }
        }
        return msg.channel.send('', {embed});
    }
}

module.exports = CR;
