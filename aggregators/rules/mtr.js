class MTR {
    constructor() {
        this.Location = "http://blogs.magicjudges.org/rules/mtr/";
    }

    find(parameter, callback) {
        //todo
    }

    getContent(command, parameter, callback) {
        if (parameter) {
            this.find(parameter, callback());
        } else {
            callback(this.Location);
        }
    }
}
module.exports = MTR;
