const request = require("request");
const cheerio = require("cheerio");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
        this.maxLength = 2000;
        this.commands = ["ipg"];
        this.aliases = {
            'definition': '1-1',
            'applying': '1-1',
            'backup': '1-4',
            'randomizing': '1-3',
            'random': '1-3',
            'mt': '2-1',
            'trigger': '2-1',
            'l@ec': '2-2',
            'laec': '2-2',
            'hce': '2-3',
            'dec': '2-3',
            'mulligan': '2-4',
            'mpe': '2-4',
            'grv': '2-5',
            'ftmgs': '2-6',
            'f2mgs': '2-6',
            'gpe': '2',
            'te': '3',
            'general': '1',
            'tardiness': '3-1',
            'tardy': '3-1',
            'oa': '3-2',
            'sp': '3-3',
            'slowplay': '3-3',
            'is': '3-4',
            'shuffling': '3-4',
            'ddlp': '3-5',
            'd/dlp': '3-5',
            'lpv': '3-6',
            'cpv': '3-7',
            'mc': '3-8',
            'usc': '4',
            'uscminor': '4-1',
            'uscmajor': '4-2',
            'idw': '4-3',
            'idaw': '4-3',
            'bribery': '4-4',
            'wagering': '4-4',
            'baw': '4-4',
            'ab': '4-5',
            'aggressive': '4-5',
            'theft': '4-6',
            'totm': '4-6',
            'tot': '4-6',
            'stalling': '4-7',
            'cheating': '4-8'
        }
    }

    getCommands() {
        return this.commands;
    }

    find(parameter, msg) {
        request({
                url: this.location + parameter
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const $ = cheerio.load(body);
                    let result = ["**" + $(".entry-header h1").first().text() + "**\n"];

                    const penalty = $(".alert-warning").first();
                    if (penalty.length > 0) {
                        result.push("*" + penalty.text().replace(/\r?\n|\r/g, ' ').trim().replace(" ", ": ") + "*\n");
                        penalty.remove();
                    }

                    const article = $("article");
                    article.find(".entry-header, .page-navigation, em").remove();

                    const that = this;
                    article.find("h2, p, li, td, .card-header").each(function () {
                        let text = $(this).text() + "\n";
                        const nodeName = $(this).prop("nodeName").toLowerCase();
                        if (nodeName === "h2" || nodeName === "div") {
                            text = "\n**" + text + "**";
                        }
                        if (result.join("").length + text.length > that.maxLength) {
                            msg.channel.sendMessage(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                            result = [];
                        }
                        result.push(text);
                    });
                    msg.channel.sendMessage(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                }
            });
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            let paragraph = parameter.toLocaleLowerCase().trim().split(" ")[0].replace(".", "-");
            if(this.aliases[paragraph]) paragraph = this.aliases[paragraph];
            this.find(paragraph, msg);
        } else {
            msg.channel.sendMessage("**Infraction Procedure Guide**: <" + this.location + ">");
        }

    }
}
module.exports = IPG;
