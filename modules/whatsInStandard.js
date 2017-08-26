const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");

class WhatsInStandard{
    constructor() {
        this.api = "http://whatsinstandard.com/api/4/sets.json";
        this.commands = ["standard"];
    }

    getCommands(){
        return this.commands;
    }

    generateEmbed(setList){
        const currentDate = new Date();
        const removedFutureSetList = setList.filter(set=>{
            const releaseDate = new Date(set.enter_date);
            return currentDate.getTime()>=releaseDate.getTime();
        });
        const groupedSetList = _.groupBy(removedFutureSetList,'rough_exit_date');
        let description = "";
        _.forEach(groupedSetList,(value,key)=>{
           description = description.concat('*Rotates '+key+':*\n ```'+value.map(set=>set.name).join(' | ')+'```\n\n');
        });
        return new Discord.RichEmbed({
            title: "Currently in Standard",
            url:"http://whatsinstandard.com/",
            description
        });
    }

    handleMessage(command, parameter, msg) {
        rp({url: this.api, json:true}).then(body=>
        {
         const embed = this.generateEmbed(body);
         return msg.channel.send('',{embed});
        },err=>{
            log.error("Error getting Standard list",err.error.details);
        });

    }
}

module.exports = WhatsInStandard;