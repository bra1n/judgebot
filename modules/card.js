const rp = require("request-promise-native");
const _ = require("lodash");
const log = require("log4js").getLogger('card');
const legalLimitations = ["Vintage","Legacy","Modern","Standard","Commander"];

class MtgCardLoader {
    constructor() {
        this.cardApi = "https://api.magicthegathering.io/v1/cards?name=";
        this.commands = ["card"];
        this.maxLength = 2000;
    }

    getCommands() {
        return this.commands;
    }

    cardToString(card) {
        const manaCost = card.manaCost ? " " + card.manaCost : "";
        const cardInfo = [":black_square_button: **" + card.name + "**" + manaCost];
        if (card.type) {
            cardInfo.push(card.type);
        }
        if (card.text) {
            cardInfo.push(card.text.replace(/\*/g, '\\*'));
        }
        if (card.loyalty) {
            cardInfo.push(card.loyalty);
        }
        if (card.power) {
            cardInfo.push(card.power.replace(/\*/g, '\\*') + "/" + card.toughness.replace(/\*/g, '\\*'));
        }
        if (card.legalities){
            const legalities = _.groupBy(_.filter(card.legalities, legality => {return legalLimitations.includes(legality.format)}),'legality');
            const legalityText = [];
            _.forEach(legalities,(formats,legalityType) =>{
                const typeText = [];
                formats.forEach(format=>{typeText.push(format.format)});
                legalityText.push(legalityType+": "+typeText.sort().join(", "));
            });
            cardInfo.push(legalityText.join(" || "));
        }
        if (card.printings) {
            cardInfo.push(card.printings.join(", "));
        }
        cardInfo.push("http://magiccards.info/query?q=!" + encodeURIComponent(card.name));
        return cardInfo.join("\n");
    }

    findCard(cardName, cards) {
        // create an array containing each card exactly once, preferring cards with image
        const [cardsWithImage, cardsWithoutImage] = _.partition(cards, "imageUrl");
        const differentCardsWithoutImage = _.differenceBy(cardsWithoutImage, cardsWithImage, "name");
        const uniqCards = _.uniqBy(_.concat(cardsWithImage, differentCardsWithoutImage), "name");

        return uniqCards.find(c => c.name.toLowerCase() === cardName) ||
            uniqCards.find(c => c.name.toLowerCase().startsWith(cardName)) || uniqCards[0];
    }

    handleMessage(command, parameter, msg) {
        const cardName = parameter.toLowerCase();
        return rp({
            url: this.cardApi + cardName,
            json: true
        }).then(body => {
            if (body.cards && body.cards.length) {
                const card = this.findCard(cardName, body.cards);
                let response = this.cardToString(card);
                let otherCardNames = body.cards.filter(c => c.name !== card.name).map(c => "*" + c.name + "*");
                if (otherCardNames.length) {
                    otherCardNames.sort();
                    otherCardNames = _.sortedUniq(otherCardNames);
                    response += "\n\n:arrow_right: " + otherCardNames.length + " other matching cards: :large_blue_diamond:" + otherCardNames.join(" :large_blue_diamond:");
                    if (response.length > this.maxLength) {
                        response = response.substring(0, this.maxLength);
                        response = response.substring(0, response.lastIndexOf(" :large_blue_diamond"));
                        response += "\n\u2026";
                    }
                }
                if (card.imageUrl) {
                    return rp({
                        url: card.imageUrl,
                        encoding: null
                    }).then(
                        buffer => msg.channel.sendFile(buffer, _.snakeCase(_.deburr(card.name)) + ".jpg", response),
                        error => {
                            log.error("Downloading image", card.imageUrl, "failed.", error);
                            // Couldn't download card image, fall back on message without image.
                            return msg.channel.sendMessage(response);
                        }
                    );
                }
                return msg.channel.sendMessage(response);
            }
        });
    }
}

module.exports = MtgCardLoader;
