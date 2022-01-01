import * as utils from "../utils.js";
import {Discord, Slash, SlashChoice, SlashOption, SlashOptionParams} from "discordx";
import {CommandInteraction, Message, MessageEmbed} from "discord.js";
import _ from "lodash";
import fetch from 'node-fetch';

const log = utils.getLogger('standard');

@Discord()
export default class Standard {
    api: any;
    cacheExpireTime: any;
    cachedEmbed: any;
    cachedTime: any;
    commands: any;

    constructor() {
        this.api = "http://whatsinstandard.com/api/v5/sets.json";
        this.cachedEmbed = null;
        this.cachedTime = null;
        this.cacheExpireTime = 24 * 60 * 60 * 1000; //day in milliseconds
        this.loadList().then(() => {
            log.info("Standard is cached");
        });
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
        const embed = new MessageEmbed({
            title: "Currently in Standard",
            url: "http://whatsinstandard.com/",
            description: descriptions.join("")
        });
        this.cachedEmbed = embed;
        this.cachedTime = currentDate.getTime();
        return embed;
    }

    async loadList() {
        try {
            const res = await fetch(this.api);
            const body = await res.json();
            if (typeof body !== "object") {
                return null;
            } else {
                await this.generateEmbed(body);
            }
        }
        catch(err: any) {
            log.error("Error getting Standard list", err);
            return new MessageEmbed({
                title: "Standard - Error",
                description: "Couldn't create Standard list.",
                color: 0xff0000
            });
        }
    }

    @Slash("standard", {
        description: "Lists the currently standard legal sets and when they will rotate"
    })
    async standard(
        interaction: CommandInteraction
    ){
        if (this.cachedEmbed !== null && this.cachedTime !== null && new Date().getTime() - this.cachedTime < this.cacheExpireTime) {
            await interaction.reply({embeds: [this.cachedEmbed]});
        }
        else {
            const embed = <MessageEmbed>await this.loadList();
            await interaction.reply({embeds: [embed]});
        }
    }
}
