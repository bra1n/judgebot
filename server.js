const Discord = require("discord.js");
const bot = new Discord.Client();
const mtrAggregator = new (require("./aggregators/rules/mtr.js"))();
const ipgAggregator = new (require("./aggregators/rules/ipg.js"))();
const crAggregator = new (require("./aggregators/rules/cr.js"))();
const jarAggregator = new (require("./aggregators/rules/jar.js"))();
const cardAggregator = new (require("./aggregators/mtg_cards/cards.js"))();

const handlers = {
    "!mtr": mtrAggregator,
    "!ipg": ipgAggregator,
    "!cr": crAggregator,
    "!define": crAggregator,
    "!jar": jarAggregator,
    "!card": cardAggregator,
};

/**
 * @param msg.channel.sendMessage
 */
bot.on("message", msg => {
    if (bot.user.id === msg.author.id) {
        return;
    }
    const query = msg.content.split(" ");
    const command = query[0].toLowerCase();
    const parameter = query.length > 1 ? query.slice(1).join(" ") : "";
    const handler = handlers[command];
    if (handler) {
        handler.getContent(command, parameter, respondToMsg);
    }
    function respondToMsg(response, attachment, filename) {
        if (attachment) {
            msg.channel.sendFile(attachment, filename, response);
        } else if (response) {
            msg.channel.sendMessage(response);
        }
    }
});

bot.on('ready', () => {
    console.log('I am ready!', bot.user.username);
});

bot.login(process.env.DISCORD_TOKEN);
