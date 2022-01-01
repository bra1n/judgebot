const log4js = require("log4js");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'request'.
const request = require("request");
const chalk = require("chalk");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable '_'.
const _ = require("lodash");
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

const modules = [
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

const checkInteractions = async () => {

}

/**
 * Update discord's list of our slash commands
 */
const updateInteractions = async () => {
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
        const identity = await rest.get(
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
// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
const getLogger = (name) => {
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
// @ts-expect-error ts-migrate(7031) FIXME: Binding element 'guild' implicitly has an 'any' ty... Remove this comment to see the full error message
const prettyLog = ({guild, channel = {}, author = {}}, action, log = '') => {
    const logMessage = [
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'name' does not exist on type '{}'.
        chalk.blue('[' + (guild ? guild.name : 'direct message') + '#' + (channel.name || '') +']'),
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'username' does not exist on type '{}'.
        chalk.yellow('[' + (author.username ? author.username + '#' + author.discriminator : 'server') + ']'),
        chalk.magenta('[' + action + ']'),
        log
    ];
    return logMessage.join(' ');
}

// send updated stats to bots.discord.com
// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'bot' implicitly has an 'any' type.
const updateServerCount = (bot) => {
    bot.user.setPresence({
        activity: {
            name: 'MTG on '+ bot.guilds.cache.size +' servers (' + bot.ws.shards.size + ' shards)',
            type: 'PLAYING',
            url: 'https://github.com/bra1n/judgebot'
        }
    });

    const options = {
        url: 'https://bots.discord.pw/api/bots/240537940378386442/stats',
        method: 'POST',
        headers: {'Authorization': process.env.BOT_TOKEN},
        body: {"server_count": bot.guilds.size || 0},
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
};

module.exports = {
    getLogger,
    prettyLog,
    updateServerCount,
    modules,
    updateInteractions
}
