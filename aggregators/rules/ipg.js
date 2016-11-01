const request = require("request");
const cheerio = require("cheerio");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
        this.maxLength = 2000;
    }

    find(parameter, callback) {
        request({
                url: this.location + parameter
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const $ = cheerio.load(body);
                    let result = ["**"+$(".entry-header h1").first().text()+"**\n"];

                    const penalty = $(".alert-warning").first();
                    if(penalty.length>0){
                        result.push("*"+penalty.text().replace(/\r?\n|\r/g, ' ').trim().replace(" ",": ")+"*\n");
                        penalty.remove();
                    }

                    const article =  $("article");
                    article.find(".entry-header, .page-navigation, em").remove();

                    const that = this;
                    article.find("h2, p, li, td, .card-header").each(function(){
                        let text = $(this).text()+"\n";
                        const nodeName = $(this).prop("nodeName").toLowerCase();
                        if(nodeName==="h2" || nodeName==="div"){
                            text = "\n**"+text+"**";
                        }
                        if(result.join("").length+text.length>that.maxLength){
                            callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                            result = [];
                        }
                        result.push(text);
                    });
                    callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                }
            });
    }

    getContent(command, parameter, callback) {
        if (parameter) {
            const parameters = parameter.trim().split(" ");
            this.find(parameters[0].replace(".","-"), callback);
        } else {
            callback("<"+this.location+">");
        }

    }
}
module.exports = IPG;
