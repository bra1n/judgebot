var request = require("request");
var console = require("console");

const CR_ADDRESS = process.env.CR_ADDRESS; // http://media.wizards.com/2016/docs/MagicCompRules_20160930.txt or newer

class CR{
    constructor(){
		this.location = "http://blogs.magicjudges.org/rules/cr/";
		request({url: CR_ADDRESS, encoding: "utf16le"}, (error, response, body) => {
			 if (!error && response.statusCode == 200) {
				 let {cr, glossary} = parseCR(body);
				 this.cr = cr;
				 this.glossary = glossary;
				 console.log("CR Ready")
			 } else {
				 console.error(error);
			 }
		});
    }
    find (parameter,callback){
        callback(this.cr.get(parameter.trim().replace(/\.$/, "").toLowerCase()));
    }
    getContent(parameter,callback) {
        if (parameter) {
            this.find(parameter, callback);
        } else {
            callback(this.location);
        }
    }
	getGlossaryEntry(parameter, callback) {
		callback(this.glossary.get(parameter.trim().toLowerCase()));
	}
}


function parseCR(crText) {
	crText = crText.replace(/\r/g, "");

	let rulesText = crText.substring(crText.search("\n\n100. General\n") + 2, crText.length);
	let glossaryStartIndex = rulesText.search("\nGlossary\n") + 1;
	let glossaryText = rulesText.substring(glossaryStartIndex, rulesText.search("\nCredits\n") + 1);
	rulesText = rulesText.substring(0, glossaryStartIndex);

	let glossaryEntries = parseGlossary(glossaryText);
	let rulesEntries = parseRules(rulesText, glossaryEntries);

	return {cr: rulesEntries, glossary: glossaryEntries};
}

function parseGlossary(glossaryText) {
	let glossaryEntries = new Map();

	for (let entry of glossaryText.split("\n\n")) {
		if (!entry.trim()) {
			continue;
		}
		let [term, definition] = entry.split("\n", 2);
		if (!term || !definition) {
			continue;
		}
		definition = `**${term}** ${highlightRules(definition)}`
		for (let t of term.split(",")) {
			glossaryEntries.set(t.trim().toLowerCase(), definition);
		}
	}
	return glossaryEntries;
}

function parseRules(crText, glossaryEntries) {
	const ruleNumberPrefixRe = /^\d{3}\.\w+\.?/;
	let crEntries = new Map();

	for (let entry of crText.split("\n\n")) {
		if (!ruleNumberPrefixRe.test(entry)){
			continue;
		}
		let number = entry.split(" ", 1)[0];
		entry = entry.replace(ruleNumberPrefixRe, "__**$&**__");
		let newEntry = [];
		for (let word of entry.split(" ")) {
			if (glossaryEntries.has(word)) {
				newEntry.push( `__${word}__`);
			} else {
				newEntry.push(word);
			}
		}
		crEntries.set(number.replace(/\.$/, ""), highlightRules(newEntry.join(" ")));	
	}
	return crEntries;
}

function highlightRules(text) {
	return text.replace(/rule \d{3}\.\w*\.?/g, "**$&**");
}

module.exports = CR;