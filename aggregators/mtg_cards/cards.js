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

        // Look for an exact match by name
        let card = uniqCards.find(c => c.name.toLowerCase() === cardName);
        if (!card){
            // Use a hit which shares the longest common prefix with the search term
            card = _.maxBy(uniqCards, c => longestCommonPrefix(cardName, c.name.toLowerCase()));
        }
        return card;
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
                let otherCardNames = body.cards.map(c => c.name).filter(n => n !== card.name);
                if (otherCardNames.length) {
                    otherCardNames.sort();
                    otherCardNames = _.sortedUniq(otherCardNames);
                    response += "\n\nOther matching cards: " + otherCardNames.join(", ");
                }
                callback(response, card.imageUrl, _.snakeCase(_.deburr(card.name)) + ".jpg");
            }
        });
    }
}

function longestCommonPrefix(...strings) {
    if (strings.length === 0) {
        return "";
    }
    for (let i = 0; i < strings[0].length; i++) {
        for (let j = 1; j< strings.length; j++) {
            if (strings[0][i] !== strings[j][i]) {
                return strings[0].substring(0, i);
            }
        }
    }
    return strings[0];
}

module.exports = MtgCardLoader;
