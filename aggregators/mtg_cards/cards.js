function MtgCardLoader(){
    var request = require("request");
    var cardApi = "https://api.magicthegathering.io/v1/cards?name=";
    this.find = function(cardName,callback){
        request({
                url: cardApi + cardName,
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
                    var card = body.cards[0];
                    var cardInfo = ["**"+card.name+"**"];
                    if(card.type){cardInfo.push(card.type);}
                    if(card.text){cardInfo.push(card.text.replace(/\*/g,'\\*'));}
                    if(card.loyalty) {cardInfo.push(card.loyalty);}
                    if(card.power) {cardInfo.push(card.power.replace(/\*/g,'\\*') + "/" + card.toughness.replace(/\*/g,'\\*'));}
                    if(card.printings){cardInfo.push(card.printings.join(", "));}
                    cardInfo.push("http://magiccards.info/query?q=!"+encodeURIComponent(card.name));
                    if(card.imageUrl) {cardInfo.push(card.imageUrl);}
                    callback(cardInfo.join("\n"));
                }
            });
    };
}
MtgCardLoader.prototype.getContent = function(parameter,callback){this.find(parameter,callback);};

module.exports = MtgCardLoader;