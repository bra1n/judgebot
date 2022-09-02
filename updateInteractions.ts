import _ from "lodash";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { getLogger, token } from "./utils.js";

export const modules = [
    'card',
    'hangman',
    'standard',
    // 'store',
    'cr',
    'ipg',
    'mtr',
    'jar',
];

const rest = new REST({ version: '9' }).setToken(token);

const log = getLogger('bot');
const interactions: any = [];
modules.forEach(async (moduleName, index) => {
    const module = await import("./modules/" + moduleName + '.js');
    const moduleObject = new module.default();
    if ("getInteractions" in moduleObject) {
        _.forEach(moduleObject.getInteractions(), (value: any, key: any) => {
            interactions.push(value.parser.toJSON())
        });
    }
});

try {
    log.info('Finding bot ID');
    const identity: any = await rest.get(
        Routes.user()
    )

    log.info('Started refreshing application (/) commands.');

    const updateResult = await rest.put(
        Routes.applicationCommands(identity.id),
        { body: interactions },
    );

    log.info('Successfully reloaded application (/) commands.');
} catch (error) {
    console.error(error);
}