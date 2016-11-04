class MTR {
    constructor() {
        this.Location = "http://blogs.magicjudges.org/rules/mtr/";
        this.commands = ["mtr"];
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
            msg.channel.sendMessage('**Magic Tournament Rules**: <' + this.Location + '>');
        }
    }
}
module.exports = MTR;
