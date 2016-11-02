const request = require("request");
const _ = require("lodash");

class MtgCardLoader {
    constructor() {
        this.cardApi = "https://api.magicthegathering.io/v1/cards?name=";
    }
    cardToString(card) {
        const manaCost = card.manaCost ? " " + card.manaCost : "";
        const cardInfo = ["**" + card.name + "**" + manaCost];
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
    getContent(command , parameter, callback) {
        const cardName = parameter.toLowerCase();
        request({
            url: this.cardApi + cardName,
            json: true
        },
        (error, response, body) => {
            if (!error && response.statusCode === 200 && body.cards && body.cards.length) {
                const card = this.findCard(cardName, body.cards);
                let response = this.cardToString(card);
                let otherCardNames = body.cards.filter(c => c.name !== card.name).map(c => "*" + c.name + "*");
                if (otherCardNames.length) {
                    otherCardNames.sort();
                    otherCardNames = _.sortedUniq(otherCardNames);
                    response += "\n\nOther matching cards: " + otherCardNames.join(" | ");
                }
                callback(response, card.imageUrl, _.snakeCase(_.deburr(card.name)) + ".jpg");
            }
        });
    }
}

module.exports = MtgCardLoader;
