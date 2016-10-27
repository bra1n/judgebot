var Discord = require("discord.js");
var bot = new Discord.Client();

var mtrAggregator = new (require("./aggregators/rules/mtr.js"))();
var ipgAggregator = new (require("./aggregators/rules/ipg.js"))();
var crAggregator = new (require("./aggregators/rules/cr.js"))();
var jarAggregator = new (require("./aggregators/rules/jar.js"))();
var cardAggregator = new (require("./aggregators/mtg_cards/cards.js"))();

var handlers = {
	"!mtr": mtrAggregator.getContent,
	"!ipg": ipgAggregator.getContent,
	"!cr": crAggregator.getContent,
	"!define": crAggregator.getGlossaryEntry,
	"!jar": jarAggregator.getContent,
	"!card": cardAggregator.getContent,
}

/**
 * @param msg.channel.sendMessage
 */
bot.on("message", msg => {
	if(bot.user.id === msg.author.id) {return;}
	const query = msg.content.split(" ");
	const command = query[0].toLowerCase();
	const parameter = query.length > 1 ? query.slice(1).join(" ") : "";
	let handler = handlers[command];
	if (handler) {
		handler(parameter, respondToMsg);
	}

	function respondToMsg(response) {
        if(response){
            msg.channel.sendMessage(response);
        }
	}
});

bot.on('ready', () => {
  console.log('I am ready!', bot.user.username);
});

bot.login(process.env.DISCORD_TOKEN);
