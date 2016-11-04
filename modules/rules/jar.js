class JAR {
    constructor() {
        this.Location = "http://blogs.magicjudges.org/rules/ipg/";
        this.commands = ["jar"];
    }

    getCommands() {
        return this.commands;
    }

    find(parameter) {
        //todo
    }

    handleMessage(command, parameter, msg) {
        if (parameter) {
            msg.channel.sendMessage(this.find(parameter));
        } else {
            msg.channel.sendMessage('**Judging at Regular**: <' + this.Location + '>');
        }

    }
}
module.exports = JAR;
