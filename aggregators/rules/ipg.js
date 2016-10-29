const jsDOM = require("jsdom");
class IPG {
    constructor() {
        this.location = "http://blogs.magicjudges.org/rules/ipg";
    }

    find(parameter, callback) {
        jsDOM.env(
            this.location + parameter,
            ["http://code.jquery.com/jquery.js"],
            /**
             *
             * @param err
             * @param window
             * @param window.$ jquery
             * @param window.$.each jquery for each loop
             * @param window.$.prop jquery property
             */
            function(err,window){
                let resultLength = (window.$(".entry-header h1:first").text()).length+6;
                const result = ["**"+window.$(".entry-header h1:first").text()+"**\n"];
                window.$(".alert-info").remove();
                window.$(".entry-content h2, .entry-content p, .entry-content li, .entry-content td").each(function(){
                    let text = window.$(this).text()+"\n";
                    if(window.$(this).prop("nodeName").toLocaleLowerCase()==="h2"){
                        text = "\n**"+text+"**";
                    }
                    if(resultLength+text.length>2000){
                        callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'));
                        resultLength = 0;
                        result.length = 0;
                    }
                    result.push(text);
                    resultLength+=text.length;
                });
                callback(result.join("").replace(/\n\s*\n\s*\n/g, '\n\n'))
            }
        )
    }

    getContent(parameter, callback) {
        if (parameter) {
            const parameters = parameter.trim().split(" ");
            this.find(parameters[0].replace(".","-"), callback);
        } else {
            callback("<"+this.location+">");
        }

    }
}
module.exports = IPG;
