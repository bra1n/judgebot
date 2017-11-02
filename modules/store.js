const rp = require("request-promise-native");
const Discord = require("discord.js");
const log = require("log4js").getLogger("locator");

class StoreLocator {

    constructor() {
        this.geocoder = 'https://maps.googleapis.com/maps/api/geocode/json?new_forward_geocoder=true&key=' + process.env.GOOGLE_TOKEN + '&address=';
        this.googleStaticMap = 'https://maps.googleapis.com/maps/api/staticmap?scale=2&size=640x320&maptype=' +
            'roadmap&format=png&visual_refresh=true&key=' + process.env.GOOGLE_TOKEN;
        this.googleStaticMapStandardMarkup = '&markers=size:mid|color:0x513dc2|';
        this.wizardsLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocations';
        this.wizardsStoreUrl = 'http://locator.wizards.com/#brand=magic&a=location&massmarket=no&';
        this.stores = [];
        this.storesLoaded = false;
        this.commands = {
            stores: {
                aliases: ['store'],
                inline: false,
                description: "Lists the first 6 stores that are closest to the specified location",
                help: 'This command shows you the closest stores and a link to their events for a given location.',
                examples: ["!stores New York"]
            }
        };
        this.fetchStores();
    }

    getCommands() {
        return this.commands;
    }

    /**
     * Fetch every store in the store locator at a specific longitude and distance
     * @param longitude starting longitude (default -180)
     * @param distance width of area to cover
     */
    fetchStores(longitude = 0, distance = 10) {
        if (longitude > 20 - distance) {
            // end of the world! abort!
            log.info(this.stores.length + ' stores cached');
            this.storesLoaded = true;
            return;
        }
        rp({
            method: 'POST',
            url: this.wizardsLocator,
            body: this.generateRequestBody({
                location: {},
                bounds: {northeast: {lat: 85, lng: longitude + distance}, southwest: {lat: -85, lng: longitude}}
            }, 5000),
            json: true
        }).then(response => {
            let count = 0;
            if (response.d.Results) {
                response.d.Results.forEach(({Address, Organization, IsStore}) => {
                    if (IsStore && Organization) {
                        count++;
                        delete Organization.__type;
                        delete Organization.MasterGuid;
                        delete Address.__type;
                        delete Address.Format;
                        this.stores.push({Address, Organization, IsStore});
                    }
                });
            }
            log.info(`retrieved ${count} stores between ${longitude} and ${longitude + distance} longitude`);
            this.fetchStores(longitude + distance);
        }, err => log.error(err));
    }

