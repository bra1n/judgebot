const log4js = require("log4js");
const request = require("request");
const chalk = require("chalk");

// setup logger
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
const prettyLog = ({guild, channel = {}, author = {}}, action, log = '') => {
    const logMessage = [
        chalk.blue('[' + (guild ? guild.name : 'direct message') + '#' + (channel.name || '') +']'),
        chalk.yellow('[' + (author.username ? author.username + '#' + author.discriminator : 'server') + ']'),
        chalk.magenta('[' + action + ']'),
        log
    ];
    return logMessage.join(' ');
}

// send updated stats to bots.discord.com
const updateServerCount = (bot) => {
    bot.user.setPresence({
        activity: {
            name: 'MTG on '+ bot.guilds.size +' servers (' + bot.ws.shards.size + ' shards)',
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
    updateServerCount
}
