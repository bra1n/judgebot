const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");
const utils = require("../utils");
const log = utils.getLogger('card');
const cheerio = require("cheerio");
const { SlashCommandBuilder } = require('@discordjs/builders');

class MtgCardLoader {
    constructor() {
        this.commands = {
            card: {
                aliases: [],
                inline: true,
                description: "Search for an English Magic card by (partial) name, supports full Scryfall syntax",
                help: '',
                examples: ["!card iona", "!card t:creature o:flying", "!card goyf e:fut"]
            },
            price: {
                aliases: ["prices"],
                inline: true,
                description: "Show the price in USD, EUR and TIX for a card",
                help: '',
                examples: ["!price tarmogoyf"]
            },
            ruling: {
                aliases: ["rulings"],
                inline: true,
                description: "Show the Gatherer rulings for a card",
                help: '',
                examples: ["!ruling sylvan library"]
            },
            legal: {
                aliases: ["legality"],
                inline: true,
                description: "Show the format legality for a card",
                help: '',
                examples: ["!legal divining top"]
            },
            art: {
                aliases: [],
                inline: true,
                description: "Show just the art for a card",
                help: '',
                examples: ["!art lovisa coldeyes"]
            }
        };
        this.cardApi = "https://api.scryfall.com/cards/search?q=";
        this.cardApiFuzzy = "https://api.scryfall.com/cards/named?fuzzy=";
        // Discord bots can use custom emojis globally, so we just reference these Manamoji through their code / ID
        // (currently hosted on the Judgebot testing discord)
        // @see https://github.com/scryfall/thopter/tree/master/manamoji
        this.manamojis = {
            "0":"0_:344491158384410625",
            "1":"1_:344491158723887107",
            "10":"10:344491160280104984",
            "11":"11:344491159965401088",
            "12":"12:344491160435163137",
            "13":"13:344491160674238464",
            "14":"14:344491160619712513",
            "15":"15:344491160586289154",
            "16":"16:344491160808587264",
            "17":"17:344491160468979714",
            "18":"18:344491160720506880",
            "19":"19:344491160498208771",
            "2":"2_:344491158371696641",
            "20":"20:344491161257246720",
            "2b":"2b:344491158665429012",
            "2g":"2g:344491159189585921",
            "2r":"2r:344491159265083392",
            "2u":"2u:344491159160225792",
            "2w":"2w:344491159692771328",
            "3":"3_:344491159210688522",
            "4":"4_:344491159172677632",
            "5":"5_:344491158883532801",
            "6":"6_:344491159185260554",
            "7":"7_:344491159021813761",
            "8":"8_:344491159424466945",
            "9":"9_:344491159273472020",
            "b":"b_:608749298682822692",
            "bg":"bg:344491161286737921",
            "bp":"bp:608749299135807508",
            "br":"br:344491161362366465",
            "c":"c_:344491160636489739",
            "chaos":"chaos:344491160267653130",
            "e":"e_:344491160829558794",
            "g":"g_:344491161169428481",
            "gp":"gp:344491161102319616",
            "gu":"gu:344491161223692300",
            "gw":"gw:344491161139937282",
            "half":"half:344491161164972032",
            "hr":"hr:344491160787615748",
            "hw":"hw:344491161181749268",
            "infinity":"infinity:344491160619843593",
            "q":"q_:344491161060245504",
            "r":"r_:344491161274023938",
            "rg":"rg:344491161295257600",
            "rp":"rp:344491161076891648",
            "rw":"rw:344491161316098049",
            "s":"s_:343519207608025090",
            "t":"t_:344491161089736704",
            "u":"u_:344491161362235394",
            "ub":"ub:344491161248858113",
            "up":"up:344491161395789824",
            "ur":"ur:608749298896863297",
            "w":"w_:608749298896863266",
            "wb":"wb:344491161374818304",
            "wp":"wp:608749298544410641",
            "wu":"wu:608749299135807512",
            "x":"x_:344491161345327126",
            "y":"y_:344491161374818305",
            "z":"z_:344491161035210755"
        };
        // embed border colors depending on card color(s)
        this.colors = {
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
        // cache for Discord permission lookup
        this.permissionCache = {};
    }

    /**
     * Compile data about each interaction supported by this class
     */
    getInteractions() {
        // This is a common parameter used by all interactions
        const scryfallSearchTerm = option => option
            .setName("search_term")
            .setDescription("Scryfall search term")
            .setRequired(true);

        // Currently, we handle all interactions by just treating them like messages
        const handleInteraction = interaction => {
            this.handleCommand(
                "card",
                interaction.options.data.filter(option => option.name === 'search_term').value,
                interaction.channel,
                interaction.user
            )
        };

        // Returns a dictionary of dictionaries.
        // The outer dictionary is indexed by the command name.
        // The inner dictionary has parser, which returns the SlashCommandBuilder, and response, which is a function
        // for handling that interaction
        return {
            card: {
                parser: new SlashCommandBuilder()
                    .setName("card")
                    .setDescription("Search for an English Magic card by (partial) name, supports full Scryfall syntax")
                    .addStringOption(scryfallSearchTerm),
                response: handleInteraction
            },
            price: {
                parser: new SlashCommandBuilder()
                    .setName("price")
                    .setDescription("Show the price in USD, EUR and TIX for a card")
                    .addStringOption(scryfallSearchTerm),
                response: handleInteraction
            },
            rulings: {
             parser: new SlashCommandBuilder()
                     .setName("rulings")
                     .setDescription("Show the Gatherer rulings for a card")
                     .addStringOption(scryfallSearchTerm),
                response: handleInteraction
            },
            legality: {
                parser:
                    new SlashCommandBuilder()
                        .setName("legality")
                        .setDescription("Show the format legality for a card")
                        .addStringOption(scryfallSearchTerm),
                response: handleInteraction
            },
            art: {
                parser:
                    new SlashCommandBuilder()
                        .setName("art")
                        .setDescription("Show just the art for a card")
                        .addStringOption(scryfallSearchTerm),
                response: handleInteraction
            }
        }
    }

    getCommands() {
        return this.commands;
    }

    // replace mana and other symbols with actual emojis
    renderEmojis(text) {
        return text.replace(/{[^}]+?}/ig, match => {
            const code = match.replace(/[^a-z0-9]/ig,'').toLowerCase();
            return this.manamojis[code] ? '<:'+this.manamojis[code]+'>':'';
        });
    }

