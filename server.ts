import { Client } from "discordx";
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'loda... Remove this comment to see the full error message
import * as  _ from "lodash";
const utils = require("./utils");

const log = utils.getLogger('bot');
log.info(`booting up...`);

// basic server stuff, modules to load
const commandChar = process.env.COMMAND_CHAR || "!";
const spamTimeout = 3000; // milliseconds

// initialize the bot and all modules
const bot = new Discord.Client({
    shardList: 'auto' ,
    shards: 'auto' ,
    messageCacheMaxSize: 100,
    messageCacheLifetime: 60 * 10,
    messageSweepInterval: 90,
    disabledEvents: [
        'GUILD_UPDATE',
        'GUILD_MEMBER_ADD',
        'GUILD_MEMBER_REMOVE',
        'GUILD_MEMBER_UPDATE',
        'GUILD_MEMBERS_CHUNK',
        'GUILD_ROLE_CREATE',
        'GUILD_ROLE_DELETE',
        'GUILD_ROLE_UPDATE',
        'GUILD_BAN_ADD',
        'GUILD_BAN_REMOVE',
        'GUILD_EMOJIS_UPDATE',
        'GUILD_INTEGRATIONS_UPDATE',
        'CHANNEL_DELETE',
        'CHANNEL_UPDATE',
        'CHANNEL_PINS_UPDATE',
        'MESSAGE_DELETE',
        'MESSAGE_UPDATE',
        'MESSAGE_DELETE_BULK',
        'USER_UPDATE',
        'PRESENCE_UPDATE',
        'TYPING_START',
        'VOICE_STATE_UPDATE',
        'VOICE_SERVER_UPDATE',
        'WEBHOOKS_UPDATE',
    ]
});
const handlers = {};
const commands = {};
// Interactions, ie slash commands
// This maps slash command names to handler functions
const interactionLookup = {};

utils.modules.forEach((module: any, index: any) => {
    // eslint-disable-line global-require
    const moduleObject = new (require("./modules/" + module + '.js'))(utils.modules);
    if(moduleObject) {
        log.info("Successfully initialized module", module);
        utils.modules[index] = moduleObject;
        _.forEach(moduleObject.getCommands(), (commandObj: any, command: any) => {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            handlers[command] = moduleObject;
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            commands[command] = commandObj;
            // map aliases to handlers as well
            if (commandObj.aliases) {
                commandObj.aliases.forEach((alias: any) => {
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    handlers[alias] = moduleObject;
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    commands[alias] = commandObj;
                });
            }
        });

        if (moduleObject.hasOwnProperty("getInteractions")){
            _.forEach(moduleObject, (value: any, key: any) => {
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                interactionLookup[key] = value.response
                // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'interactionDetails'.
                interactionDetails.push(value.parser.toJSON())
            });
        }
    } else {
        log.error("Couldn't initialize module", module);
    }
});

// remember timestamps for last message per user
const userMessageTimes = {};

// generate RegExp pattern for message parsing
// Example: ((^|\s)!(card|price|mtr)|^!(hangman|standard|jar|help))( .*?)?(![^a-z0-9]|$)
const charPattern = _.escapeRegExp(commandChar);
// split inline and non-inline commands into 2 patterns
const commandPattern = '(^|\\s)' + charPattern + '(' +
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    Object.keys(commands).filter(cmd => commands[cmd].inline).map(_.escapeRegExp).join('|')
    + ')|^' + charPattern + '(' +
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    Object.keys(commands).filter(cmd => !commands[cmd].inline).map(_.escapeRegExp).join('|')
    + ')';
const regExpPattern = `(${commandPattern})( .*?)?(${charPattern}[^a-z0-9]|$)`;
const regExpObject = new RegExp(regExpPattern, 'ig');

/* Handle incoming messages */
bot.on("message", (msg: any) => {
    const queries = msg.content.match(regExpObject);
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const lastMessage = userMessageTimes[msg.author.id] || 0;

    // if the message mentions us, log it
    if (!msg.author.bot && // don't log if a bot mentions us
        (msg.content.toLowerCase().indexOf(bot.user.username.toLowerCase()) > -1 ||
            msg.mentions.users.has(bot.user.id))) {
        log.info(utils.prettyLog(msg, 'mention', msg.content));
    }

    // check if the message...
    if (queries && // ...contains at least one command
        !msg.author.bot && // ...is not from a bot
        (!msg.guild || msg.guild.id !== '110373943822540800') && // ...is not from a blacklisted server
        new Date().getTime() - lastMessage >= spamTimeout) // ...is outside the spam threshold
    {
        // store the time to prevent spamming from this user
        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        userMessageTimes[msg.author.id] = new Date().getTime();

        // only use the first 3 commands in a message, ignore the rest
        queries.slice(0, 3).forEach((query: any) => {
            const command = query.trim().split(" ")[0].substr(commandChar.length).toLowerCase();
            const parameter = query.trim().split(" ").slice(1).join(" ").replace(new RegExp(charPattern + '[^a-z0-9]?$', 'i'), '');

            log.info(utils.prettyLog(msg, 'query', (command+' '+parameter).trim()));
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            const ret = handlers[command].handleMessage(command, parameter, msg);
            // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
            Promise.resolve(ret).catch(e => log.error('An error occured while handling', msg.content, ":", e.message));
        });
    }
});

bot.on('interactionCreate', (interaction: any) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName in interactionLookup){
        // Pass the interaction to each handler function
        // See full API here: https://discord.js.org/#/docs/main/stable/class/CommandInteraction
        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        interactionLookup[interaction.commandName](interaction)
    }
});

/* Bot event listeners */
bot.on('ready', () => {
    log.info('Bot is ready! Username:', bot.user.username, '/ Servers:', bot.guilds.cache.size );
    utils.updateServerCount(bot);
});

bot.on('guildCreate', (guild: any) => {
    log.info(utils.prettyLog({guild}, "joined"));
    utils.updateServerCount(bot);
});

bot.on('guildDelete', (guild: any) => {
    log.info(utils.prettyLog({guild}, "left"));
    utils.updateServerCount(bot);
});

bot.on('error', (error: any) => {
    log.error('client error received');
    log.error(error);
    console.log(error);
});

// bot.on("debug",console.debug);

// start the engines!
try {
    bot.login(process.env.DISCORD_TOKEN);
} catch(err) {
    log.error(err);
}
