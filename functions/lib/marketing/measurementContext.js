"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehicleTypeParam = vehicleTypeParam;
exports.journeyTypeParam = journeyTypeParam;
exports.routeCategoryFromText = routeCategoryFromText;
exports.bookingSourceParam = bookingSourceParam;
exports.campaignParamsFromAttribution = campaignParamsFromAttribution;
exports.measurementContextFromBooking = measurementContextFromBooking;
exports.applyMeasurementContext = applyMeasurementContext;
exports.hasUsefulCampaignContext = hasUsefulCampaignContext;
const ROUTE_RULES = [
    { id: 'heathrow', test: (text) => /\bheathrow\b/.test(text) || /\blhr\b/.test(text) },
    { id: 'gatwick', test: (text) => /\bgatwick\b/.test(text) || /\blgw\b/.test(text) },
    { id: 'stansted', test: (text) => /\bstansted\b/.test(text) || /\bstn\b/.test(text) },
    { id: 'luton', test: (text) => /\bluton\b/.test(text) || /\bltn\b/.test(text) },
    { id: 'birmingham', test: (text) => /\bbirmingham\s+airport\b/.test(text) || /\bbhx\b/.test(text) },
    { id: 'london_city', test: (text) => /\blondon\s+city\b/.test(text) || /\blcy\b/.test(text) },
    { id: 'bristol', test: (text) => /\bbristol\s+airport\b/.test(text) || /\bbrs\b/.test(text) },
    { id: 'cotswolds', test: (text) => /\bcotswolds?\b/.test(text) },
];
function isGoogleAdsLabel(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    return raw === 'google_ads' || raw === 'google_advert' || raw === 'googleadvert';
}
function cleanCampaignValue(value) {
    if (typeof value !== 'string')
        return undefined;
    const text = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _+.|-]{0,79}$/.test(text))
        return undefined;
    if (/@|\d{6,}|https?:|www\.|[<>]/i.test(text))
        return undefined;
    return text;
}
function cleanLandingPath(value) {
    if (typeof value !== 'string')
        return undefined;
    const path = value.trim();
    if (!/^\/[a-z0-9/_-]{0,120}$/i.test(path))
        return undefined;
    if (path
        .split('/')
        .some((part) => part.includes('@') ||
        /\d{6,}/.test(part) ||
        (part.length >= 16 && /[a-z]/i.test(part) && /\d/.test(part)))) {
        return undefined;
    }
    return path;
}
function touchHasCampaign(touch) {
    if (!touch)
        return false;
    return Boolean(touch.gclid ||
        touch.gbraid ||
        touch.wbraid ||
        touch.utmSource ||
        touch.utmMedium ||
        touch.utmCampaign ||
        touch.utmContent ||
        touch.utmTerm ||
        touch.referrerHost);
}
function vehicleTypeParam(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'standard' || raw === '8_seater' || raw === 'executive')
        return raw;
    if (raw === '8-seater' || raw === '8 seater' || raw === 'vito')
        return '8_seater';
    return undefined;
}
function journeyTypeParam(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'return' || raw === 'round_trip' || raw === 'round-trip')
        return 'return';
    if (raw === 'cotswolds' || raw === 'cotswold')
        return 'cotswolds';
    if (raw === 'one_way' || raw === 'one-way' || raw === 'oneway' || raw === 'single')
        return 'one_way';
    return undefined;
}
function routeCategoryFromText(...parts) {
    const text = parts
        .map((part) => String(part || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' | ');
    if (!text)
        return undefined;
    for (const rule of ROUTE_RULES) {
        if (rule.test(text))
            return rule.id;
    }
    if (/\bairport\b/.test(text) || /\bterminal\s*[0-9a-z]\b/.test(text))
        return 'other_airport';
    return 'other';
}
function bookingSourceParam(attribution, booking = {}) {
    if (attribution?.gclid ||
        attribution?.gbraid ||
        attribution?.wbraid ||
        (attribution?.paidClick &&
            (attribution.paidClick.gclid || attribution.paidClick.gbraid || attribution.paidClick.wbraid))) {
        return 'verified_ads';
    }
    if (isGoogleAdsLabel(booking.staffReportedSource) ||
        isGoogleAdsLabel(booking.customerReportedSource) ||
        isGoogleAdsLabel(booking.heardAbout)) {
        return 'likely_ads';
    }
    return 'other';
}
function campaignTouch(attribution) {
    return attribution.paidClick || attribution.latest || attribution.first;
}
/** Safe campaign fields for reporting. Never includes click ids, names or contact details. */
function campaignParamsFromAttribution(attribution) {
    if (!attribution)
        return {};
    const touch = campaignTouch(attribution);
    const out = {};
    const source = cleanCampaignValue(touch?.utmSource);
    const medium = cleanCampaignValue(touch?.utmMedium);
    const campaign = cleanCampaignValue(touch?.utmCampaign);
    const landing = cleanLandingPath(touch?.landingPath);
    if (source)
        out.campaign_source = source;
    if (medium)
        out.campaign_medium = medium;
    if (campaign)
        out.campaign_name = campaign;
    if (landing)
        out.landing_page = landing;
    return out;
}
function measurementContextFromBooking(booking, attribution = null) {
    const context = {
        ...campaignParamsFromAttribution(attribution || undefined),
    };
    const vehicle = vehicleTypeParam(booking.vehicleType || booking.vehicle);
    if (vehicle)
        context.vehicle_type = vehicle;
    const journey = journeyTypeParam(booking.journeyType || booking.journey);
    if (journey)
        context.journey_type = journey;
    const route = routeCategoryFromText(booking.websiteLandingPath, booking.pickupLocation, booking.pickup, booking.destination, booking.returnPickupLocation, booking.returnDestination, booking.collectionLocation);
    if (route)
        context.route_category = route;
    context.booking_source = bookingSourceParam(attribution, booking);
    return context;
}
/** Merge allowlisted context keys onto an event params object. */
function applyMeasurementContext(params, context) {
    if (!context)
        return params;
    const next = { ...params };
    if (context.vehicle_type)
        next.vehicle_type = context.vehicle_type;
    if (context.route_category && /^[a-z0-9_]{1,40}$/.test(context.route_category)) {
        next.route_category = context.route_category;
    }
    if (context.journey_type)
        next.journey_type = context.journey_type;
    if (context.booking_source)
        next.booking_source = context.booking_source;
    if (context.campaign_source)
        next.campaign_source = context.campaign_source;
    if (context.campaign_medium)
        next.campaign_medium = context.campaign_medium;
    if (context.campaign_name)
        next.campaign_name = context.campaign_name;
    if (context.landing_page)
        next.landing_page = context.landing_page;
    return next;
}
function hasUsefulCampaignContext(attribution) {
    if (!attribution)
        return false;
    return Boolean(attribution.gclid ||
        attribution.gbraid ||
        attribution.wbraid ||
        touchHasCampaign(attribution.paidClick) ||
        touchHasCampaign(attribution.latest) ||
        touchHasCampaign(attribution.first));
}
