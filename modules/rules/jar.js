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
            return msg.channel.send(this.find(parameter));
        }
        return msg.channel.send('**Judging at Regular**: <' + this.Location + '>');
    }
}
module.exports = JAR;
