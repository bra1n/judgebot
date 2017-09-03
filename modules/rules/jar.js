class JAR {
    constructor() {
        this.Location = "https://blogs.magicjudges.org/rules/jar/";
        this.commands = ["jar"];
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        return msg.channel.send('**Judging at Regular**: <' + this.Location + '>');
    }
}
module.exports = JAR;
