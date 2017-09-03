const _ = require('lodash');
const request = require("request");
const log = require("log4js").getLogger('cr');
const Discord = require('discord.js');

// Using the current CR as the default, not sure if they actually stick around once new ones are published
const CR_ADDRESS = process.env.CR_ADDRESS || "https://sites.google.com/site/mtgfamiliar/rules/MagicCompRules.txt";

class CR {
    constructor() {
        this.commands = {
            cr: {
                aliases: ["define", "rule"],
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

        request({url: CR_ADDRESS}, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                this.initCR(body);
            } else {
                log.error("Error loading CR: " + error);
            }
        });
    }

    getCommands() {
        return this.commands;
    }

    initCR(crText) {
        crText = crText.replace(/\r/g, "");
        let rulesText = crText.substring(crText.search("\nRULES_VERYLONGSTRINGOFLETTERSUNLIKELYTOBEFOUNDINTHEACTUALRULES\n") + 1, crText.length);
        const glossaryStartIndex = rulesText.search("\nGLOSSARY_VERYLONGSTRINGOFLETTERSUNLIKELYTOBEFOUNDINTHEACTUALRULES\n") + 1;
        const glossaryText = rulesText.substring(glossaryStartIndex, rulesText.search("\nEOF_VERYLONGSTRINGOFLETTERSUNLIKELYTOBEFOUNDINTHEACTUALRULES\n") + 1);
        rulesText = rulesText.substring(0, glossaryStartIndex);

        this.glossary = this.parseGlossary(glossaryText);
        this.crData = this.parseRules(rulesText, this.glossary);
        this.crData.description = crText.split('\n')[0];
        log.info("CR Ready");
    }

    parseGlossary(glossaryText) {
        const glossaryEntries = {};

        for (const entry of glossaryText.split("\n\n")) {
            if (!entry.trim()) {
                continue;
            }
            let [term, definition] = entry.split("\n", 2);
            if (!term || !definition) {
                continue;
            }
            definition = `**${term}**\n${this.highlightRules(definition)}`;
            for (const t of term.split(",")) {
                glossaryEntries[t.trim().toLowerCase()] = definition;
            }
        }
        return glossaryEntries;
    }

    parseRules(crText, glossaryEntries) {
        const ruleNumberPrefixRe = /^(\d{3}\.\w+)\.?/;
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
        }
        return _.truncate(description, {length, separator: '\n'});
    }

    handleMessage(command, parameter, msg) {
        // use only the first parameter
        let params = parameter.trim().toLowerCase().split(" ").map(p => p.replace(/\.$/, ""));

        // prepare embed
        const embed = new Discord.RichEmbed({
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
