const Discord = require('discord.js');
const utils = require("./utils");
const log = utils.getLogger('master');
const Manager = new Discord.ShardingManager('./server.js', {
    token: process.env.DISCORD_TOKEN
});
log.info('spawning shards...')
Manager.spawn();