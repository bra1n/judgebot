import { Client } from "discordx";
import {Interaction, Message, Options, GatewayIntentBits, Partials} from "discord.js";
import * as utils from "./utils.js";
import { dirname, importx } from "@discordx/importer";

const log = utils.getLogger('bot');
log.info(`booting up...`);

// initialize the bot and all modules
const bot = new Client({
    shards: 'auto' ,
    makeCache: Options.cacheWithLimits({
        MessageManager: {
            maxSize: 100, 
        },
    }),
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.Guilds
    ],
    partials: [ Partials.Message, Partials.Channel, Partials.Reaction ],
    botGuilds: process.env.DEV_GUILD ? [process.env?.DEV_GUILD] : undefined
});
bot.on("interactionCreate", (interaction: Interaction) => {
  bot.executeInteraction(interaction);
});

/* Bot event listeners */
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

  bot.once("ready", async () => {
    await bot.initApplicationCommands();
      log.info('Bot is ready! Username:', bot.user?.username, '/ Servers:', bot.guilds.cache.size );
      utils.updateServerCount(bot);
  });


// start the engines!
if (utils.token){
    await importx(dirname(import.meta.url) + "/modules/*.js");
    await bot.login(utils.token);
}
else {
    log.error("No token provided")
}
