const rp = require("request-promise-native");
const cheerio = require("cheerio");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
        this.maxLength = 2000;
        this.maxPreview = 200;
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
        };
        this.handlers = {"Definition": "definition",
            "Philosophy": "philosophy",
            "Examples": "examples",
            "Additional Remedy": "remedy",
            "Upgrade": "upgrade",
            "Downgrade": "downgrade"};
    }

    getCommands() {
        return this.commands;
    }

    find(parameters, msg) {
        const options = {
            url: this.location + parameters[0],
            simple: false,
            resolveWithFullResponse: true
        };
        return rp(options).then(response => {
            if (response.statusCode === 200) {
                const $ = cheerio.load(response.body);
                let result = ["**" + $(".entry-header h1").first().text() + "**\n"];

                const penalty = $(".alert-warning").first();
                if (penalty.length > 0) {
                    result.push("*" + penalty.text().replace(/\r?\n|\r/g, ' ').trim().replace(" ", ": ") + "*\n");
                    penalty.remove();
                }

                const article = $("article");
                article.find(".entry-header, .page-navigation, em").remove();

                const that = this;
                if(parameters.length === 1){
                    article.find("td").each((index,element)=>{
                        result.push($(element).text()+"\n");
                    });
                    article.find("h2, p, li, .card-header").each((index,element)=>{
                        let text = $(element).text()+"\n";
                        const nodeName = $(element).prop("nodeName").toLowerCase();
                        if(nodeName==="h2" || nodeName==="div"){
                            text = "\n**"+text+"**";
                        }
                        result.push(text);
                        if(result.join("").length>that.maxPreview){
                            return false;
                        }
                    });
                }else{
                    const topics = parameters.slice(1,parameters.length);
                    let writeToggle = false;
                    article.find("h2, p, li, .card-header").each((index,element) => {
                        let text = $(element).text();
                        const nodeName = $(element).prop("nodeName").toLowerCase();
                        if(nodeName==="h2" || nodeName==="div"){
                            if(topics.includes(this.handlers[text.trim()])) {
                                writeToggle = true;
                                text = "\n**"+text+"\n**";
                            }else{
                                writeToggle = false;
                                return;
                            }
                        }else{
                            text = text +"\n";
                        }
                        if(!writeToggle){
                            return;
                        }
                        result.push(text);
                    });
                }
                return msg.channel.sendMessage(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'),{"split":"true"});
            }
        });
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            let parameters = parameter.trim().toLowerCase().split(" ");
            parameters[0] = parameters[0].replace(".", "-");
            if(this.aliases[parameters[0]]) parameters[0] = this.aliases[parameters[0]];
            return this.find(parameters, msg);
        } else {
            return msg.channel.sendMessage("**Infraction Procedure Guide**: <" + this.location + ">");
        }

    }
}
module.exports = IPG;
