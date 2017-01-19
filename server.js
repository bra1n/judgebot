const Discord = require("discord.js");
const colors = require('colors');
const request = require("request");
const log = require("log4js").getLogger('bot');
log.setLevel(process.env.LOG_LEVEL || "INFO");

const commandChar = process.env.COMMAND_CHAR || "!";
const spamTimeout = 3000; // milliseconds
const modules = [
    'rules/mtr',
    'rules/ipg',
    'rules/cr',
    'rules/jar',
    'card',
    'help'
];

const bot = new Discord.Client();
const handlers = {};
modules.forEach(module => {
    const moduleObject = new (require("./modules/" + module + '.js'))();
    if(moduleObject) {
        log.info("Successfully initialized module", module.green);
        moduleObject.getCommands().forEach(command => {
            handlers[command] = moduleObject;
        });
    } else {
        log.error("Couldn't initialize module", module.red);
    }
});

// remember timestamps for last message per user
const userMessageTimes = {};

/* Handle incoming messages */
bot.on("message", msg => {
    const query = msg.content.substr(commandChar.length).split(" ");
    const command = query[0].toLowerCase();
    const parameter = query.length > 1 ? query.slice(1).join(" ") : "";
    const lastMessage = userMessageTimes[msg.author.id] || 0;

    if (bot.user.id === msg.author.id || // don't message yourself
        msg.content.substr(0, commandChar.length) != commandChar || // not the right command char
        !handlers[command] || // no handler for this command
        new Date().getTime() - lastMessage < spamTimeout) { // too spammy
        return;
    }

    let logMessage = [
        '[' + (msg.guild ? msg.guild.name.blue : 'private query') + ']',
        msg.channel.name ? '[' + msg.channel.name + ']' : '',
        msg.author.username.blue + '#' + msg.author.discriminator.blue,
        'used', command.green, parameter.yellow
    ];
    log.info(logMessage.join(' '));
    userMessageTimes[msg.author.id] = new Date().getTime();
    const ret = handlers[command].handleMessage(command, parameter, msg);
    // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
    Promise.resolve(ret).catch(e => log.error('An error occured while handling', msg.content.green, ":\n", e));
});

/* Bot event listeners */
bot.on('ready', () => {
    bot.user.setGame('Magic: The Gathering');
    log.info('Bot is ready! Username:', bot.user.username.green, 'Servers:', (bot.guilds.size + '').blue);
    updateServerCount();
});

bot.on('guildCreate', (guild) => {
    log.info('I just joined a server:', guild.name.red);
    updateServerCount();
});

bot.on('guildDelete', (guild) => {
    log.info('I just left a server:', guild.name.red);
    updateServerCount();
});

bot.login(process.env.DISCORD_TOKEN);

const updateServerCount = () => {
    const options = {
        url: 'https://bots.discord.pw/api/bots/240537940378386442/stats',
        method: 'POST',
        headers: {
            'Authorization': process.env.BOT_TOKEN
        },
        body: {
            "server_count": bot.guilds.size || 0
        },
        json: true
    };
    if(process.env.BOT_TOKEN) {
        request(options, (err) => {
            if (err) log.error('Error sending stats', err);
            else log.info('Updated bot stats');
        });
    }
};
