const Discord = require("discord.js");
const bot = new Discord.Client();
const mtrAggregator = new require("./aggregators/rules/mtr.js");
const ipgAggregator = new require("./aggregators/rules/ipg.js");
const crAggregator = new require("./aggregators/rules/cr.js");
const jarAggregator = new require("./aggregators/rules/jar.js");
const cardAggregator = new require("./aggregators/mtg_cards/cards.js");

const mtr = "!mtr";
const ipg = "!ipg";
const cr = "!cr";
const jar = "!jar";
const card = "!card";
const help = "!help";

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
    switch (command) {
        case mtr:
            new mtrAggregator().getContent(parameter, respondToMsg);
            break;
        case ipg:
            new ipgAggregator().getContent(parameter, respondToMsg);
            break;
        case cr:
            new crAggregator().getContent(parameter, respondToMsg);
            break;
        case jar:
            new jarAggregator().getContent(parameter, respondToMsg);
            break;
        case card:
            new cardAggregator().getContent(parameter, respondToMsg);
            break;
        case help:
            //todo
            break;
    }
    function respondToMsg(response) {
        if (response) {
            msg.channel.sendMessage(response);
        }
    }
});

bot.on('ready', () => {
    console.log('I am ready!', bot.user.username);
});

bot.login(process.env.DISCORD_TOKEN);
