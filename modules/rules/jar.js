class JAR {
    constructor() {
        this.Location = "https://blogs.magicjudges.org/rules/jar/";
        this.commands = {
            jar: {
                aliases: [],
                description: "Show the link to the Judging at Regular document (this feature is WIP)",
                help: 'This command currently only returns the link to the JAR document, but will contain the whole ' +
                'document in the near future.',
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
