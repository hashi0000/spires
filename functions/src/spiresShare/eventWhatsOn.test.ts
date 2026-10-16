import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import {
  annotateWhatsOn,
  fetchEventWhatsOn,
  matchShareVenueId,
  parseEnglishDayMonth,
  parseExcelWhatsOn,
  parseO2Rss,
  parseWembleyEventPage,
  parseWembleyListingPaths,
  suggestedDepartureFromEvent,
  utcIsoToLondonDateTime,
  whatsOnCopyText,
} from "./eventWhatsOn";
import { ShareInterestGroup } from "./types";

const venues = DEFAULT_SHARE_CONFIG.shareVenues || [];
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

describe("event whats on", () => {
  it("maps venue aliases without using Heathrow", () => {
    assert.equal(matchShareVenueId("Tottenham Hotspur Stadium", venues), "allianz");
    assert.equal(matchShareVenueId("indigo at The O2", venues), "o2");
    assert.equal(matchShareVenueId("Heathrow Terminal 3", venues), undefined);
  });

  it("converts UTC start times into London civil time and a 3 hour departure buffer", () => {
    const london = utcIsoToLondonDateTime("2026-10-03T17:30:00Z");
    assert.equal(london?.date, "2026-10-03");
    assert.equal(london?.time, "18:30");
    assert.equal(suggestedDepartureFromEvent("2026-10-06", "19:45", 180), "16:45");
  });

  it("keeps O2 arena shows and drops cancelled or moved listings", () => {
    const rows = parseO2Rss(O2_RSS, NOW, venues);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].eventName, "Niall Horan");
    assert.equal(rows[0].venueId, "o2");
    assert.equal(rows[0].eventStartTime, "18:30");
    assert.equal(rows[0].suggestedDepartureTime, "15:30");
  });

  it("lists short ExCeL shows and skips long running exhibitions that already started", () => {
    const rows = parseExcelWhatsOn(EXCEL_HTML, NOW, venues);
    assert.deepEqual(rows.map((row) => row.eventName), ["Salon International", "New Scientist Live 2026"]);
    assert.equal(rows[0].eventStartTime, "10:00");
    assert.equal(rows[0].venueId, "excel");
  });

  it("reads Wembley event pages for name, date and kick off time", () => {
    const paths = parseWembleyListingPaths('<a href="/events/2026/England-v-Czechia">England</a><a href="/events/2026/England-v-Czechia">dup</a>');
    assert.deepEqual(paths, ["/events/2026/England-v-Czechia"]);
    const parsed = parseWembleyEventPage(
      `<title>England v Czechia</title><span>19:45</span><p class="synopsis">Czechia will visit Wembley Stadium on Tuesday 6 October in the UEFA Nations League</p>`,
      "https://www.wembleystadium.com/events/2026/England-v-Czechia",
      NOW,
      venues
    );
    assert.equal(parseEnglishDayMonth("Tuesday 6 October", "2026"), "2026-10-06");
    assert.equal(parsed?.eventName, "England v Czechia");
    assert.equal(parsed?.eventDate, "2026-10-06");
    assert.equal(parsed?.eventStartTime, "19:45");
    assert.equal(parsed?.suggestedDepartureTime, "16:45");
    assert.equal(parsed?.outboundFarePence, 4000);
  });

  it("marks events that already have a Share opportunity and never treats listings as published", () => {
    const rows = parseO2Rss(O2_RSS, NOW, venues);
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
      } as ShareInterestGroup,
    ];
    const listed = annotateWhatsOn(rows, groups, NOW);
    assert.equal(listed[0].alreadyCreated, true);
    assert.equal(listed[0].existingPublished, false);
    assert.equal(listed[0].interestedSeatCount, 2);
    assert.match(listed[0].whyInteresting, /Already a Share opportunity/);
    assert.equal((listed[0] as { eventPublished?: boolean }).eventPublished, undefined);
    assert.match(whatsOnCopyText(listed, NOW), /not published to customers/);
  });

  it("returns listings from venue feeds without creating Share opportunities", async () => {
    const result = await fetchEventWhatsOn({
      venues,
      now: NOW,
      fetchImpl: async (url) => {
        let body = "";
        if (url.includes("theo2.co.uk/events/rss")) body = O2_RSS;
        else if (url.includes("excel.london")) body = EXCEL_HTML;
        else if (url.includes("wembleystadium.com/events/2026")) {
          body = `<title>England v Czechia</title><span>19:45</span><p class="synopsis">on Tuesday 6 October</p>`;
        } else if (url.includes("wembleystadium.com/events")) {
          body = `<a href="/events/2026/England-v-Czechia">England</a>`;
        } else if (url.includes("thesportsdb.com")) {
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
    assert.ok(result.events.some((row) => row.eventName === "Niall Horan"));
    assert.ok(result.events.some((row) => row.eventName === "England v Czechia"));
    assert.ok(result.events.some((row) => row.eventName === "Tottenham Hotspur vs Brentford"));
    assert.ok(!result.events.some((row) => /Old Trafford|Manchester United vs Tottenham/i.test(row.eventName + row.locationNote)));
    assert.equal(result.calendars.length, 4);
    assert.ok(!result.events.some((row) => (row as { eventPublished?: boolean }).eventPublished === true));
  });
});
