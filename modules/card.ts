import {
    ButtonInteraction,
    CommandInteraction,
    Message,
    MessageActionRowComponentResolvable,
    MessageOptions,
    MessageReaction,
    ButtonBuilder,
    MessageComponentBuilder,
    ComponentType,
    ApplicationCommandOptionType,
    ApplicationCommandOptionBase,
    ButtonStyle,
    ActionRowBuilder,
    AnyComponentBuilder,
    EmbedBuilder

} from "discord.js";
import { Discord, Slash, SlashOption, SlashOptionOptions } from "discordx";
import * as cheerio from "cheerio";
import fetch from 'node-fetch';
import _ from "lodash";
import * as utils from "../utils.js";
import * as Scry from "scryfall-sdk";

const log = utils.getLogger('card');

const scryfallSearchOption: {
    type: ApplicationCommandOptionType.String,
    description: string
} = {
    type: ApplicationCommandOptionType.String,
    description: "Scryfall search term",
};

interface JudgebotCard extends Scry.Card {
    zoom?: boolean;
}

@Discord()
export default class MtgCardLoader {

    static cardApi = "https://api.scryfall.com/cards/search?q=";
    static cardApiFuzzy = "https://api.scryfall.com/cards/named?fuzzy=";
    // Discord bots can use custom emojis globally, so we just reference these Manamoji through their code / ID
    // (currently hosted on the Judgebot testing discord)
    // @see https://github.com/scryfall/thopter/tree/master/manamoji
    static manamojis: Record<string, string> = {
        "0": "0_:344491158384410625",
        "1": "1_:344491158723887107",
        "10": "10:344491160280104984",
        "11": "11:344491159965401088",
        "12": "12:344491160435163137",
        "13": "13:344491160674238464",
        "14": "14:344491160619712513",
        "15": "15:344491160586289154",
        "16": "16:344491160808587264",
        "17": "17:344491160468979714",
        "18": "18:344491160720506880",
        "19": "19:344491160498208771",
        "2": "2_:344491158371696641",
        "20": "20:344491161257246720",
        "2b": "2b:344491158665429012",
        "2g": "2g:344491159189585921",
        "2r": "2r:344491159265083392",
        "2u": "2u:344491159160225792",
        "2w": "2w:344491159692771328",
        "3": "3_:344491159210688522",
        "4": "4_:344491159172677632",
        "5": "5_:344491158883532801",
        "6": "6_:344491159185260554",
        "7": "7_:344491159021813761",
        "8": "8_:344491159424466945",
        "9": "9_:344491159273472020",
        "b": "b_:608749298682822692",
        "bg": "bg:344491161286737921",
        "bp": "bp:608749299135807508",
        "br": "br:344491161362366465",
        "c": "c_:344491160636489739",
        "chaos": "chaos:344491160267653130",
        "e": "e_:344491160829558794",
        "g": "g_:344491161169428481",
        "gp": "gp:344491161102319616",
        "gu": "gu:344491161223692300",
        "gw": "gw:344491161139937282",
        "half": "half:344491161164972032",
        "hr": "hr:344491160787615748",
        "hw": "hw:344491161181749268",
        "infinity": "infinity:344491160619843593",
        "q": "q_:344491161060245504",
        "r": "r_:344491161274023938",
        "rg": "rg:344491161295257600",
        "rp": "rp:344491161076891648",
        "rw": "rw:344491161316098049",
        "s": "s_:343519207608025090",
        "t": "t_:344491161089736704",
        "u": "u_:344491161362235394",
        "ub": "ub:344491161248858113",
        "up": "up:344491161395789824",
        "ur": "ur:608749298896863297",
        "w": "w_:608749298896863266",
        "wb": "wb:344491161374818304",
        "wp": "wp:608749298544410641",
        "wu": "wu:608749299135807512",
        "x": "x_:344491161345327126",
        "y": "y_:344491161374818305",
        "z": "z_:344491161035210755"
    };
    // embed border colors depending on card color(s)
    static colors: Record<string, number> = {
        "W": 0xF8F6D8,
        "U": 0xC1D7E9,
        "B": 0x0D0F0F,
        "R": 0xE49977,
        "G": 0xA3C095,
        "GOLD": 0xE0C96C,
        "ARTIFACT": 0x90ADBB,
        "LAND": 0xAA8F84,
        "NONE": 0xDAD9DE
    };

