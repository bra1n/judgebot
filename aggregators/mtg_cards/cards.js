const request = require("request");
class MtgCardLoader {
    constructor() {
        this.cardApi = "https://api.magicthegathering.io/v1/cards?name=";
    }

    find(cardName, callback) {
        request({
                url: this.cardApi + cardName,
                json: true
            },
            /**
             * @param response
             * @param error
             * @param body
             * @param body.cards array of cards
             * @param body.cards.loyalty string
             * @param body.cards.power string
             * @param body.cards.imageUrl string
             * @param body.cards.toughness string
             * @param body.cards.printings array of printings
             **/
            (error, response, body) => {
                if (!error && response.statusCode === 200 && body.cards && body.cards.length) {
                    const cardMap = new Map();
                    body.cards.forEach(function(card){
                        if(cardMap.has(card.name)){
                            if(!cardMap.get(card.name).imageUrl && card.imageUrl){
                                cardMap.set(card.name,card);
                            }
                        }else{
                            cardMap.set(card.name,card);
                        }
                    });
                    const cards =  Array.from(cardMap).map(function(element){
                        return element[1];
                    });
                    let card = cards.find(function(card){
                        return card.name.toLowerCase() === cardName;
                    });
                    if(!card){
                        card = cards.find(function (card) {
                           return card.name.toLowerCase().startsWith(cardName);
                        })
                    }
                    if(!card){
                        card = cards[0];
                    }
                    const cardInfo = ["**" + card.name + "**"];
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
                    if (card.imageUrl) {
                        cardInfo.push(card.imageUrl);
                    }
                    callback(cardInfo.join("\n"));
                    if(cards.length>1){
                        const cardNames = [];
                        cards.forEach(function(element){
                            if(!(element.name===card.name)){
                                cardNames.push((element.name));
                            }
                        });
                        callback("Other matching cards are: " + cardNames.join(", "))
                    }
                }
            });
    }

    getContent(command , parameter, callback) {
        this.find(parameter.toLowerCase(), callback);
    }
}
module.exports = MtgCardLoader;
