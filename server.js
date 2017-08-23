const Discord = require("discord.js");
const request = require("request");
const log = require("log4js").getLogger('bot');
const _ = require("lodash");

log.setLevel(process.env.LOG_LEVEL || "INFO");

const commandChar = process.env.COMMAND_CHAR || "!";
const spamTimeout = 3000; // milliseconds
const modules = [
    'rules/mtr',
    'rules/ipg',
    'rules/cr',
    'rules/jar',
    'card',
    'help',
    'hangman'
];

const bot = new Discord.Client();
const handlers = {};
modules.forEach(module => {
    const moduleObject = new (require("./modules/" + module + '.js'))();
    if(moduleObject) {
        log.info("Successfully initialized module", module);
        moduleObject.getCommands().forEach(command => {
            handlers[command] = moduleObject;
        });
    } else {
        log.error("Couldn't initialize module", module);
    }
});

// remember timestamps for last message per user
const userMessageTimes = {};

// generate RegExp pattern for message parsing
// Example: ^!(card|price) ?(.*)$|!(card|price) ?([^!]*)(!|$)
const charPattern = _.escapeRegExp(commandChar);
const commandPattern = charPattern+'('+Object.keys(handlers).map(_.escapeRegExp).join('|')+')';
const regExpPattern = `(\s|^)${commandPattern}( .*?)?(${charPattern}[^a-z0-9]|$)`;
const regExpObject = new RegExp(regExpPattern, 'ig');

/* Handle incoming messages */
bot.on("message", msg => {
    const queries = msg.content.match(regExpObject) || [];
    const lastMessage = userMessageTimes[msg.author.id] || 0;

    // check if it's a message for us
    if (!queries.length || // no commands entered
        msg.author.bot || // ignore bots
        (msg.guild && msg.guild.id === '110373943822540800') || // discord bots server with shitty rules and billions of other bots
        bot.user.id === msg.author.id || // don't message yourself
        new Date().getTime() - lastMessage < spamTimeout) // too spammy
    {
        // if the message mentions us, log it
        if (!msg.author.bot && // don't log if we mention ourselves
            (msg.content.toLowerCase().indexOf(bot.user.username.toLowerCase()) > -1 ||
            msg.mentions.users.has(bot.user.id))) {
            logMessage(msg, `said about us: "${msg.content}"`);
        }
        return;
    }

    // store the time to prevent spamming from this user
    userMessageTimes[msg.author.id] = new Date().getTime();

    // only use the first 3 commands in a message, ignore the rest
    queries.slice(0,3).forEach(query => {
        const command = query.split(" ")[0].substr(commandChar.length).toLowerCase();
        const parameter = query.split(" ").slice(1).join(" ").replace(new RegExp(charPattern+'$', 'i'),'');

        logMessage(msg, `used: "${command} ${parameter}"`);
        const ret = handlers[command].handleMessage(command, parameter, msg);
        // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
        Promise.resolve(ret).catch(e => log.error('An error occured while handling', msg.content, ":", e.message));
    })
});

/* Bot event listeners */
bot.on('ready', () => {
    log.info('Bot is ready! Username:', bot.user.username, '/ Servers:', bot.guilds.size );
    updateServerCount();
});

bot.on('guildCreate', (guild) => {
    log.info('I just joined a server:', guild.name);
    updateServerCount();
});

bot.on('guildDelete', (guild) => {
    log.info('I just left a server:', guild.name);
    updateServerCount();
});

bot.login(process.env.DISCORD_TOKEN);

// log a message from a user / guild
const logMessage = (msg, action) => {
    let logMessage = [
        '[' + (msg.guild ? msg.guild.name : 'private query') + ']',
        msg.channel.name ? '[' + msg.channel.name + ']' : '',
        msg.author.username + '#' + msg.author.discriminator,
        action
    ];
    log.info(logMessage.join(' '));
}

// send updated stats to bots.discord.com
const updateServerCount = () => {
    bot.user.setPresence({
        game: {
            name: 'MTG on '+ bot.guilds.size +' servers',
            url:'https://bots.discord.pw/bots/240537940378386442'
        }
    });

    const options = {
        url: 'https://bots.discord.pw/api/bots/240537940378386442/stats',
        method: 'POST',
        headers: {'Authorization': process.env.BOT_TOKEN},
        body: {"server_count": bot.guilds.size || 0},
        json: true
    };
    if(process.env.BOT_TOKEN) {
        request(options, (err) => {
            if (err) log.error('Error sending stats', err);
            else log.info('Updated bot stats');
        });
    }
};