    @Slash({
        name: "card",
        description: `Search for an English Magic card by (partial) name, supports full Scryfall syntax`,
    })
    async card(
        @SlashOption({ name: "search", ...scryfallSearchOption })
        search: string,
        interaction: CommandInteraction
    ) {
        await this.handleInteraction(
            "card",
            search,
            interaction
        )
    }

    @Slash({
        name: "price",
        description: "Show the price in USD, EUR and TIX for a card"
    })
    async price(
        @SlashOption({ name: "search", ...scryfallSearchOption })
        search: string,
        interaction: CommandInteraction
    ) {
        await this.handleInteraction(
            "price",
            search,
            interaction
        )
    }

    @Slash({
        name: "ruling",
        description: "Show the Gatherer rulings for a card"
    })
    async ruling(
        @SlashOption({ name: "search", ...scryfallSearchOption })
        search: string,
        interaction: CommandInteraction
    ) {
        await this.handleInteraction(
            "ruling",
            search,
            interaction
        )
    }

    @Slash({
        name: "legal",
        description: "Show the format legality for a card",
    })
    async legal(
        @SlashOption({ name: "search", ...scryfallSearchOption })
        search: string,
        interaction: CommandInteraction
    ) {
        await this.handleInteraction(
            "legal",
            search,
            interaction
        )
    }

    @Slash({
        name: "art",
        description: "Show just the art for a card"
    })
    async art(
        @SlashOption({ name: "search", ...scryfallSearchOption })
        search: string,
        interaction: CommandInteraction
    ) {
        await this.handleInteraction(
            "art",
            search,
            interaction
        )
    }

