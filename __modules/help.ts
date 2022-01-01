// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable '_'.
const _ = require('lodash');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Discord'.
const Discord = require('discord.js');

class Help {
    commands: any;
    location: any;
    modules: any;
    constructor(modules: any) {
        this.commands = {
            help: {
                aliases: [],
                inline: false,
                description: "Show this help text",
                help: 'This command allows you to explore the different functions and ' +
                    'features of your beloved judgebot. You can look up detailed descriptions ' +
                    'for a command by using `!help <command>`, like `!help card`.',
                examples: ["!help", "!help card"]
            }
        };
        this.location = 'https://github.com/bra1n/judgebot';
        this.modules = modules;
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command: any, parameter: any, msg: any) {
        let param = parameter.trim().toLowerCase().split(" ")[0];

        const embed = new Discord.MessageEmbed({
            title: 'List of available commands',
            // thumbnail: {url: this.thumbnail},
            url: this.location
        });

        const commands = {};
        this.modules.forEach((module: any) => {
            _.forEach(module.getCommands(), (commandObj: any, command: any) => {
                commandObj.name = command;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                commands[command] = commandObj;
                commandObj.aliases.forEach((alias: any) => {
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    commands[alias] = commandObj;
                });
            })
        })

        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (parameter && commands[parameter]) {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            embed.setTitle('Command "!'+commands[parameter].name+'"');
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            embed.setDescription(commands[parameter].help);
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            embed.addField('Examples', '`' + commands[parameter].examples.join('`\n`') + '`', true)
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            if (commands[parameter].aliases && commands[parameter].aliases.length) {
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                embed.addField('Aliases', '`!' + commands[parameter].aliases.join('`\n`!') + '`', true);
            }
        } else {
            let description = '';
            _.forEach(commands, (commandObj: any, command: any) => {
                if (command !== commandObj.name) return;
                description += ':small_blue_diamond: **!'+command+'**  '+commandObj.description+'\n';
            });
            embed.setDescription(description+'\n To learn more about a command, use `!help <command>`');
            embed.addField('Add judgebot to your Discord', 'This bot is provided free of charge and can be added to your server, too!\n :link: https://bots.discord.pw/bots/240537940378386442');
            embed.addField('Judgebot Source Code', ':link: https://github.com/bra1n/judgebot');
        }

        return msg.author.send('', {embed});
    }
}
module.exports = Help;
