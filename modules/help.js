class Help {
    constructor() {
        this.commands = ["help"];
        this.commandList = {
            '!card': 'Search for an English Magic card by (partial) name, *Example: !card iona*',
            '!ipg': 'Show an entry from the Infraction Procedure Guide, *Example: !ipg 4.2, !ipg grv*',
            '!cr': 'Show an entry from the Comprehensive Rulebook, *Example: !cr 100.6b*',
            '!define': 'Show a definition from the Comprehensive Rulebook, *Example: !define phasing*'
        };
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        let response = "**Available commands:**\n";
        for(let cmd in this.commandList) {
            response += `:small_blue_diamond: **${cmd}**: ${this.commandList[cmd]}\n`;
        }
        response += "\nThis judgebot is provided free of charge and can be added to your channel, too!\n";
        response += ":link: https://bots.discord.pw/bots/240537940378386442\n";
        response += ":link: https://github.com/bra1n/judgebot\n";
        return msg.author.sendMessage(response);
    }
}
module.exports = Help;