    generateRequestBody(geometry, count = 10) {
        let requestBody = {
            count,
            filter_mass_markets: true,
            language: "en-us",
            page: 1,
            request: {
                EarliestEventStartDate: null,
                LatestEventStartDate: null,
                LocalTime: '/Date(' + Date.now() + ')/',
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
        if (geometry.bounds) {
            requestBody.request.North = geometry.bounds.northeast.lat;
            requestBody.request.East = geometry.bounds.northeast.lng;
            requestBody.request.South = geometry.bounds.southwest.lat;
            requestBody.request.West = geometry.bounds.southwest.lng;
        }
        return requestBody;
    }

    /**
     * Calculate distance between 2 lat/lon coordinates
     * @source https://stackoverflow.com/questions/27928
     * @param lat1
     * @param lon1
     * @param lat2
     * @param lon2
     * @returns {number}
     */
    getDistance(lat1, lon1, lat2, lon2) {
        const deg2rad = (deg) => deg * (Math.PI/180)
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2-lat1);  // deg2rad below
        const dLon = deg2rad(lon2-lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
        ;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c; // Distance in km
        return d;
    }

    generateStoreEmbed(stores, googleResult) {
        const fields = [];
        const googleStaticMap = [this.googleStaticMap];
        stores.forEach(store => {
            if (!store.IsStore || fields.length > 5) return;
            const {Address, Organization} = store;
            const eventUrl = `${this.wizardsStoreUrl}p=${Address.City},+${Address.CountryName}&c=${Address.Latitude},` +
                             `${Address.Longitude}&loc=${Address.Id}&orgid=${Organization.Id}&addrid=${Address.Id}`;
            const storeUrl = Organization.PrimaryUrl || Organization.CommunityUrl;
            const levels = ['Unknown', 'Gateway', 'Core', 'Advanced', 'Advanced Plus'];
            // calculate distance in KM
            const distance = this.getDistance(
                Address.Latitude, Address.Longitude,
                googleResult.geometry.location.lat, googleResult.geometry.location.lng);

            fields.push({
                name: `${fields.length + 1}) ${Address.Name} (${Math.round(distance)}km)`,
                value: `${Address.Line1}\n`+
                    `${Address.PostalCode} ${Address.City}\n`+
                    `**WPN Level:** ${levels[Organization.Level || 0]}\n`+
                    `**Phone:** ${Organization.Phone}\n`+
                    `**Links:** [Events](${encodeURI(eventUrl)}), `+
                    (storeUrl ? `[Website](${storeUrl}), ` : '')+
                    `[E-Mail](mailto:${Organization.Email})`,
                inline: true
            });

            googleStaticMap.push(`${this.googleStaticMapStandardMarkup}label:${fields.length}|${Address.Line1} `+
                                 `${Address.PostalCode} ${Address.City} ${Address.CountryName}`);
        });
        return rp({url: encodeURI(googleStaticMap.join("")), encoding: null}).then(body =>
            new Discord.RichEmbed({
                title: `Stores closest to ${googleResult.formatted_address}`,
                description: `:link: [Wizards Store Locator results](http://locator.wizards.com/#brand=magic&a=search&p=${encodeURIComponent(googleResult.formatted_address)}&massmarket=no)`,
                file: fields.length ? { // only show map if there are actual stores
                    attachment: body,
                    name: "location.png"
                } : null,
                fields: fields,
                color: fields.length ? 0x00ff00 : 0xff0000
            })
        );

    }

    locate(location) {
        const count = 10; // number of "stores" to retrieve (error margin included for non-store results)
        return rp({url: this.geocoder + encodeURIComponent(location), json: true}).then(googleBody => {
            if (googleBody.results !== null && googleBody.results.length > 0) {
                if (!this.storesLoaded || !this.stores.length) {
                    // if stores are not cached yet, use live results (slow!)
                    return rp({
                        method: 'POST',
                        url: this.wizardsLocator,
                        body: this.generateRequestBody(googleBody.results[0].geometry, count),
                        json: true
                    }).then(wizardsBody => this.generateStoreEmbed(wizardsBody.d.Results, googleBody.results[0]),
                        err => this.generateErrorEmbed(err, "Couldn't retrieve stores from Wizards."));
                } else {
                    // use cached stores to calculate closest stores
                    const location = {
                        lat: googleBody.results[0].geometry.location.lat,
                        lng: googleBody.results[0].geometry.location.lng
                    }
                    // create a copy of stores and sort it by distance to our location
                    let results = this.stores.slice();
                    results.sort((a, b) =>
                        this.getDistance(a.Address.Latitude, a.Address.Longitude, location.lat, location.lng) -
                        this.getDistance(b.Address.Latitude, b.Address.Longitude, location.lat, location.lng));
                    return this.generateStoreEmbed(results.slice(0, count), googleBody.results[0]);
                }
            } else {
                return this.generateErrorEmbed(null, `Location \`${location}\` not found.`);
            }
        }, err => this.generateErrorEmbed(err, "Couldn't retrieve location from Google."));
    }

    generateErrorEmbed(error, description) {
        if(error) {
            log.error(description, error.error.details);
        }
        return new Discord.RichEmbed({
            title: "Store Locator - Error",
            description,
            color: 0xff0000
        });
    }

    handleMessage(command, parameter, msg) {
        return msg.channel.send('', {embed: new Discord.RichEmbed({
            title: "Store Locator",
            description: "Looking up stores near `"+parameter+"`..."
        })}).then(sentMessage =>
            this.locate(parameter).then(embed => msg.channel.send("", {embed}).then(() => sentMessage.delete()))
        );
    }
}

module.exports = StoreLocator;