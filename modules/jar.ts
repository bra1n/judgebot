import {CommandInteraction, MessageInteraction} from "discord.js";
import {Discord, Slash, SlashOption} from "discordx";

@Discord()
export default class JAR {
    static location = "https://blogs.magicjudges.org/rules/jar/";

    @Slash({
        name: "jar", 
        description: "Show the link to the Judging at Regular document (this feature is WIP)"
    })
    async jar(
        interaction: CommandInteraction
    ){
        await interaction.reply({
            content: `**Judging at Regular**: <${JAR.location}>`
        });
    }
}
