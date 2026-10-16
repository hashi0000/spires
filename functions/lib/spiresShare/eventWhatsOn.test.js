"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const defaults_1 = require("./defaults");
const eventWhatsOn_1 = require("./eventWhatsOn");
const venues = defaults_1.DEFAULT_SHARE_CONFIG.shareVenues || [];
const NOW = new Date("2026-10-03T13:00:00.000Z");
const O2_RSS = `
<item>
  <title>Niall Horan</title>
  <link>https://www.theo2.co.uk/events/detail/niall-horan-2026</link>
  <ev:location>The O2 arena </ev:location>
  <ev:startdate>2026-10-03T17:30:00Z</ev:startdate>
  <ev:type>Pop</ev:type>
</item>
<item>
  <title>Pete &amp; Bas | Venue change</title>
  <link>https://www.theo2.co.uk/events/detail/bas-and-pete</link>
  <description>The show will now take place at Islington Assembly Hall</description>
  <ev:location>indigo at The O2</ev:location>
  <ev:startdate>2026-10-09T18:00:00Z</ev:startdate>
</item>
<item>
  <title>Cancelled gig</title>
  <description>This show has been cancelled</description>
  <ev:location>The O2 arena</ev:location>
  <ev:startdate>2026-10-20T18:00:00Z</ev:startdate>
</item>
`;
const EXCEL_HTML = `
<a href="/whats-on/salon-international">Salon</a> <span class="date">2026-10-04</span> <span class="date2">2026-10-05</span>
<a href="/whats-on/house-of-dreamers-london">Long</a> <span class="date">2026-07-01</span> <span class="date2">2026-11-30</span>
<a href="/whats-on/new-scientist-live-2026">NS</a> <span class="date">2026-10-10</span> <span class="date2">2026-10-12</span>
`;
(0, node_test_1.describe)("event whats on", () => {
    (0, node_test_1.it)("maps venue aliases without using Heathrow", () => {
        strict_1.default.equal((0, eventWhatsOn_1.matchShareVenueId)("Tottenham Hotspur Stadium", venues), "allianz");
        strict_1.default.equal((0, eventWhatsOn_1.matchShareVenueId)("indigo at The O2", venues), "o2");
        strict_1.default.equal((0, eventWhatsOn_1.matchShareVenueId)("Heathrow Terminal 3", venues), undefined);
    });
    (0, node_test_1.it)("converts UTC start times into London civil time and a 3 hour departure buffer", () => {
        const london = (0, eventWhatsOn_1.utcIsoToLondonDateTime)("2026-10-03T17:30:00Z");
        strict_1.default.equal(london?.date, "2026-10-03");
        strict_1.default.equal(london?.time, "18:30");
        strict_1.default.equal((0, eventWhatsOn_1.suggestedDepartureFromEvent)("2026-10-06", "19:45", 180), "16:45");
    });
    (0, node_test_1.it)("keeps O2 arena shows and drops cancelled or moved listings", () => {
        const rows = (0, eventWhatsOn_1.parseO2Rss)(O2_RSS, NOW, venues);
        strict_1.default.equal(rows.length, 1);
        strict_1.default.equal(rows[0].eventName, "Niall Horan");
        strict_1.default.equal(rows[0].venueId, "o2");
        strict_1.default.equal(rows[0].eventStartTime, "18:30");
        strict_1.default.equal(rows[0].suggestedDepartureTime, "15:30");
    });
    (0, node_test_1.it)("lists short ExCeL shows and skips long running exhibitions that already started", () => {
        const rows = (0, eventWhatsOn_1.parseExcelWhatsOn)(EXCEL_HTML, NOW, venues);
        strict_1.default.deepEqual(rows.map((row) => row.eventName), ["Salon International", "New Scientist Live 2026"]);
        strict_1.default.equal(rows[0].eventStartTime, "10:00");
        strict_1.default.equal(rows[0].venueId, "excel");
    });
    (0, node_test_1.it)("reads Wembley event pages for name, date and kick off time", () => {
        const paths = (0, eventWhatsOn_1.parseWembleyListingPaths)('<a href="/events/2026/England-v-Czechia">England</a><a href="/events/2026/England-v-Czechia">dup</a>');
        strict_1.default.deepEqual(paths, ["/events/2026/England-v-Czechia"]);
        const parsed = (0, eventWhatsOn_1.parseWembleyEventPage)(`<title>England v Czechia</title><span>19:45</span><p class="synopsis">Czechia will visit Wembley Stadium on Tuesday 6 October in the UEFA Nations League</p>`, "https://www.wembleystadium.com/events/2026/England-v-Czechia", NOW, venues);
        strict_1.default.equal((0, eventWhatsOn_1.parseEnglishDayMonth)("Tuesday 6 October", "2026"), "2026-10-06");
        strict_1.default.equal(parsed?.eventName, "England v Czechia");
        strict_1.default.equal(parsed?.eventDate, "2026-10-06");
        strict_1.default.equal(parsed?.eventStartTime, "19:45");
        strict_1.default.equal(parsed?.suggestedDepartureTime, "16:45");
        strict_1.default.equal(parsed?.outboundFarePence, 4000);
    });
    (0, node_test_1.it)("marks events that already have a Share opportunity and never treats listings as published", () => {
        const rows = (0, eventWhatsOn_1.parseO2Rss)(O2_RSS, NOW, venues);
        const groups = [
            {
                id: "g1",
                publicNumber: "SS-E",
                origin: "Oxford",
                destinationRegion: "The O2",
                travelDate: "2026-10-03",
                timeWindowStart: "15:00",
                timeWindowEnd: "16:00",
                interestedSeatCount: 2,
                status: "GATHERING_INTEREST",
                journeyType: "EVENT",
                eventName: "Niall Horan",
                venueName: "The O2",
                eventDate: "2026-10-03",
                eventPublished: false,
                destinationMatchingEnabled: false,
                minPassengerThreshold: 5,
                createdAt: "2026-10-01T00:00:00.000Z",
                updatedAt: "2026-10-01T00:00:00.000Z",
            },
        ];
        const listed = (0, eventWhatsOn_1.annotateWhatsOn)(rows, groups, NOW);
        strict_1.default.equal(listed[0].alreadyCreated, true);
        strict_1.default.equal(listed[0].existingPublished, false);
        strict_1.default.equal(listed[0].interestedSeatCount, 2);
        strict_1.default.match(listed[0].whyInteresting, /Already a Share opportunity/);
        strict_1.default.equal(listed[0].eventPublished, undefined);
        strict_1.default.match((0, eventWhatsOn_1.whatsOnCopyText)(listed, NOW), /not published to customers/);
    });
    (0, node_test_1.it)("returns listings from venue feeds without creating Share opportunities", async () => {
        const result = await (0, eventWhatsOn_1.fetchEventWhatsOn)({
            venues,
            now: NOW,
            fetchImpl: async (url) => {
                let body = "";
                if (url.includes("theo2.co.uk/events/rss"))
                    body = O2_RSS;
                else if (url.includes("excel.london"))
                    body = EXCEL_HTML;
                else if (url.includes("wembleystadium.com/events/2026")) {
                    body = `<title>England v Czechia</title><span>19:45</span><p class="synopsis">on Tuesday 6 October</p>`;
                }
                else if (url.includes("wembleystadium.com/events")) {
                    body = `<a href="/events/2026/England-v-Czechia">England</a>`;
                }
                else if (url.includes("thesportsdb.com")) {
                    body = JSON.stringify({
                        events: [
                            {
                                idEvent: "1",
                                strEvent: "Tottenham Hotspur vs Brentford",
                                strVenue: "Tottenham Hotspur Stadium",
                                dateEvent: "2026-10-10",
                                strTime: "14:00:00",
                            },
                            {
                                idEvent: "2",
                                strEvent: "Manchester United vs Tottenham Hotspur",
                                strVenue: "Old Trafford",
                                dateEvent: "2026-10-10",
                                strTime: "16:30:00",
                            },
                        ],
                    });
                }
                return { ok: true, status: 200, text: async () => body };
            },
        });
        strict_1.default.ok(result.events.some((row) => row.eventName === "Niall Horan"));
        strict_1.default.ok(result.events.some((row) => row.eventName === "England v Czechia"));
        strict_1.default.ok(result.events.some((row) => row.eventName === "Tottenham Hotspur vs Brentford"));
        strict_1.default.ok(!result.events.some((row) => /Old Trafford|Manchester United vs Tottenham/i.test(row.eventName + row.locationNote)));
        strict_1.default.equal(result.calendars.length, 4);
        strict_1.default.ok(!result.events.some((row) => row.eventPublished === true));
    });
});
