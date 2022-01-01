class JAR {
    Location: any;
    commands: any;
    constructor() {
        this.Location = "https://blogs.magicjudges.org/rules/jar/";
        this.commands = {
            jar: {
                aliases: [],
                inline: false,
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

    handleMessage(command: any, parameter: any, msg: any) {
        return msg.channel.send('**Judging at Regular**: <' + this.Location + '>');
    }
}
module.exports = JAR;
