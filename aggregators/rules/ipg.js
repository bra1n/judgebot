const jsDOM = require("jsdom");
const jQuery = require("jquery");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
    }

    find(parameter, callback) {
        jsDOM.env(
            this.location + parameter,
            /**
             *
             * @param err
             * @param window
             */
            function(err,window){
                const $ = jQuery(window);
                const maxLength = 2000;
                $(window);
                let result = ["**"+$(".entry-header h1:first").text()+"**\n"];
                const penalty = $(".alert-warning:first");
                if(penalty.length>0){
                    result.push("*"+penalty.text().replace(/\r?\n|\r/g, ' ').trim()+"*\n");
                    penalty.remove();
                }
                $(".alert-info").remove();
                $(".entry-content").children("h2, p, li, td").each(function(){
                    let text = $(this).text()+"\n";
                    if($(this).prop("nodeName").toLocaleLowerCase()==="h2"){
                        text = "\n**"+text+"**";
                    }
                    if(result.join("").length+text.length>maxLength){
                        callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                        result = [];
                    }
                    result.push(text);
                });
                callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'))
            }
        )
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
