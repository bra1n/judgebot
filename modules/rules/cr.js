const console = require("console");
const request = require("request");
const log = require("log4js").getLogger('cr');

// Using the current CR as the default, not sure if they actually stick around once new ones are published
const CR_ADDRESS = process.env.CR_ADDRESS || "http://media.wizards.com/2016/docs/MagicCompRules_20160930.txt";

class CR {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/cr/";
        this.commands = ["define", "cr"];

        request({url: CR_ADDRESS, encoding: "utf16le"}, (error, response, body) => {
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
        let rulesText = crText.substring(crText.search("\n\n100. General\n") + 2, crText.length);
        const glossaryStartIndex = rulesText.search("\nGlossary\n") + 1;
        const glossaryText = rulesText.substring(glossaryStartIndex, rulesText.search("\nCredits\n") + 1);
        rulesText = rulesText.substring(0, glossaryStartIndex);

        this.glossary = this.parseGlossary(glossaryText);
        this.cr = this.parseRules(rulesText, this.glossary);
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
            definition = `**${term}** ${this.highlightRules(definition)}`;
            for (const t of term.split(",")) {
                glossaryEntries[t.trim().toLowerCase()] = definition;
            }
        }
        return glossaryEntries;
    }

    parseRules(crText, glossaryEntries) {
        const ruleNumberPrefixRe = /^\d{3}\.\w+\.?/;
        const crEntries = {};

        for (let entry of crText.split("\n\n")) {
            if (!ruleNumberPrefixRe.test(entry)) {
                continue;
            }
            const number = entry.split(" ", 1)[0];
            entry = entry.replace(ruleNumberPrefixRe, "__**$&**__");
            const newEntry = [];
            for (const word of entry.split(" ")) {
                if (glossaryEntries[word]) {
                    newEntry.push(`__${word}__`);
                } else {
                    newEntry.push(word);
                }
            }
            crEntries[number.replace(/\.$/, "")] = this.highlightRules(newEntry.join(" "));
        }
        return crEntries;
    }

    highlightRules(text) {
        return text.replace(/rule \d{3}\.\w*\.?/g, "**$&**");
    }

    handleMessage(command, parameter, msg) {
        if (command === "cr") {
            if (parameter && this.cr) {
                msg.channel.sendMessage(this.cr[parameter.trim().replace(/\.$/, "").toLowerCase()]);
            } else {
                msg.channel.sendMessage('**Comprehensive Rules**: <' + this.location + '>');
            }
        } else if (command === "define" && parameter && this.glossary) {
            msg.channel.sendMessage(this.glossary[parameter.trim().toLowerCase()]);
        }
    }
}

module.exports = CR;
