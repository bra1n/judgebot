const rp = require("request-promise-native");
const Discord = require("discord.js");
const log = require("log4js").getLogger("locate");

class Locate{

    constructor(){
        this.geocoder = 'https://maps.googleapis.com/maps/api/geocode/json?new_forward_geocoder=true&key='+process.env.GOOGLE_TOKEN+'&address=';
        this.googleStaticMap = 'https://maps.googleapis.com/maps/api/staticmap?autoscale=1&size=640x320&maptype=' +
            'roadmap&format=png&visual_refresh=true&key='+process.env.GOOGLE_STATIC_TOKEN;
        this.googleStaticMapStandardMarkup = '&markers=size:large|color:0x513dc2|';
        this.wizardsLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocations';
        this.wizardsStoreUrl = 'http://locator.wizards.com/#brand=magic&a=location&massmarket=no&';
        this.commands = {
            locate: {
                aliases: [],
                inline: false,
                description: "Lists stores that are nearby the specified location",
                help: 'This command shows you the nearest event stores to a given location.',
                examples: ["!locate New York"]
            }
        };
        log.info("Locate ready");
    }

    getCommands(){
        return this.commands;
    }

    generateRequestBody(geometry){
        let requestBody = {
            count: 9,
            filter_mass_markets: true,
            language: "en-us",
            page: 1,
            request:{
                EarliestEventStartDate: null,
                LatestEventStartDate: null,
                LocalTime: '/Date('+Date.now()+')/',
                EventTypeCodes: [], //The list of of event types you are looking for like Grand Prix or Friday Night Magic
                PlayFormatCodes: [], //The list of the event formats you are looking for like standard or modern
                MarketingProgramCodes: [],
                ProductLineCodes: ["MG"], //The list of product lines for which you seek events (MG stands for Magic the Gathering)
                SalesBrandCodes: ["MG"], //The list of brands (games) for which you seek events (MG stands for Magic the Gathering)
                North: geometry.location.lat,
                East: geometry.location.lng,
                South: geometry.location.lat,
                West: geometry.location.lng
            }
        };
        if(geometry.bounds){
            requestBody.request.North = geometry.bounds.northeast.lat;
            requestBody.request.East = geometry.bounds.northeast.lng;
            requestBody.request.South = geometry.bounds.southwest.lat;
            requestBody.request.West = geometry.bounds.southwest.lng;
        }
        return requestBody;
    }

    generateEmbed(results,googleResult){
        const fields = [];
        const googleStaticMap = [this.googleStaticMap];
        results.forEach(result=>{
            const description = {name:`*${results.indexOf(result)+1}: ${result.Address.Name}*,\n`,inline:true};
            const url = `${this.wizardsStoreUrl}p=${result.Address.City},+${result.Address.CountryName}&c=${result.Address.Latitude},${result.Address.Longitude}&loc=${result.Id}&orgid=${result.Organization.Id}&addrid=${result.Address.Id}`;
            description.value = `${result.Address.Line1} - ${result.Address.City}\n[Event Page](${encodeURI(url)})`;
            fields.push(description);

            googleStaticMap.push(`${this.googleStaticMapStandardMarkup}label:${results.indexOf(result)+1}|${result.Address.Line1} ${result.Address.PostalCode} ${result.Address.City} ${result.Address.CountryName}`);
        });
        return rp({url: encodeURI(googleStaticMap.join("")),encoding:null}).then(body=>
            new Discord.RichEmbed({
                title: "Locations for "+googleResult.formatted_address,
                file:{
                    attachment:body,
                    name:"location.png"},
                fields:fields
            })
        );

    }

    locate(location){
        return rp({url: this.geocoder+encodeURIComponent(location), json:true}).then(googleBody=>{
            if(googleBody.results !== null && googleBody.results.length>0){
                return rp({
                    method:'POST',
                    url:this.wizardsLocator,
                    body:this.generateRequestBody(googleBody.results[0].geometry),
                    json:true
                }).then(wizardsBody=>this.generateEmbed(wizardsBody.d.Results,googleBody.results[0]),err=> {
                    log.error("Error getting stores from Wizards",err.error.details);
                    return new Discord.RichEmbed({
                        title: "Locate - Error",
                        description: "Couldn't receive stores from Wizards.",
                        color: 0xff0000
                    });
                });
            }
        },err=>{
            log.error("Error getting locations form Google",err.error.details);
            return new Discord.RichEmbed({
                title: "Locate - Error",
                description: "Couldn't receive location from Google.",
                color: 0xff0000
            });
        });
    }

    handleMessage(command, parameter, msg) {
        this.locate(parameter).then(embed=>{
            msg.channel.send("",{embed});
        });
    }
}
module.exports = Locate;