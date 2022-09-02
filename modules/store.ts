import Fuse from "fuse.js";

const log = utils.getLogger('locator');
import fetch from 'node-fetch';
import * as utils from "../utils.js";
import { MessageOptions, CommandInteraction, AttachmentBuilder, EmbedBuilder, InteractionReplyOptions } from "discord.js";
import { Discord, Slash, SlashChoice, SlashOption, SlashOptionOptions } from "discordx";

@Discord()
export default class StoreLocator {
    static geocoder = `https://maps.googleapis.com/maps/api/geocode/json?new_forward_geocoder=true&key=${process.env.GOOGLE_TOKEN}&address=`;
    static googleStaticMap = 'https://maps.googleapis.com/maps/api/staticmap?scale=2&size=640x320&maptype=' +
        'roadmap&format=png&visual_refresh=true&key=' + process.env.GOOGLE_TOKEN;
    static googleStaticMapStandardMarkup = '&markers=size:mid|color:0x513dc2|';
    static storeLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocations';
    static eventsLocator = 'http://locator.wizards.com/Service/LocationService.svc/GetLocationDetails';
    static wizardsStoreUrl = 'http://locator.wizards.com/#brand=magic&a=location&massmarket=no&';
    static wizardsSearchUrl = 'http://locator.wizards.com/#brand=magic&a=search&massmarket=no&p=';
    static storeLevels = ['Unknown', 'Gateway', 'Core', 'Advanced', 'Advanced Plus'];
    static eventTypes: Record<string, string> = {
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
    static eventFormats: Record<string, string> = {
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
    static eventFormatDictionary: Record<string, string> = {
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
    stores: any[];
    storeSearch: Fuse<any> | null;

    constructor() {
        this.stores = [];
        this.storeSearch = null;
        // This doesn't work
        // (async () => {
        //     await this.fetchStores();
        // })();
    }

    /**
     * Fetch every store in the store locator at a specific longitude and distance
     * @param longitude starting longitude (default -180)
     * @param distance width of area to cover
     */
    async fetchStores(longitude = -180, distance = 10) {
        try {
            if (longitude > 180 - distance) {
                // fetchStores(longitude = 0, distance = 10) { // easier testing
                //     if (longitude > 20 - distance) {
                log.info(this.stores.length + ' stores cached');
                this.storeSearch = new Fuse(this.stores, {
                    shouldSort: true,
                    threshold: 0.5,
                    minMatchCharLength: 3,
                    keys: [{
                        name: 'Organization.Name',
                        weight: 0.7
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
            const res = await fetch(StoreLocator.storeLocator, {
                method: 'POST',
                body: JSON.stringify(this.generateStoreRequestBody({
                    location: {},
                    bounds: { northeast: { lat: 85, lng: longitude + distance }, southwest: { lat: -85, lng: longitude } }
                }, 5000)),
            });
            const body: any = await res.json();
            let count = 0;
            if (body.d.Results) {
                body.d.Results.forEach(({
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
                        this.stores.push({ Address, Organization, IsStore });
                    }
                });
            }
            log.info(`retrieved ${count} stores between ${longitude} and ${longitude + distance} longitude`);
            await this.fetchStores(longitude + distance);
        } catch (err: any) {
            log.error(err)
        }
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
        const deg2rad = (deg: any) => deg * (Math.PI / 180)
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);  // deg2rad below
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    /**
     * Find the stores closest to a provided location
     */
    async locateStores(location: any): Promise<InteractionReplyOptions> {
        const count = 10; // number of "stores" to retrieve (error margin included for non-store results)
        let googleBody: any;
        try {
            const res = await fetch(StoreLocator.geocoder + encodeURIComponent(location));
            googleBody = await res.json();
        } catch (err: any) {
            return { embeds: [await this.generateErrorEmbed(err, "Couldn't retrieve location from Google.")] };
        }

        if (googleBody.results !== null && googleBody.results.length > 0) {
            if (!this.storeSearch || !this.stores.length) {
                // if stores are not cached yet, use live results (slow!)
                const wizardsBody: any = await (await fetch(StoreLocator.storeLocator, {
                    method: 'POST',
                    body: JSON.stringify(this.generateStoreRequestBody(googleBody.results[0].geometry, count)),
                })).json();

                try {
                    return this.generateStoreEmbed(wizardsBody.d.Results, googleBody.results[0]);
                } catch (err: any) {
                    return { embeds: [await this.generateErrorEmbed(err, "Couldn't retrieve stores from Wizards.")] };
                }
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
            return { embeds: [await this.generateErrorEmbed(null, `Location \`${location}\` not found.`)] };
        }
    }

    async generateStoreEmbed(stores: any, googleResult: any): Promise<InteractionReplyOptions> {
        const fields: any = [];
        const googleStaticMap = [StoreLocator.googleStaticMap];
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

            googleStaticMap.push(`${StoreLocator.googleStaticMapStandardMarkup}label:${fields.length}|${Address.Line1} ` +
                `${Address.PostalCode} ${Address.City} ${Address.CountryName}`);
        });
        // fetch map from google
        const res = await fetch(encodeURI(googleStaticMap.join("")));
        if (!res.body) {
            throw Error();
        }
        return {
            embeds: [{
                title: `Stores closest to ${googleResult.formatted_address}`,
                description: `:link: [Wizards Store Locator results](${StoreLocator.wizardsSearchUrl}${encodeURIComponent(googleResult.formatted_address)})`,
                image: fields.length ? { // only show map if there are actual stores
                    url: "attachment://image.png",
                } : undefined,
                fields: fields,
                color: fields.length ? 0x00ff00 : 0xff0000
            }],
            files: [new AttachmentBuilder(res.body, {
                name: "location.png"
            })]
        }
    }

    /**
     * Find all events for a store, optionally filtered by the first parameter word
     */
    async getEvents(query: string): Promise<EmbedBuilder> {
        // check if there are filters present
        const filters: any = {};
        let parameters = query.toLowerCase().split(" ");
        if (parameters.length == 0) {
            throw new Error("Empty query provided.")
        }
        while (parameters.length > 1) {
            let filter: string = parameters.shift() as string;
            if (StoreLocator.eventTypes[filter]) {
                filters.type = StoreLocator.eventTypes[filter];
            } else if (StoreLocator.eventFormats[filter]) {
                filters.format = StoreLocator.eventFormats[filter];
            } else {
                parameters.unshift(filter);
                break;
            }
        }
        if (this.storeSearch) {
            const stores = this.storeSearch.search(parameters.join(" "));
            if (stores.length) {
                let events: any;
                try {
                    const res = await fetch(StoreLocator.eventsLocator, {
                        method: 'POST',
                        body: JSON.stringify({
                            language: "en-us",
                            request: {
                                BusinessAddressId: stores[0].item.Address.Id,
                                OrganizationId: stores[0].item.Organization.Id,
                                EventTypeCodes: [],
                                PlayFormatCodes: [],
                                ProductLineCodes: [],
                                LocalTime: '/Date(' + Date.now() + ')/',
                                EarliestEventStartDate: null,
                                LatestEventStartDate: null
                            }
                        }),
                    });
                    events = await res.json();
                } catch (err: any) {
                    return await this.generateErrorEmbed(err, 'Error loading events from Wizards.');
                }
                return this.generateEventsEmbed(stores[0], events, filters)
            } else {
                return this.generateErrorEmbed(null, "No store found for `" + query + "`");
            }
        }
        return this.generateErrorEmbed(null, "Error");
    }

    /**
     * Extract events, filter them and turn them into a pretty embed.
     */
    generateEventsEmbed({
        Address,
        Organization
    }: any, response: any, filters: any): EmbedBuilder {
        // helper function to extract a date
        const getDate = (event: any): Date => new Date(parseFloat(event.StartDate.replace(/.*?(\d+)-.*/, '$1')));
        let footer = [];
        const fields: any = [];
        if (response && response.d && response.d.Result && response.d.Result.EventsAtVenue) {
            // merge events at venue with events outside of venue and sort by date
            let events: any = response.d.Result.EventsAtVenue.concat(response.d.Result.EventsNotAtVenue);
            if (filters.type) {
                events = events.filter((event: any) => event.EventTypeCode === filters.type);
                footer.push('type');
            }
            if (filters.format) {
                events = events.filter((event: any) => event.PlayFormatCode === filters.format);
                footer.push('format');
            }
            events.sort((a: any, b: any) => getDate(a).valueOf() - getDate(b).valueOf());
            events.forEach((event: any) => {
                if (fields.length > 5) return;
                const eventDate = getDate(event);
                // if the event is at a different location, link to it
                let location = '';
                if (event.Address.Name !== Address.Name) {
                    const eventUrl = encodeURI(`${StoreLocator.wizardsStoreUrl}p=${event.Address.City},+${event.Address.CountryName}&c=${event.Address.Latitude},` +
                        `${event.Address.Longitude}&loc=${event.OrganizationBusinessAddressId}&orgid=${event.OrganizationId}&addrid=${event.Address.Id}&from=events`);
                    location = `[${event.Address.Name}](${eventUrl})`;
                }
                fields.push({
                    name: eventDate.getFullYear() + '/' + (eventDate.getMonth() + 1) + '/' + ('0' + eventDate.getDate()).substr(-2),
                    value: event.Name + '\n' +
                        `**Format:** ${StoreLocator.eventFormatDictionary[event.PlayFormatCode]}` +
                        (location ? `\n**Location:** ${location}` : '') +
                        (event.AdditionalDetails ? `\n**More Info:** ${event.AdditionalDetails}` : '') +
                        (event.Url ? `\n[Link](${event.Url})` : ''),
                    inline: true
                });
            });
        }

        return new EmbedBuilder({
            title: Organization.Name,
            description: this.generateStoreDescription(Address, Organization),
            fields: fields,
            footer: (footer.length ? { text: 'Events have been filtered by: ' + footer.join(', ') } : undefined),
            color: 0x00ff00
        })
    }

    /**
     * Return a pretty printed string with the data of a store
     */
    generateStoreDescription(Address: any, Organization: any): string {
        const storeUrl = Organization.PrimaryUrl || Organization.CommunityUrl;
        const eventUrl = encodeURI(`${StoreLocator.wizardsStoreUrl}p=${Address.City},+${Address.CountryName}&c=${Address.Latitude},` +
            `${Address.Longitude}&loc=${Address.Id}&orgid=${Organization.Id}&addrid=${Address.Id}`);
        return Address.Line1 + '\n' +
            (Address.Line2 ? Address.Line2 + '\n' : '') +
            (Address.Line3 ? Address.Line3 + '\n' : '') +
            `${Address.PostalCode} ${Address.City}\n` +
            `${Address.CountryName}\n` +
            `**WPN Level:** ${StoreLocator.storeLevels[Organization.Level || 0]}\n` +
            `**Phone:** ${Organization.Phone}\n` +
            `**Links:** [Events](${eventUrl}), ` +
            (storeUrl ? `[Website](${storeUrl}), ` : '') +
            `[E-Mail](mailto:${Organization.Email})`;
    }

    /**
     * Generate an error message embed
     * @param error
     * @param description
     * @returns {"discord.js".MessageEmbed}
     */
    async generateErrorEmbed(error: any, description: any): Promise<EmbedBuilder> {
        if (error) {
            log.error(description, error);
        }
        return new EmbedBuilder({
            title: "Store & Event Locator - Error",
            description,
            color: 0xff0000
        })
    }

    @Slash({
        name: "events",
        description: "Lists the details and next 6 events for a store, optionally filtered by event type or format"
    })
    async slashEvents(
        @SlashOption({ name: "location", description: "The name of a location, e.g. New York" })
        location: string,
        interaction: CommandInteraction
    ) {
        if (this.storeSearch) {
            await interaction.reply({
                embeds: [
                    await this.getEvents(location)
                ]
            });
        } else {
            await interaction.reply({
                embeds: [
                    await this.generateErrorEmbed(null, "The list of stores is currently reloading, please wait a few more minutes.")
                ]
            });
        }
    }

    @Slash({
        name: "stores",
        description: "Lists the first 6 stores that are closest to the specified location"
    })
    async slashStores(
        @SlashOption({ name: "location", description: "The name of a location, e.g. New York" })
        location: string,
        interaction: CommandInteraction
    ) {
        // locate stores
        const sentMessage = await interaction.reply({
            embeds: [new EmbedBuilder({
                title: "Store & Event Locator",
                description: "Looking up stores near `" + location + "`..."
            })], fetchReply: true
        });
        const msg = await this.locateStores(location);
        await interaction.followUp(msg);
    }
}