    // determine embed border color
    getBorderColor(card) {
        let color;
        if (!card.colors || card.colors.length === 0) {
            color = this.colors.NONE;
            if (card.type_line && card.type_line.match(/artifact/i)) color = this.colors.ARTIFACT;
            if (card.type_line && card.type_line.match(/land/i)) color = this.colors.LAND;
        } else if (card.colors.length > 1) {
            color = this.colors.GOLD;
        } else {
            color = this.colors[card.colors[0]];
        }
        return color;
    }

    // parse Gatherer rulings
    parseGathererRulings(gatherer) {
        const $ = cheerio.load(gatherer);
        const rulings = [];
        $('.rulingsTable tr').each((index,elem) => {
            rulings.push('**'+$(elem).find('td:nth-child(1)').text()+':** '+$(elem).find('td:nth-child(2)').text());
            if (rulings.join('\n').length > 2040) {
                rulings[rulings.length - 1] = '...';
                return false;
            }
        });
        return rulings.join('\n');
    }

    // generate description text from a card object
    generateDescriptionText(card) {
        const ptToString = (card) =>
            '**'+card.power.replace(/\*/g, '\\*') + "/" + card.toughness.replace(/\*/g, '\\*')+'**';

        const description = [];
        if (card.type_line) { // bold type line
            let type = `**${card.printed_type_line || card.type_line}** `;
            type += `(${card.set.toUpperCase()} ${_.capitalize(card.rarity)}`;
            type += `${card.lang && card.lang !== 'en' ? ' :flag_' + card.lang + ':':''})`;
            description.push(type);
        }
        if (card.oracle_text) { // reminder text in italics
            const text = card.printed_text || card.oracle_text;
            description.push(text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
        }
        if (card.flavor_text) { // flavor text in italics
            description.push('*' + card.flavor_text+'*');
        }
        if (card.loyalty) { // bold loyalty
            description.push('**Loyalty: ' + card.loyalty+'**');
        }
        if (card.power) { // bold P/T
            description.push(ptToString(card));
        }
        if (card.card_faces) {
            // split cards are special
            card.card_faces.forEach(face => {
                description.push('**'+face.type_line+'**');
                if (face.oracle_text) {
                    description.push(face.oracle_text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
                }
                if (face.power) {
                    description.push(ptToString(face));
                }
                description.push('');
            });
        }
        return description.join('\n');
    }

    // generate the embed card
    generateEmbed(cards, command, hasEmojiPermission) {
        return new Promise(resolve => {
            const card = cards[0];

            // generate embed title and description text
            // use printed name (=translated) over English name, if available
            let title = card.printed_name || card.name;

            if (card.mana_cost) {
                title += ' ' + card.mana_cost;
            }

            // DFC use card_faces array for each face
            if (card.card_faces && (card.layout === 'transform' || card.layout === 'modal_dfc')) {
                if (card.card_faces[0].mana_cost) {
                    title += ' ' + card.card_faces[0].mana_cost;
                }
                // Modal DFCs might have spells on both sides at some point so putting this here just in case
                if (card.layout === 'modal_dfc' && card.card_faces[1].mana_cost) {
                    title += ' // ' + card.card_faces[1].mana_cost;
                }
                card.image_uris = card.card_faces[0].image_uris;
            }

            let description = this.generateDescriptionText(card);

            // are we allowed to use custom emojis? cool, then do so, but make sure the title still fits
            if(hasEmojiPermission) {
                title = _.truncate(this.renderEmojis(title), {length: 256, separator: '<'});
                description = this.renderEmojis(description);
            }

            // footer
            let footer = "Use !help to get a list of available commands.";
            if(cards.length > 1) {
                footer = (cards.length - 1) + ' other hits:\n';
                footer += cards.slice(1,6).map(cardObj => (cardObj.printed_name || cardObj.name)).join('; ');
                if (cards.length > 6) footer += '; ...';
            }

            // instantiate embed object
            const embed = new Discord.MessageEmbed({
                title,
                description,
                footer: {text: footer},
                url: card.scryfall_uri,
                color: this.getBorderColor(card.layout === 'transform' || card.layout === 'modal_dfc' ? card.card_faces[0]:card),
                thumbnail: card.image_uris ? {url: card.image_uris.small} : null,
                image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
            });

            // show crop art only
            if (command.match(/^art/) && card.image_uris) {
                embed.setImage(card.image_uris.art_crop);
                embed.setDescription('🖌️ ' + card.artist);
                embed.setThumbnail(null);
            }

            // add pricing, if requested
            if (command.match(/^price/) && card.prices) {
                let prices = [];
                if(card.prices.usd) prices.push('$' + card.prices.usd);
                if(card.prices.usd_foil) prices.push('**Foil** $' + card.prices.usd_foil);
                if(card.prices.eur) prices.push(card.prices.eur + '€');
                if(card.prices.tix) prices.push(card.prices.tix + ' Tix');
                embed.addField('Prices', prices.join(' / ') || 'No prices found');
            }

            // add legalities, if requested
            if (command.match(/^legal/)) {
                const legalities = (_.invertBy(card.legalities).legal || []).map(_.capitalize).join(', ');
                embed.addField('Legal in', legalities || 'Nowhere');
            }

            // add rulings loaded from Gatherer, if needed
            if(command.match(/^ruling/) && card.related_uris.gatherer) {
                rp(card.related_uris.gatherer).then(gatherer => {
                    embed.setAuthor('Gatherer rulings for');
                    embed.setDescription(this.parseGathererRulings(gatherer));
                    resolve(embed);
                });
            } else {
                resolve(embed);
            }
        });
    }

    /**
     * Fetch the cards from Scryfall
     * @param cardName
     * @returns {Promise<Object>}
     */
    getCards(cardName) {
        let requestPromise;
        requestPromise = new Promise((resolve, reject) => {
            rp({url: this.cardApi + encodeURIComponent(cardName + ' include:extras'), json: true}).then(body => {
                if(body.data && body.data.length) {
                    // sort the cards to better match the search query (issue #87)
                    body.data.sort((a, b) => this.scoreHit(b, cardName) - this.scoreHit(a, cardName));
                }
                resolve(body);
            }, () => {
                log.info('Falling back to fuzzy search for '+cardName);
                rp({url: this.cardApiFuzzy + encodeURIComponent(cardName), json: true})
                    .then(response => resolve({data: [response]}), reject);
            });
        });
        return requestPromise;
    }

    /**
     * Calculate the hit score for a card and a search query
     * @param card
     * @param query
     */
    scoreHit(card, query) {
        const name = (card.printed_name || card.name).toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameQuery = query.split(" ").filter(q => !q.match(/[=:()><]/)).join(" ").toLowerCase().replace(/[^a-z0-9]/g, '');
        let score = 0;
        if (name === nameQuery) {
            // exact match - to the top!
            score = 10000;
        } else if(name.match(new RegExp('^'+nameQuery))) {
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
     * @param channel Channel object in which to interact
     * @param author User object to respond to
     */
    handleCommand(command, parameter, channel, author){
        const cardName = parameter.toLowerCase();
        // no card name, no lookup
        if (!cardName) return;
        const permission = true; // assume we have custom emoji permission for now
        // fetch data from API
        this.getCards(cardName).then(body => {
            // check if there are results
            if (body.data && body.data.length) {
                // generate embed
                this.generateEmbed(body.data, command, permission).then(embed => {
                    return channel.send('', {embed});
                }, err => log.error(err)).then(async sentMessage => {
                    // add reactions for zoom and paging
                    if (!command.match(/^art/)){
                        await sentMessage.react('🔍');
                    }
                    if (body.data.length > 1) {
                        await sentMessage.react('⬅');
                        await sentMessage.react('➡');
                    }

                    const handleReaction = reaction => {
                        if (reaction.emoji.toString() === '⬅') {
                            body.data.unshift(body.data.pop());
                        } else if (reaction.emoji.toString() === '➡') {
                            body.data.push(body.data.shift());
                        } else {
                            // toggle zoom
                            body.data[0].zoom = !body.data[0].zoom;
                        }
                        // edit the message to update the current card
                        this.generateEmbed(body.data, command, permission).then(embed => {
                            sentMessage.edit('', {embed});
                        }).catch(() => {});
                    }

                    sentMessage.createReactionCollector(
                        ({emoji} , user) => ['⬅','➡','🔍'].indexOf(emoji.toString()) > -1 && user.id === author.id,
                        {time: 60000, max: 20}
                    ).on('collect', handleReaction).on('remove', handleReaction);
                }, err => log.error(err)).catch(() => {});
            }
        }).catch(err => {
            let description = 'No cards matched `'+cardName+'`.';
            if (err.statusCode === 503) {
                description = 'Scryfall is currently offline, please try again later.'
            }
            return channel.send('', {embed: new Discord.MessageEmbed({
                    title: 'Error',
                    description,
                    color: 0xff0000
                })});
        });
    }

    /**
     * Handle an incoming message
     * @param command
     * @param parameter
     * @param msg
     * @returns {Promise}
     */
    handleMessage(command, parameter, msg) {
        return this.handleCommand(command, parameter, msg.channel, msg.author)
    }
}

module.exports = MtgCardLoader;
