var Discord = require("discord.js");
var bot = new Discord.Client();
var request = require("request");

var cardApi = "https://api.magicthegathering.io/v1/cards?name=";

bot.on("message", msg => {
	if(bot.user.id == msg.author.id) return;
	var query = "";
    if (query = msg.content.match(/^!([a-z0-9].+)/i)) {
		query = encodeURIComponent(query[1]);
		request({
  		  url: cardApi + query,
		  json: true
		}, (error, response, body) => {
			if (!error && response.statusCode === 200 && body.cards && body.cards.length) {
				var card = body.cards[0];
				var response = ["**"+card.name+"**"];
				response.push(card.type);
				response.push(card.text.replace(/\*/g,'\\*'));
				if(card.loyalty) response.push(card.loyalty);
				if(card.power) response.push(card.power.replace(/\*/g,'\\*') + "/" + card.toughness.replace(/\*/g,'\\*'));
				response.push(card.printings.join(", "));
				response.push("http://magiccards.info/query?q=!"+encodeURIComponent(card.name));
				if(card.imageUrl) response.push(card.imageUrl);
				msg.channel.sendMessage(response.join("\n"));
		    }
		});
    }
});

bot.on('ready', () => {
  console.log('I am ready!', bot.user.username);
});

bot.login(process.env.DISCORD_TOKEN);
