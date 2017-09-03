class JAR {
    constructor() {
        this.Location = "https://blogs.magicjudges.org/rules/jar/";
        this.commands = {
            jar: {
                aliases: [],
                description: "Show the link to the Judging at Regular document (this feature is WIP)",
                help: '',
                examples: ["!jar"]
            }
        };
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        return msg.channel.send('**Judging at Regular**: <' + this.Location + '>');
    }
}
module.exports = JAR;
