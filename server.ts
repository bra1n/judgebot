import { Client } from "discordx";
import {Interaction, Message, Options, Intents} from "discord.js";
import * as utils from "./utils.js";
import { dirname, importx } from "@discordx/importer";

const log = utils.getLogger('bot');
log.info(`booting up...`);

// initialize the bot and all modules
const bot = new Client({
    shards: 'auto' ,
    makeCache: Options.cacheWithLimits({
        ...Options.defaultMakeCacheSettings,
        MessageManager: 100
    }),
    messageCacheLifetime: 60 * 10,
    messageSweepInterval: 90,
    intents: [
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILDS
    ],
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
    await bot.initApplicationPermissions();
      log.info('Bot is ready! Username:', bot.user?.username, '/ Servers:', bot.guilds.cache.size );
      utils.updateServerCount(bot);
  });

// bot.on("debug",console.debug);

// start the engines!
if (utils.token){
    await importx(dirname(import.meta.url) + "/modules/*.js");
    await bot.login(utils.token);
}
else {
    log.error("No token provided")
}
