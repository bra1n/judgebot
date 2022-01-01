// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rp'.
const rp = require("request-promise-native");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable '_'.
const _ = require("lodash");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Discord'.
const Discord = require("discord.js");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
const utils = require("../utils");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const log = utils.getLogger('standard');

class Standard {
    api: any;
    cacheExpireTime: any;
    cachedEmbed: any;
    cachedTime: any;
    commands: any;

    constructor() {
        this.api = "http://whatsinstandard.com/api/v5/sets.json";
        this.commands = {
            standard: {
                aliases: [],
                inline: false,
                description: "Lists the currently standard legal sets and when they will rotate",
                help: 'Standard is a rotating group of Magic: The Gathering sets. Most sets enter Standard when ' +
                'they\'re released and drop out about eighteen months later. (Masters sets never enter Standard.1)\n\n' +
                'A Standard card is a card printed or reprinted into a set currently in Standard. \n\n' +
                'A deck which contains only Standard cards is called a Standard deck.\n\n' +
                'From :link: http://whatsinstandard.com/',
                examples: ["!standard"]
            }
        };
        this.cachedEmbed = null;
        this.cachedTime = null;
        this.cacheExpireTime = 24 * 60 * 60 * 1000; //day in milliseconds
        this.loadList().then(() => {
            log.info("Standard is cached");
        });
    }

    getCommands() {
        return this.commands;
    }

    generateEmbed(setList: any) {
        const currentDate = new Date();
        const removedFutureAndPastSetList = setList.sets.filter((set: any) => {
            return currentDate.getTime() >= new Date(set.enter_date).getTime() &&
                (set.exit_date === null || currentDate.getTime() < new Date(set.exit_date).getTime());
        });
        const groupedSetList = _.groupBy(removedFutureAndPastSetList, "rough_exit_date");
        const descriptions: any = [];
        _.forEach(groupedSetList, (value: any, key: any) => {
            descriptions.push("*Rotates ", key, ":*```", value.map((set: any) => set.name).join(" | "), "```\n");
        });
        const embed = new Discord.MessageEmbed({
            title: "Currently in Standard",
            url: "http://whatsinstandard.com/",
            description: descriptions.join("")
        });
        this.cachedEmbed = embed;
        this.cachedTime = currentDate.getTime();
        return embed;
    }

    loadList() {
        return rp({url: this.api, json: true}).then((body: any) => {
            if (typeof body !== "object") {
                return null;
            } else {
                return this.generateEmbed(body);
            }
        }, (err: any) => {
            log.error("Error getting Standard list", err.error.details);
            return new Discord.MessageEmbed({
                title: "Standard - Error",
                description: "Couldn't create Standard list.",
                color: 0xff0000
            });
        });
    }

    handleMessage(command: any, parameter: any, msg: any) {
        if (this.cachedEmbed !== null && this.cachedTime !== null && new Date().getTime() - this.cachedTime < this.cacheExpireTime) {
            return msg.channel.send("", {embed: this.cachedEmbed});
        }
        this.loadList().then((embed: any) => {
            msg.channel.send("", {embed: embed});
        });
    }
}

module.exports = Standard;
