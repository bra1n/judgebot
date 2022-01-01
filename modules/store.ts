// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rp'.
const rp = require("request-promise-native");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Discord'.
const Discord = require("discord.js");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
const utils = require("../utils");
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const log = utils.getLogger('locator');
const Fuse = require("fuse.js");

class StoreLocator {
    commands: any;
    eventFormatDictionary: any;
    eventFormats: any;
    eventTypes: any;
    eventsLocator: any;
    geocoder: any;
    googleStaticMap: any;
    googleStaticMapStandardMarkup: any;
    storeLevels: any;
    storeLocator: any;
    storeSearch: any;
    stores: any;
    wizardsSearchUrl: any;
    wizardsStoreUrl: any;
    constructor() {
        this.geocoder = 'https://maps.googleapis.com/maps/api/geocode/json?new_forward_geocoder=true&key=' + process.env.GOOGLE_TOKEN + '&address=';
        this.googleStaticMap = 'https://maps.googleapis.com/maps/api/staticmap?scale=2&size=640x320&maptype=' +
            'roadmap&format=png&visual_refresh=true&key=' + process.env.GOOGLE_TOKEN;
        this.googleStaticMapStandardMarkup = '&markers=size:mid|color:0x513dc2|';
        this.storeLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocations';
        this.eventsLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocationDetails';
        this.wizardsStoreUrl = 'http://locator.wizards.com/#brand=magic&a=location&massmarket=no&';
        this.wizardsSearchUrl = 'http://locator.wizards.com/#brand=magic&a=search&massmarket=no&p=';
        this.storeLevels = ['Unknown', 'Gateway', 'Core', 'Advanced', 'Advanced Plus'];
        this.eventTypes = {
            "fnm": "FM",
            "casual": "DDCAS",
            "gp": "GP",
            "league": "MLP",
            "leagues": "MLP",
            "pptq": "PPTQ",
            "prerelease": "PR",
            "pr": "PR",
            "ptq": "QT",
            "rptq": "RPTQ",
            "teamgp": "TG",
            "mgns": "MGNS", // "Magic Tournament"
            "ss": "SSM", // standard showdown
            "showdown": "SSM",
            "openhouse": "MOH",
            "oh": "MOH",
            "sc": "SCP", // store championship
            "championship": "SCP"
        };
        this.eventFormats = {
            "standard": "STANDARD",
            "t2": "STANDARD",
            "type2": "STANDARD",
            "draft": "BOOSTER",
            "boosterdraft": "BOOSTER",
            "modern": "MODERN",
            "block": "BLCKCON",
            "sealed": "SEALED",
            "2hgsealed": "2HGSEAL",
            "2hgstandard": "2HGSTAN",
            "legacy": "LEGACY",
            "t1.5": "LEGACY",
            "type1.5": "LEGACY",
            "vintage": "VINTAGE",
            "t1": "VINTAGE",
            "type1": "VINTAGE",
            "extended": "EXTENDED",
            "limited": "CSLLIMI",
            "constructed": "CSLCONS",
            "multiplayer": "CSLMULT",
            "league": "CSLMAGI",
            "commander": "MPLRCOM"
        }
        this.eventFormatDictionary = {
            "STANDARD": "Standard",
            "BOOSTER": "Booster Draft",
            "MODERN": "Modern",
            "BLCKCON": "Block Constructed",
            "SEALED": "Sealed Deck",
            "2HGSEAL": "2 HG Sealed",
            "2HGSTAN": "2 HG Standard",
            "LEGACY": "Legacy",
            "VINTAGE": "Vintage",
            "EXTENDED": "Extended",
            "CSLLIMI": "Casual Limited",
            "CSLCONS": "Casual Constructed",
            "CSLMULT": "Casual Multiplayer",
            "CSLMAGI": "Magic League",
            "MPLRCOM": "Commander",
            "CASS": "Casual Standard",
            "CAS": "Casual Multiplayer - Other"
        }

        this.commands = {
            stores: {
                aliases: ['store'],
                inline: false,
                description: "Lists the first 6 stores that are closest to the specified location",
                help: 'This command shows you the closest stores and a link to their events for a given location.',
                examples: ["!stores New York"]
            },
            events: {
                aliases: ['event'],
                inline: false,
                description: "Lists the details and next 6 events for a store, optionally filtered by event type or format",
                help: 'This command allows you to look up a store by its name and returns the next 6 MTG events that are scheduled there. ' +
                'Filtering by event type or format is supported through the first parameter. Common event types: FNM, Prerelease, PPTQ, RPTQ. ' +
                'Common Formats: standard, modern, legacy, vintage, draft',
                examples: ["!events athena games", "!events pptq athena games", "!events standard athena games"]
            }
        };
        // store cache
        this.stores = [];
        this.storeSearch = false;
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
    fetchStores(longitude = -180, distance = 10) {
        if (longitude > 180 - distance) {
    // fetchStores(longitude = 0, distance = 10) { // easier testing
    //     if (longitude > 20 - distance) {
            log.info(this.stores.length + ' stores cached');
            this.storeSearch = new Fuse(this.stores, {
                shouldSort: true,
                threshold: 0.5,
                matchAllTokens: true,
                minMatchCharLength: 3,
                tokenize: true,
                keys: [{
                   name: 'Organization.Name',
                   weigth: 0.7
               }, {
                   name: 'Address.City',
                   weight: 0.2
               }, {
                   name: 'Address.Country',
                   weight: 0.1
               }]
            });
            return;
        }
        rp({
            method: 'POST',
            url: this.storeLocator,
            body: this.generateStoreRequestBody({
                location: {},
                bounds: {northeast: {lat: 85, lng: longitude + distance}, southwest: {lat: -85, lng: longitude}}
            }, 5000),
            json: true
        }).then((response: any) => {
            let count = 0;
            if (response.d.Results) {
                response.d.Results.forEach(({
                    Address,
                    Organization,
                    IsStore
                }: any) => {
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
        }, (err: any) => log.error(err));
    }

    generateStoreRequestBody(geometry: any, count = 10) {
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
    getDistance(lat1: any, lon1: any, lat2: any, lon2: any) {
        const deg2rad = (deg: any) => deg * (Math.PI/180)
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

    /**
     * Find the stores closest to a provided location
     * @param location
     * @returns {Promise.<TResult>}
     */
    locateStores(location: any) {
        const count = 10; // number of "stores" to retrieve (error margin included for non-store results)
        return rp({url: this.geocoder + encodeURIComponent(location), json: true}).then((googleBody: any) => {
            if (googleBody.results !== null && googleBody.results.length > 0) {
                if (!this.storeSearch || !this.stores.length) {
                    // if stores are not cached yet, use live results (slow!)
                    return rp({
                        method: 'POST',
                        url: this.storeLocator,
                        body: this.generateStoreRequestBody(googleBody.results[0].geometry, count),
                        json: true
                    }).then((wizardsBody: any) => this.generateStoreEmbed(wizardsBody.d.Results, googleBody.results[0]),
                        (err: any) => this.generateErrorEmbed(err, "Couldn't retrieve stores from Wizards."));
                } else {
                    // use cached stores to calculate closest stores
                    const location = {
                        lat: googleBody.results[0].geometry.location.lat,
                        lng: googleBody.results[0].geometry.location.lng
                    }
                    // create a copy of stores and sort it by distance to our location
                    let results = this.stores.slice();
                    results.sort((a: any, b: any) =>
                        this.getDistance(a.Address.Latitude, a.Address.Longitude, location.lat, location.lng) -
                        this.getDistance(b.Address.Latitude, b.Address.Longitude, location.lat, location.lng));
                    return this.generateStoreEmbed(results.slice(0, count), googleBody.results[0]);
                }
            } else {
                return this.generateErrorEmbed(null, `Location \`${location}\` not found.`);
            }
        }, (err: any) => this.generateErrorEmbed(err, "Couldn't retrieve location from Google."));
    }

    generateStoreEmbed(stores: any, googleResult: any) {
        const fields: any = [];
        const googleStaticMap = [this.googleStaticMap];
        stores.forEach(({
            Address,
            Organization,
            IsStore
        }: any) => {
            // only take the first 6 stores
            if (!IsStore || fields.length > 5) return;
            // calculate distance in KM
            const distance = this.getDistance(
                Address.Latitude, Address.Longitude,
                googleResult.geometry.location.lat, googleResult.geometry.location.lng);

            fields.push({
                name: `${fields.length + 1}) ${Address.Name} (${Math.round(distance)}km)`,
                value: this.generateStoreDescription(Address, Organization),
                inline: true
            });

            googleStaticMap.push(`${this.googleStaticMapStandardMarkup}label:${fields.length}|${Address.Line1} `+
                `${Address.PostalCode} ${Address.City} ${Address.CountryName}`);
        });
        // fetch map from google
        return rp({url: encodeURI(googleStaticMap.join("")), encoding: null}).then((body: any) => new Discord.MessageEmbed({
            title: `Stores closest to ${googleResult.formatted_address}`,
            description: `:link: [Wizards Store Locator results](${this.wizardsSearchUrl}${encodeURIComponent(googleResult.formatted_address)})`,
            file: fields.length ? { // only show map if there are actual stores
                attachment: body,
                name: "location.png"
            } : null,
            fields: fields,
            color: fields.length ? 0x00ff00 : 0xff0000
        })
        );

    }

    /**
     * Find all events for a store, optionally filtered by the first parameter word
     * @param query
     */
    getEvents(query: any) {
        // check if there are filters present
        const filters = {};
        let parameters = query.toLowerCase().split(" ");
        while (parameters.length > 1) {
            let filter = parameters.shift();
            if(this.eventTypes[filter]) {
                // @ts-expect-error ts-migrate(2339) FIXME: Property 'type' does not exist on type '{}'.
                filters.type = this.eventTypes[filter];
            } else if (this.eventFormats[filter]) {
                // @ts-expect-error ts-migrate(2339) FIXME: Property 'format' does not exist on type '{}'.
                filters.format = this.eventFormats[filter];
            } else {
                parameters.unshift(filter);
                break;
            }
        }
        const stores = this.storeSearch.search(parameters.join(" "));
        if(stores.length) {
            return rp({
                method: 'POST',
                url: this.eventsLocator,
                body: {
                    language: "en-us",
                    request: {
                        BusinessAddressId: stores[0].Address.Id,
                        OrganizationId: stores[0].Organization.Id,
                        EventTypeCodes: [],
                        PlayFormatCodes: [],
                        ProductLineCodes: [],
                        LocalTime: '/Date(' + Date.now() + ')/',
                        EarliestEventStartDate: null,
                        LatestEventStartDate: null
                    }
                },
                json: true
            }).then((events: any) => this.generateEventsEmbed(stores[0], events, filters),
                (err: any) => this.generateErrorEmbed(err, 'Error loading events from Wizards.'));
        } else {
            return new Promise(resolve => resolve(this.generateErrorEmbed(null, "No store found for `"+query+"`")));
        }
    }

    /**
     * Extract events, filter them and turn them into a pretty embed.
     * @param Address
     * @param Organization
     * @param response
     * @param filters
     * @returns {"discord.js".MessageEmbed}
     */
    generateEventsEmbed({
        Address,
        Organization
    }: any, response: any, filters: any) {
        // helper function to extract a date
        const getDate = (event: any) => new Date(parseFloat(event.StartDate.replace(/.*?(\d+)-.*/,'$1')));
        let footer = [];
        const fields: any = [];
        if (response && response.d && response.d.Result && response.d.Result.EventsAtVenue) {
            // merge events at venue with events outside of venue and sort by date
            let events = response.d.Result.EventsAtVenue.concat(response.d.Result.EventsNotAtVenue);
            if (filters.type) {
                events = events.filter((event: any) => event.EventTypeCode === filters.type);
                footer.push('type');
            }
            if (filters.format) {
                events = events.filter((event: any) => event.PlayFormatCode === filters.format);
                footer.push('format');
            }
            // @ts-expect-error ts-migrate(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
            events.sort((a: any,b: any) => getDate(a) - getDate(b));
            events.forEach((event: any) => {
                if (fields.length > 5) return;
                const eventDate = getDate(event);
                // if the event is at a different location, link to it
                let location = '';
                if (event.Address.Name !== Address.Name) {
                    const eventUrl = encodeURI(`${this.wizardsStoreUrl}p=${event.Address.City},+${event.Address.CountryName}&c=${event.Address.Latitude},` +
                        `${event.Address.Longitude}&loc=${event.OrganizationBusinessAddressId}&orgid=${event.OrganizationId}&addrid=${event.Address.Id}&from=events`);
                    location = `[${event.Address.Name}](${eventUrl})`;
                }
                fields.push({
                    name: eventDate.getFullYear()+'/'+(eventDate.getMonth()+1)+'/'+('0'+eventDate.getDate()).substr(-2),
                    value: event.Name+'\n'+
                        `**Format:** ${this.eventFormatDictionary[event.PlayFormatCode]}`+
                        (location ? `\n**Location:** ${location}`:'')+
                        (event.AdditionalDetails ? `\n**More Info:** ${event.AdditionalDetails}`:'')+
                        (event.Url ? `\n[Link](${event.Url})`:''),
                    inline: true
                });
            });
        }

        return new Discord.MessageEmbed({
            title: Organization.Name,
            description: this.generateStoreDescription(Address, Organization),
            fields: fields,
            footer: (footer.length ? {text: 'Events have been filtered by: '+footer.join(', ')} : null),
            color: 0x00ff00
        })
    }

    /**
     * Return a pretty printed string with the data of a store
     * @param Address
     * @param Organization
     * @returns {string}
     */
    generateStoreDescription(Address: any, Organization: any) {
        const storeUrl = Organization.PrimaryUrl || Organization.CommunityUrl;
        const eventUrl = encodeURI(`${this.wizardsStoreUrl}p=${Address.City},+${Address.CountryName}&c=${Address.Latitude},` +
            `${Address.Longitude}&loc=${Address.Id}&orgid=${Organization.Id}&addrid=${Address.Id}`);
        return Address.Line1 + '\n' +
            (Address.Line2 ? Address.Line2+'\n':'')+
            (Address.Line3 ? Address.Line3+'\n':'')+
            `${Address.PostalCode} ${Address.City}\n`+
            `${Address.CountryName}\n`+
            `**WPN Level:** ${this.storeLevels[Organization.Level || 0]}\n`+
            `**Phone:** ${Organization.Phone}\n`+
            `**Links:** [Events](${eventUrl}), `+
            (storeUrl ? `[Website](${storeUrl}), ` : '')+
            `[E-Mail](mailto:${Organization.Email})`;
    }

    /**
     * Generate an error message embed
     * @param error
     * @param description
     * @returns {"discord.js".MessageEmbed}
     */
    generateErrorEmbed(error: any, description: any) {
        if(error) {
            log.error(description, error);
        }
        return new Discord.MessageEmbed({
            title: "Store & Event Locator - Error",
            description,
            color: 0xff0000
        });
    }

    handleMessage(command: any, parameter: any, msg: any) {
        if (command === 'stores' || this.commands.stores.aliases.indexOf(command) > -1) {
            // locate stores
            if (parameter) {
                return msg.channel.send('', {embed: new Discord.MessageEmbed({
                    title: "Store & Event Locator",
                    description: "Looking up stores near `"+parameter+"`..."
                })}).then((sentMessage: any) => this.locateStores(parameter)
                    .then((embed: any) => msg.channel.send("", {embed}).then(() => sentMessage.delete()))
                );
            } else {
                return msg.channel.send('', {
                    embed: this.generateErrorEmbed(null, "Please provide a location to search for. Example: `!stores berlin`")
                });
            }
        } else {
            // show events
            if (parameter) {
                if (this.storeSearch) {
                    return this.getEvents(parameter).then((embed: any) => msg.channel.send('', {embed}));
                } else {
                    return msg.channel.send('', {
                        embed: this.generateErrorEmbed(null, "The list of stores is currently reloading, please wait a few more minutes.")
                    });
                }
            } else {
                return msg.channel.send('', {
                    embed: this.generateErrorEmbed(null, "Please provide a store to search for. Example: `!events funtainment`")
                });
            }
        }
    }
}

module.exports = StoreLocator;
