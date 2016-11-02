const request = require("request");
const cheerio = require("cheerio");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
        this.maxLength = 2000;
        this.maxPreview = 200;
    }

    find(parameters, callback) {
        const handlers = {
            "Definition": "definition",
            "Philosophy": "philosophy",
            "Examples": "examples",
            "Additional Remedy": "remedy",
            "Upgrade": "upgrade",
            "Downgrade": "downgrade"
        };
        const url = this.location+parameters[0].replace(".","-");
        request({
                url: url
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const $ = cheerio.load(body);
                    let result = ["**"+$(".entry-header h1").first().text()+"**\n"];

                    const penalty = $(".alert-warning").first();
                    if(penalty.length>0){
                        result.push("*"+penalty.text().replace(/\r?\n|\r/g, " ").trim().replace(" ",": ")+"*\n");
                        penalty.remove();
                    }

                    const article =  $("article");
                    article.find(".entry-header, .page-navigation, em").remove();

                    const that = this;
                    if(parameters.length === 1){
                        article.find("td").each(function(){
                            result.push($(this).text()+"\n");
                        });
                        article.find("h2, p, li, .card-header").each(function(){
                            let text = $(this).text()+"\n";
                            const nodeName = $(this).prop("nodeName").toLowerCase();
                            if(nodeName==="h2" || nodeName==="div"){
                                text = "\n**"+text+"**";
                            }
                            result.push(text);
                            if(result.join("").length>that.maxPreview){
                                return false;
                            }
                        });
                        callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n')+"<"+url+">");
                    }else{
                        const topics = parameters.slice(1,parameters.length);
                        let writeToggle = false;
                        article.find("h2, p, li, .card-header").each(function(){
                            let text = $(this).text();
                            const nodeName = $(this).prop("nodeName").toLowerCase();
                            if(nodeName==="h2" || nodeName==="div"){
                                if(topics.includes(handlers[text.trim()])) {
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
                            if(result.join("").length+text.length>that.maxLength){
                                callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                                result = [];
                            }
                            result.push(text);
                        });
                        callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n')+"<"+url+">");
                    }
                }
            });
    }

    getContent(command, parameter, callback) {
        if (parameter) {
            this.find(parameter.trim().toLowerCase().split(" "), callback);
        } else {
            callback("<"+this.location+">");
        }

    }
}
module.exports = IPG;
