import log4js from "log4js";
import request from "request";
import chalk from "chalk";
import _ from "lodash";
import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {Guild, Client, User, ActivityType} from "discord.js"

export const token = process.env?.DISCORD_TOKEN;
if (!token){
    throw new Error("Token required.");
}
const rest = new REST({ version: '9' }).setToken(token);

export const modules = [
    'card',
    'hangman',
    'standard',
    // 'store',
    'rules/cr',
    'rules/ipg',
    'rules/mtr',
    'rules/jar',
    'help'
];

/**
 * Update discord's list of our slash commands
 */
export const updateInteractions = async () => {
    const log = getLogger('bot');
    const interactions: any = [];
    modules.forEach((module, index) => {
        const moduleObject = new (require("./modules/" + module + '.js'))(modules);
            if ("getInteractions" in moduleObject){
                _.forEach(moduleObject.getInteractions(), (value: any, key: any) => {
                    interactions.push(value.parser.toJSON())
                });
            }
    });

	try {
        log.info('Finding bot ID');
        const identity: any = await rest.get(
            Routes.user()
        )

		log.info('Started refreshing application (/) commands.');

		const updateResult = await rest.put(
			Routes.applicationCommands(identity.id) ,
			{ body: interactions },
		);

		log.info('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}

// setup logger
export function getLogger(name: string){
    let logPattern = '%[[%p]%] '+chalk.red('[%c]') +' - %m';
    if (!process.env.PAPERTRAIL_API_TOKEN) {
        logPattern = '[%d{yy/MM/dd hh:mm:ss}] ' + logPattern;
    }
    // configure pattern
    log4js.configure({
        appenders: {out: {type: 'stdout', layout: {type: 'pattern', pattern: logPattern}}},
        categories: { default: { appenders: ['out'], level: process.env.LOG_LEVEL || "info" } }
    });
    return log4js.getLogger(name + '-' + process.pid);
}

// create a pretty log message for a user / guild
export const prettyLog = ({guild, channel = undefined, author = undefined}: {
    guild: Guild,
    channel?: any | undefined,
    author?: User | undefined,
}, action: string, log: string = '') => {
    const logMessage = [
        chalk.blue('[' + (guild?.name || 'direct message') + '#' + (channel?.name || '') +']'),
        chalk.yellow('[' + (author?.username ? author.username + '#' + author.discriminator : 'server') + ']'),
        chalk.magenta('[' + action + ']'),
        log
    ];
    return logMessage.join(' ');
}

// send updated stats to bots.discord.com
export function updateServerCount(bot: Client){
    bot.user?.setPresence({
       activities: [
           {
            name: 'MTG on '+ bot.guilds.cache.size +' servers (' + bot.ws.shards.size + ' shards)',
            type: ActivityType.Playing,
            url: 'https://github.com/bra1n/judgebot'
        }
       ]
    });

    const options = {
        url: 'https://bots.discord.pw/api/bots/240537940378386442/stats',
        method: 'POST',
        headers: {'Authorization': process.env.BOT_TOKEN},
        body: {"server_count": bot.guilds.cache.size || 0},
        json: true
    };

    // post stats to bots.discord.pw
    if (process.env.BOT_TOKEN) {
        request(options);
    }

    // post stats to discordbots.org
    if (process.env.BOT_TOKEN2) {
        options.url = 'https://discordbots.org/api/bots/240537940378386442/stats';
        options.headers['Authorization'] = process.env.BOT_TOKEN2;
        request(options);
    }
}