    // replace mana and other symbols with actual emojis
    renderEmojis(text: string) {
        return text.replace(/{[^}]+?}/ig, (match) => {
            const code = match.replace(/[^a-z0-9]/ig, '').toLowerCase();
            return MtgCardLoader.manamojis[code] ? `<:${MtgCardLoader.manamojis[code]}>` : '';
        });
    }

    // determine embed border color
    getBorderColor(card: Scry.Card | Scry.CardFace) {
        let color;
        if (!card.colors || card.colors.length === 0) {
            color = MtgCardLoader.colors.NONE;
            if (card.type_line && card.type_line.match(/artifact/i)) color = MtgCardLoader.colors.ARTIFACT;
            if (card.type_line && card.type_line.match(/land/i)) color = MtgCardLoader.colors.LAND;
        } else if (card.colors.length > 1) {
            color = MtgCardLoader.colors.GOLD;
        } else {
            color = MtgCardLoader.colors[card.colors[0]];
        }
        return color;
    }

    // generate description text from a card object
    generateDescriptionText(card: Scry.Card) {
        const ptToString = (card: Scry.CardFace | Scry.Card) => `**${card.power?.replace(/\*/g, '\\*')}/${card.toughness?.replace(/\*/g, '\\*')}**`;

        const description: string[] = [];

        card.card_faces.forEach((face: Scry.CardFace, index) => {
            if (face.type_line) { // bold type line
                let type = `**${face.printed_type_line || face.type_line}** `;
                if (index == 0){
                    // Only show rarity, language etc for first face
                    type += `(${card.set.toUpperCase()} ${_.capitalize(card.rarity)}`;
                    type += `${card.lang && card.lang !== 'en' ? ' :flag_' + card.lang + ':' : ''})`;
                }
                description.push(type);
            }
            if (face.oracle_text) { // reminder text in italics
                const text = face.printed_text || face.oracle_text;
                description.push(text.replace(/[()]/g, (m: string) => m === '(' ? '*(' : ')*'));
            }
            if (face.flavor_text) { // flavor text in italics
                description.push('*' + face.flavor_text + '*');
            }
            if (face.loyalty) { // bold loyalty
                description.push('**Loyalty: ' + face.loyalty + '**');
            }
            if (face.power) { // bold P/T
                description.push(ptToString(face));
            }
        });
        return description.join('\n');
    }

    // generate the embed card
    async generateResponse(cards: JudgebotCard[], command: string, hasEmojiPermission: boolean) {
        const card = cards[0];

        // generate embed title and description text
        // use printed name (=translated) over English name, if available
        let title = card.printed_name || card.name;

        if (card.mana_cost) {
            title += ' ' + card.mana_cost;
        }

        // DFC use card_faces array for each face
        // @ts-ignore: https://github.com/ChiriVulpes/scryfall-sdk/pull/42
        if (card.card_faces && (card.layout === 'transform' || card.layout === 'modal_dfc')) {
            if (card.card_faces[0].mana_cost) {
                title += ' ' + card.card_faces[0].mana_cost;
            }
            // Modal DFCs might have spells on both sides at some point so putting this here just in case
            // @ts-ignore: https://github.com/ChiriVulpes/scryfall-sdk/pull/42
            if (card.layout === 'modal_dfc' && card.card_faces[1].mana_cost) {
                title += ' // ' + card.card_faces[1].mana_cost;
            }
            card.image_uris = card.card_faces[0].image_uris;
        }

        let description = this.generateDescriptionText(card);

        // are we allowed to use custom emojis? cool, then do so, but make sure the title still fits
        if (hasEmojiPermission) {
            title = _.truncate(this.renderEmojis(title), { length: 256, separator: '<' });
            description = this.renderEmojis(description);
        }

        // footer
        let footer = "";
        if (cards.length > 1) {
            footer = (cards.length - 1) + ' other hits:\n';
            footer += cards.slice(1, 6).map((cardObj: JudgebotCard) => cardObj.printed_name || cardObj.name).join('; ');
            if (cards.length > 6) footer += '; ...';
        }

        // instantiate embed object
        const embed = new EmbedBuilder({
            title,
            description,
            footer: { text: footer },
            url: card.scryfall_uri,
            color: this.getBorderColor(card.layout === 'transform' || card.layout === 'modal_dfc' ? card.card_faces[0] : card),
            thumbnail: card.image_uris ? { url: card.image_uris.small } : undefined,
            image: card.zoom && card.image_uris ? { url: card.image_uris.normal } : undefined
        })
        // show crop art only
        if (command.match(/^art/) && card.image_uris) {
            embed.setImage(card.image_uris.art_crop);
            embed.setThumbnail(null);
            embed.setDescription('🖌️ ' + card.artist);
        }

        // Remove thumbnail if we zoom
        if (card.zoom) {
            embed.setThumbnail(null);
        }

        // add pricing, if requested
        if (command.match(/^price/) && card.prices) {
            embed.setDescription(null);
            let prices = [];
            if (card.prices.usd) prices.push('$' + card.prices.usd);
            if (card.prices.usd_foil) prices.push('**Foil** $' + card.prices.usd_foil);
            if (card.prices.eur) prices.push(card.prices.eur + '€');
            if (card.prices.tix) prices.push(card.prices.tix + ' Tix');
            embed.addFields({
                name: "Prices",
                value: prices.join(' / ') || 'No prices found'
            });
        }

        // add legalities, if requested
        if (command.match(/^legal/)) {
            const legalities = (_.invertBy(card.legalities).legal || []).map(_.capitalize).join(', ');
            embed.addFields({ name: 'Legal in', value: legalities || 'Nowhere' });
        }

        // add rulings loaded from Gatherer, if needed
        if (command.match(/^ruling/) && card.related_uris.gatherer) {
            const rulings = card.getRulings();
            embed.setAuthor({ name: 'Gatherer rulings for' });
            embed.setDescription((await rulings).map(ruling => "• " + ruling.comment).join("\n"));
        }

        const components: ButtonBuilder[] = [];
        if (cards.length > 1) {
            components.push(
                new ButtonBuilder().setLabel('⬅').setStyle(ButtonStyle.Secondary).setCustomId("left")
            )
            components.push(
                new ButtonBuilder().setLabel('➡').setStyle(ButtonStyle.Secondary).setCustomId("right")
            );
        }

        // add reactions for zoom
        if (command !== "art") {
            components.push(new ButtonBuilder().setLabel("🔍").setStyle(ButtonStyle.Secondary).setCustomId('zoom'))
        }

        return {
            embeds: [embed],
            components: components.length > 0 ? [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    components
                )
            ] : undefined
        }
    }

    /**
     * Fetch the cards from Scryfall
     */
    async getCards(cardName: string): Promise<Scry.Card[]> {
        let cards = await Scry.Cards.search(cardName, { include_extras: true }).cancelAfterPage().waitForAll();
        if (cards.length > 0) {
            // sort the cards to better match the search query (issue #87)
            return cards.sort((a, b) => this.scoreHit(b, cardName) - this.scoreHit(a, cardName));
        } else {
            log.info('Falling back to fuzzy search for ' + cardName);
            // Specific handling for https://github.com/ChiriVulpes/scryfall-sdk/issues/45
            let fuzzy = await Scry.Cards.byName(cardName, true);
            if ('name' in fuzzy) {
                return [fuzzy];
            }
            else {
                return [];
            }
        }
    }

    /**
     * Calculate the hit score for a card and a search query
     * @param card
     * @param query
     */
    scoreHit(card: Scry.Card, query: string) {
        const name = (card.printed_name || card.name).toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameQuery = query.split(" ").filter((q) => !q.match(/[=:()><]/)).join(" ").toLowerCase().replace(/[^a-z0-9]/g, '');
        let score = 0;
        if (name === nameQuery) {
            // exact match - to the top!
            score = 10000;
        } else if (name.match(new RegExp('^' + nameQuery))) {
            // match starts at the beginning of the name
            score = 1000 * nameQuery.length / name.length;
        } else {
            // match anywhere but the beginning
            score = 100 * nameQuery.length / name.length;
        }
        return score;
    }

    /**
     * Handles a generic command ie either a message or an interaction
     * @param command "card", "art" etc
     * @param parameter Scryfall search term
     * @param interaction The interaction to respond to
     */
    async handleInteraction(command: string, parameter: string, interaction: CommandInteraction) {
        await interaction.deferReply();
        const cardName = parameter.toLowerCase();
        // no card name, no lookup
        if (!cardName) return;
        const permission = true; // assume we have custom emoji permission for now
        // fetch data from API
        const cards: JudgebotCard[] = await this.getCards(cardName);
        // check if there are results
        if (cards.length > 0) {
            // generate embed
            const msg = await this.generateResponse(cards, command, permission);
            const sentMessage = await interaction.editReply({
                ...msg,
            });

            const handleReaction = async (buttonReaction: ButtonInteraction) => {
                await buttonReaction.deferUpdate();
                if (buttonReaction.user.id === interaction.user.id) {
                    // Only allow the person who ran this command to control the embed
                    // We can't use the filter() on the collector because the discord will hate us
                    if (buttonReaction.customId === 'left') {
                        cards.unshift(<Scry.Card>cards.pop());
                    } else if (buttonReaction.customId === 'right') {
                        cards.push(<Scry.Card>cards.shift());
                    } else if (buttonReaction.customId === 'zoom') {
                        // toggle zoom
                        cards[0].zoom = !cards[0].zoom;
                    }
                    // edit the message to update the current card
                    const resp = await this.generateResponse(cards, command, permission);
                    await buttonReaction.editReply(resp);
                }
            }

            if (sentMessage instanceof Message) {
                sentMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000,
                    max: 20
                }
                ).on('collect', handleReaction).on('remove', handleReaction);
            }
        } else {
            let description = 'No cards matched `' + cardName + '`.';
            return interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('Error').setDescription(description).setColor(0xff0000)]
            });
        }
    }
}

