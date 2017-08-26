const Discord = require("discord.js");
const _ = require("lodash");
const colors = require("colors");
const utils = require("./utils");

const log = utils.getLogger('bot');

// basic server stuff, modules to load
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

// initialize the bot and all modules
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
const regExpPattern = `(\\s|^)${commandPattern}( .*?)?(${charPattern}[^a-z0-9]|$)`;
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
            log.info(utils.prettyLog(msg, 'mention', msg.content));
        }
        return;
    }

    // store the time to prevent spamming from this user
    userMessageTimes[msg.author.id] = new Date().getTime();

    // only use the first 3 commands in a message, ignore the rest
    queries.slice(0,3).forEach(query => {
        const command = query.trim().split(" ")[0].substr(commandChar.length).toLowerCase();
        const parameter = query.trim().split(" ").slice(1).join(" ").replace(new RegExp(charPattern+'$', 'i'),'');

        log.info(utils.prettyLog(msg, 'query', query.trim()));
        const ret = handlers[command].handleMessage(command, parameter, msg);
        // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
        Promise.resolve(ret).catch(e => log.error('An error occured while handling', msg.content, ":", e.message));
    })
});

/* Bot event listeners */
bot.on('ready', () => {
    log.info('Bot is ready! Username:', bot.user.username, '/ Servers:', bot.guilds.size );
    utils.updateServerCount(bot);
});

bot.on('guildCreate', (guild) => {
    log.info(`[${guild.name}]`.blue + '[joined]'.magenta);
    utils.updateServerCount(bot);
});

bot.on('guildDelete', (guild) => {
    log.info(`[${guild.name}]`.blue + '[left]'.magenta);
    utils.updateServerCount(bot);
});

// start the engines!
bot.login(process.env.DISCORD_TOKEN);