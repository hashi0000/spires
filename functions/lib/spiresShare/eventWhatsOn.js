"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VENUE_CALENDARS = exports.WHATS_ON_LIMIT = exports.WHATS_ON_LOOKAHEAD_DAYS = void 0;
exports.utcIsoToLondonDateTime = utcIsoToLondonDateTime;
exports.suggestedDepartureFromEvent = suggestedDepartureFromEvent;
exports.matchShareVenueId = matchShareVenueId;
exports.parseEnglishDayMonth = parseEnglishDayMonth;
exports.parseO2Rss = parseO2Rss;
exports.parseExcelWhatsOn = parseExcelWhatsOn;
exports.parseWembleyListingPaths = parseWembleyListingPaths;
exports.parseWembleyEventPage = parseWembleyEventPage;
exports.parseSportsDbEvents = parseSportsDbEvents;
exports.annotateWhatsOn = annotateWhatsOn;
exports.whatsOnCopyText = whatsOnCopyText;
exports.fetchEventWhatsOn = fetchEventWhatsOn;
const defaults_1 = require("./defaults");
const timezone_1 = require("./timezone");
exports.WHATS_ON_LOOKAHEAD_DAYS = 70;
exports.WHATS_ON_LIMIT = 40;
exports.VENUE_CALENDARS = [
    { venueId: "wembley", venueName: "Wembley Stadium", url: "https://www.wembleystadium.com/events", label: "Wembley Stadium events" },
    { venueId: "o2", venueName: "The O2", url: "https://www.theo2.co.uk/events", label: "The O2 events" },
    { venueId: "excel", venueName: "ExCeL London", url: "https://www.excel.london/whats-on", label: "ExCeL London events" },
    { venueId: "allianz", venueName: "Allianz Stadium", url: "https://www.tottenhamhotspur.com/fixtures/", label: "Allianz Stadium fixtures" },
];
const MONTHS = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
};
const VENUE_ALIASES = {
    "wembley stadium": "wembley",
    wembley: "wembley",
    "the o2": "o2",
    "the o2 arena": "o2",
    "o2 arena": "o2",
    "indigo at the o2": "o2",
    "excel london": "excel",
    excel: "excel",
    "london excel": "excel",
    "tottenham hotspur stadium": "allianz",
    "allianz stadium": "allianz",
    "tottenham stadium": "allianz",
};
function pad2(value) {
    return String(value).padStart(2, "0");
}
function decodeEntities(value) {
    return String(value || "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&#45;/g, "-")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function titleFromSlug(slug) {
    return decodeEntities(slug)
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function londonPartsFromUtc(iso) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms))
        return null;
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((row) => [row.type, row.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function utcIsoToLondonDateTime(iso) {
    return londonPartsFromUtc(iso);
}
function suggestedDepartureFromEvent(eventDate, eventStartTime, bufferMinutes = 180) {
    const iso = (0, timezone_1.londonDateTimeToUtcIso)(eventDate, eventStartTime);
    const shifted = new Date(Date.parse(iso) - bufferMinutes * 60 * 1000).toISOString();
    return londonPartsFromUtc(shifted)?.time || eventStartTime;
}
function matchShareVenueId(name, venues = []) {
    const raw = decodeEntities(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!raw)
        return undefined;
    if (VENUE_ALIASES[raw])
        return VENUE_ALIASES[raw];
    for (const [alias, id] of Object.entries(VENUE_ALIASES)) {
        if (raw.includes(alias))
            return id;
    }
    const found = venues.find((row) => row.name.toLowerCase() === raw || row.id === raw);
    return found?.id;
}
function venueById(venues, venueId) {
    return venues.find((row) => row.id === venueId);
}
function withVenueDefaults(event, venues) {
    const venue = venueById(venues, event.venueId);
    const buffer = venue?.suggestedDepartureBufferMinutes || 180;
    return {
        ...event,
        venueName: event.venueName || venue?.name || event.venueId,
        suggestedDepartureTime: suggestedDepartureFromEvent(event.eventDate, event.eventStartTime, buffer),
        outboundFarePence: venue?.defaultFarePence,
        returnFarePence: venue?.defaultReturnFarePence,
    };
}
function daysBetween(fromDate, toDate) {
    return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}
function isUpcoming(eventDate, eventStartTime, now) {
    try {
        return Date.parse((0, timezone_1.londonDateTimeToUtcIso)(eventDate, eventStartTime)) >= now.getTime();
    }
    catch {
        return eventDate >= now.toISOString().slice(0, 10);
    }
}
function withinLookahead(eventDate, now) {
    const today = londonPartsFromUtc(now.toISOString())?.date || now.toISOString().slice(0, 10);
    const days = daysBetween(today, eventDate);
    return days >= 0 && days <= exports.WHATS_ON_LOOKAHEAD_DAYS;
}
function parseEnglishDayMonth(text, year) {
    const match = String(text || "").match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
    if (!match)
        return undefined;
    const month = MONTHS[match[2].toLowerCase()];
    if (!month || !/^\d{4}$/.test(year))
        return undefined;
    return `${year}-${month}-${pad2(Number(match[1]))}`;
}
function parseO2Rss(xml, now, venues) {
    const items = String(xml || "").split(/<item>/i).slice(1);
    const out = [];
    for (const raw of items) {
        const item = raw.split(/<\/item>/i)[0] || "";
        const title = decodeEntities((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
        const link = decodeEntities((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
        const location = decodeEntities((item.match(/<ev:location>([\s\S]*?)<\/ev:location>/i) || [])[1] || "");
        const start = decodeEntities((item.match(/<ev:startdate>([\s\S]*?)<\/ev:startdate>/i) || [])[1] || "");
        const type = decodeEntities((item.match(/<ev:type>([\s\S]*?)<\/ev:type>/i) || [])[1] || "concert");
        const description = decodeEntities((item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || "");
        if (!title || !start)
            continue;
        if (/cancelled|venue change/i.test(`${title} ${description}`))
            continue;
        const venueId = matchShareVenueId(location || "The O2", venues);
        if (venueId !== "o2")
            continue;
        const london = utcIsoToLondonDateTime(start);
        if (!london || !isUpcoming(london.date, london.time, now) || !withinLookahead(london.date, now))
            continue;
        out.push(withVenueDefaults({
            sourceId: `o2:${link || title}:${london.date}`,
            source: "o2-rss",
            eventName: title,
            venueId: "o2",
            eventDate: london.date,
            eventStartTime: london.time,
            eventUrl: link,
            eventCategory: type.toLowerCase() || "concert",
            locationNote: location || "The O2",
        }, venues));
    }
    return out;
}
function parseExcelWhatsOn(html, now, venues) {
    const rows = [
        ...String(html || "").matchAll(/href="(\/whats-on\/[^"]+)"[\s\S]{0,1600}?class="date">(\d{4}-\d{2}-\d{2})<\/span>\s*<span class="date2">(\d{4}-\d{2}-\d{2})<\/span>/gi),
    ];
    const today = londonPartsFromUtc(now.toISOString())?.date || now.toISOString().slice(0, 10);
    const out = [];
    for (const row of rows) {
        const slug = String(row[1] || "").replace(/^\/whats-on\//, "");
        const start = row[2];
        const end = row[3];
        if (!slug || !start)
            continue;
        const duration = daysBetween(start, end);
        if (duration > 7 && daysBetween(today, start) > 21)
            continue;
        if (!isUpcoming(start, "10:00", now) || !withinLookahead(start, now))
            continue;
        out.push(withVenueDefaults({
            sourceId: `excel:${slug}:${start}`,
            source: "excel-listings",
            eventName: titleFromSlug(slug),
            venueId: "excel",
            eventDate: start,
            eventStartTime: "10:00",
            eventUrl: `https://www.excel.london/whats-on/${slug}`,
            eventCategory: "exhibition",
            untilDate: end !== start ? end : undefined,
        }, venues));
    }
    return out;
}
function parseWembleyListingPaths(html) {
    const found = String(html || "").match(/\/events\/(20\d{2})\/[A-Za-z0-9._-]+/g) || [];
    const unique = [];
    for (const path of found) {
        if (path.toLowerCase().includes("/media/"))
            continue;
        const clean = path.split("?")[0];
        if (!unique.includes(clean))
            unique.push(clean);
    }
    return unique;
}
function parseWembleyEventPage(html, pageUrl, now, venues) {
    const year = (pageUrl.match(/\/events\/(20\d{2})\//) || [])[1] || "";
    const title = decodeEntities((html.match(/<h1[^>]*class="article-title"[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "") ||
        decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "") ||
        titleFromSlug((pageUrl.split("/").pop() || "").replace(/-/g, " "));
    const synopsis = decodeEntities((html.match(/class="synopsis"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "");
    const body = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " "));
    const eventDate = parseEnglishDayMonth(`${synopsis} ${body}`, year);
    const timeMatch = html.match(/<span>\s*([01]?\d|2[0-3]):([0-5]\d)\s*<\/span>/);
    const time = timeMatch ? `${pad2(Number(timeMatch[1]))}:${timeMatch[2]}` : "19:45";
    if (!title || !eventDate)
        return null;
    if (!isUpcoming(eventDate, time, now) || !withinLookahead(eventDate, now))
        return null;
    const category = /nfl/i.test(`${title} ${pageUrl}`) ? "nfl" : /england|cup|final/i.test(title) ? "football" : "concert";
    return withVenueDefaults({
        sourceId: `wembley:${pageUrl}`,
        source: "wembley-listings",
        eventName: title.replace(/\s+\|\s+Wembley.*$/i, "").trim(),
        venueId: "wembley",
        eventDate,
        eventStartTime: time,
        eventUrl: pageUrl.startsWith("http") ? pageUrl : `https://www.wembleystadium.com${pageUrl}`,
        eventCategory: category,
    }, venues);
}
function parseSportsDbEvents(payload, now, venues) {
    const out = [];
    for (const row of payload?.events || []) {
        const venueName = String(row.strVenue || "");
        const venueId = matchShareVenueId(venueName, venues);
        if (!venueId)
            continue;
        const date = String(row.dateEvent || "");
        const timeRaw = String(row.strTimeLocal || row.strTime || "19:45").slice(0, 5);
        const time = /^\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : "19:45";
        if (!date || !isUpcoming(date, time, now) || !withinLookahead(date, now))
            continue;
        const name = decodeEntities(String(row.strEvent || `${row.strHomeTeam || ""} vs ${row.strAwayTeam || ""}`));
        out.push(withVenueDefaults({
            sourceId: `sportsdb:${row.idEvent || name}:${date}`,
            source: "sportsdb",
            eventName: name,
            venueId,
            eventDate: date,
            eventStartTime: time,
            eventUrl: "",
            eventCategory: "football",
            locationNote: venueName,
        }, venues));
    }
    return out;
}
function eventKey(eventName, venueId, eventDate) {
    return `${eventName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${venueId}|${eventDate}`;
}
function annotateWhatsOn(events, groups, now) {
    const today = londonPartsFromUtc(now.toISOString())?.date || now.toISOString().slice(0, 10);
    return events.map((event) => {
        const group = groups.find((row) => {
            if (row.journeyType !== "EVENT")
                return false;
            const groupVenue = matchShareVenueId(row.venueName || row.destinationRegion || "", []) || row.venueName;
            const sameVenue = groupVenue === event.venueId || (row.venueName || "").toLowerCase() === event.venueName.toLowerCase();
            const sameDate = (row.eventDate || row.travelDate) === event.eventDate;
            const sameName = eventKey(row.eventName || "", event.venueId, event.eventDate) === eventKey(event.eventName, event.venueId, event.eventDate);
            return sameVenue && sameDate && sameName;
        });
        const days = daysBetween(today, event.eventDate);
        const bits = [];
        if (days <= 7)
            bits.push("This week");
        else if (days <= 21)
            bits.push("Coming up");
        if (group)
            bits.push(group.eventPublished ? "Already published" : "Already a Share opportunity");
        if (group?.interestedSeatCount)
            bits.push(`${group.interestedSeatCount} interested`);
        if (!bits.length)
            bits.push("Review before creating");
        return {
            ...event,
            alreadyCreated: Boolean(group),
            existingGroupId: group?.id,
            existingPublished: group?.eventPublished === true,
            interestedSeatCount: group?.interestedSeatCount || 0,
            whyInteresting: bits.join(". "),
        };
    });
}
function whatsOnCopyText(events, now) {
    const today = londonPartsFromUtc(now.toISOString())?.date || now.toISOString().slice(0, 10);
    const lines = [`Events of interest from ${today}`, ""];
    let venue = "";
    for (const event of events.slice(0, 25)) {
        if (event.venueName !== venue) {
            venue = event.venueName;
            lines.push(venue);
        }
        const until = event.untilDate ? ` until ${event.untilDate}` : "";
        lines.push(`${event.eventDate} ${event.eventStartTime} ${event.eventName}${until}`);
    }
    lines.push("", "These are not published to customers until you create and publish a Share opportunity.");
    return lines.join("\n");
}
function dedupeEvents(events) {
    const seen = new Set();
    const out = [];
    for (const event of events.sort((a, b) => `${a.eventDate}T${a.eventStartTime}`.localeCompare(`${b.eventDate}T${b.eventStartTime}`))) {
        const key = eventKey(event.eventName, event.venueId, event.eventDate);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(event);
    }
    return out;
}
async function readText(fetchImpl, url) {
    const response = await fetchImpl(url, {
        headers: { "User-Agent": "SpiresTaxisShare/1.0 (admin event listings; https://www.spires-taxis.com)" },
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
        throw new Error(`${url} returned ${response.status}`);
    return response.text();
}
async function fetchEventWhatsOn(input) {
    const now = input.now || new Date();
    const venues = input.venues?.length ? input.venues : defaults_1.DEFAULT_SHARE_CONFIG.shareVenues || [];
    const fetchImpl = input.fetchImpl || ((url, init) => fetch(url, init));
    const sourceErrors = [];
    const sources = [];
    const collected = [];
    const jobs = [
        readText(fetchImpl, "https://www.theo2.co.uk/events/rss")
            .then((xml) => {
            sources.push("The O2 events feed");
            collected.push(...parseO2Rss(xml, now, venues));
        })
            .catch((err) => {
            sourceErrors.push(`The O2: ${String(err?.message || err)}`);
        }),
        readText(fetchImpl, "https://www.excel.london/whats-on")
            .then((html) => {
            sources.push("ExCeL London whats on");
            collected.push(...parseExcelWhatsOn(html, now, venues));
        })
            .catch((err) => {
            sourceErrors.push(`ExCeL: ${String(err?.message || err)}`);
        }),
        readText(fetchImpl, "https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=133616")
            .then((text) => {
            sources.push("Tottenham next fixture");
            collected.push(...parseSportsDbEvents(JSON.parse(text), now, venues));
        })
            .catch((err) => {
            sourceErrors.push(`Allianz fixtures: ${String(err?.message || err)}`);
        }),
    ];
    jobs.push(readText(fetchImpl, "https://www.wembleystadium.com/events")
        .then(async (listing) => {
        sources.push("Wembley Stadium events");
        const paths = parseWembleyListingPaths(listing).slice(0, 8);
        const pages = await Promise.allSettled(paths.map(async (path) => {
            const url = `https://www.wembleystadium.com${path}`;
            const html = await readText(fetchImpl, url);
            return parseWembleyEventPage(html, url, now, venues);
        }));
        for (const page of pages) {
            if (page.status === "fulfilled" && page.value)
                collected.push(page.value);
        }
    })
        .catch((err) => {
        sourceErrors.push(`Wembley: ${String(err?.message || err)}`);
    }));
    await Promise.all(jobs);
    const events = annotateWhatsOn(dedupeEvents(collected).slice(0, exports.WHATS_ON_LIMIT), input.groups || [], now);
    return {
        events,
        calendars: exports.VENUE_CALENDARS.map((row) => ({ ...row })),
        sources,
        sourceErrors,
        fetchedAt: now.toISOString(),
        copyText: whatsOnCopyText(events, now),
    };
}
