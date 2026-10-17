/**
 * Approved indicative Standard Car ranges.
 * Oxford city centre to the town or village centre, one way.
 * These are guidance for regional pages only. They are not booking calculator fares.
 */
export const APPROVED_RANGES = [
  ["Abingdon", 20, 35, "/abingdon-taxis"],
  ["Didcot", 35, 55, "/didcot-taxis"],
  ["Wantage", 40, 60, "/wantage-taxis"],
  ["Grove", 40, 65, "/grove-taxis"],
  ["Wallingford", 35, 55, "/wallingford-taxis"],
  ["Benson", 35, 55, null],
  ["Dorchester-on-Thames", 25, 45, null],
  ["Thame", 35, 55, "/thame-taxis"],
  ["Henley-on-Thames", 55, 85, "/henley-on-thames-taxis"],
  ["Chalgrove", 30, 50, null],
  ["Watlington", 40, 60, null],
  ["Wheatley", 20, 35, null],
  ["Eynsham", 20, 35, null],
  ["Long Hanborough", 25, 40, null],
  ["Bampton", 40, 60, null],
  ["Witney", 35, 55, "/witney-taxis"],
  ["Carterton", 45, 65, "/carterton-taxis"],
  ["Burford", 45, 70, null],
  ["Charlbury", 35, 55, null],
  ["Chipping Norton", 50, 75, "/chipping-norton-taxis"],
  ["Woodstock", 30, 45, "/woodstock-taxis"],
  ["Bicester", 35, 55, "/bicester-taxis"],
  ["Kidlington", 18, 30, "/kidlington-taxis"],
  ["Banbury", 45, 70, "/banbury-to-oxford-taxi"],
  ["Deddington", 40, 60, null],
  ["Adderbury", 50, 70, null],
  ["Hook Norton", 55, 80, null],
  ["Reading", 75, 105, null],
  ["Central London", 130, 180, null],
];

export function rangeFor(name) {
  const row = APPROVED_RANGES.find((r) => r[0] === name);
  if (!row) throw new Error(`Missing approved range for ${name}`);
  return { name: row[0], low: row[1], high: row[2], href: row[3] };
}

export function rangeText(name) {
  const { low, high } = rangeFor(name);
  return `£${low}–£${high}`;
}

const PAGES = [
  {
    slug: "banbury-to-oxford-taxi",
    name: "Banbury",
    journey: [
      "Banbury is about 23 miles north of Oxford on the M40. People book this run for Oxford station, the John Radcliffe and other hospitals, the universities, and for work in the city while living in Banbury.",
      "We collect from home addresses, Banbury station, Castle Quay, hotels and business parks. Send the exact point. A pickup on the edge of town, or an early start when no car is already nearby, can change the quote.",
    ],
    minutes: "In normal traffic, allow about 35 to 45 minutes.",
    nearby: [
      ["Deddington", "A separate quote from the village, not the Banbury town centre range."],
      ["Adderbury", "South of Banbury. Quoted from the address you give us."],
      ["Hook Norton", "Further west. The indicative range is higher because of the extra distance."],
    ],
    links: [
      ["/bicester-taxis", "Bicester taxis"],
      ["/kidlington-taxis", "Kidlington taxis"],
      ["/chipping-norton-taxis", "Chipping Norton taxis"],
    ],
  },
  {
    slug: "bicester-taxis",
    name: "Bicester",
    journey: [
      "Bicester covers the town centre, Bicester Village outlet, and the stations at Bicester North and Bicester Village. Those are different addresses, so a shopping trip and a station pickup are quoted from the point you actually need.",
      "Journeys into Oxford are common for the hospitals, the universities, Oxford station and evening returns after shopping. We also collect from home addresses in the town and from nearby villages when you send the postcode.",
    ],
    minutes: "Oxford to Bicester is often around 30 to 40 minutes, depending on the ring road and the time of day.",
    nearby: [],
    links: [
      ["/banbury-to-oxford-taxi", "Banbury taxis"],
      ["/kidlington-taxis", "Kidlington taxis"],
      ["/thame-taxis", "Thame taxis"],
    ],
  },
  {
    slug: "kidlington-taxis",
    name: "Kidlington",
    journey: [
      "Kidlington sits just north of Oxford, so many bookings are short runs into the city, to Oxford Parkway, or out to the hospitals and colleges. Gosford, Yarnton and the streets towards the A34 are all part of the same area, but the exact address still sets the fare.",
      "London Oxford Airport is a separate journey from a town centre hop into Oxford. Tell us which terminal or entrance you need. Published Heathrow and Gatwick fares on this website do not apply to that local airport.",
    ],
    minutes: "A typical run between Kidlington and central Oxford is often about 15 to 25 minutes.",
    nearby: [],
    links: [
      ["/oxford-taxis", "Oxford taxis"],
      ["/woodstock-taxis", "Woodstock taxis"],
      ["/bicester-taxis", "Bicester taxis"],
    ],
  },
  {
    slug: "didcot-taxis",
    name: "Didcot",
    journey: [
      "Didcot Parkway is a regular pickup for train connections, along with home addresses in the town, Milton Park and workplaces around the old power station site. Oxford bookings are often for the hospitals, the universities or Oxford station.",
      "Great Western trains make Didcot an interchange. If you need the car to meet a train, send the arrival time and say whether you want the station or a home address.",
    ],
    minutes: "Didcot to Oxford is often about 25 to 40 minutes, depending on the A34.",
    nearby: [],
    links: [
      ["/abingdon-taxis", "Abingdon taxis"],
      ["/wallingford-taxis", "Wallingford taxis"],
      ["/wantage-taxis", "Wantage taxis"],
    ],
    airportHref: "/didcot-airport-transfers",
  },
  {
    slug: "wallingford-taxis",
    name: "Wallingford",
    journey: [
      "Wallingford is a market town on the Thames. Typical Oxford journeys are for hospital appointments, the universities, Oxford station and evenings in the city. We collect from the market place, riverside addresses and residential streets.",
      "The nearest mainline station is usually Didcot Parkway or a direct car into Oxford. Tell us which you need. A village pickup outside the town centre is quoted on its own.",
    ],
    minutes: "Wallingford to Oxford is often about 30 to 45 minutes.",
    nearby: [
      ["Benson", "On the way towards the A4074. Use the Benson range, not the Wallingford figure, when that is the pickup."],
      ["Dorchester-on-Thames", "Closer to Oxford than Wallingford. It has its own indicative range."],
    ],
    links: [
      ["/didcot-taxis", "Didcot taxis"],
      ["/abingdon-taxis", "Abingdon taxis"],
      ["/thame-taxis", "Thame taxis"],
    ],
    airportHref: "/wallingford-airport-transfers",
  },
  {
    slug: "thame-taxis",
    name: "Thame",
    journey: [
      "Thame town centre, the cattle market area and the residential streets towards the bypass are the usual pickups. Oxford journeys are often for the hospitals, the universities, Oxford station and evening returns.",
      "Haddenham and Thame Parkway is the nearby station. If the train station is the pickup or drop off, say so. It is not the same quote as Thame town centre.",
    ],
    minutes: "Thame to Oxford is often about 30 to 45 minutes via the A418 or the M40.",
    nearby: [
      ["Wheatley", "Closer to Oxford, on the A40. It has a lower indicative range than Thame."],
      ["Chalgrove", "Between Oxford and Thame. Quoted from the village, not as a Thame town fare."],
      ["Watlington", "Towards the Chilterns. Further out, so the indicative range is separate."],
    ],
    links: [
      ["/bicester-taxis", "Bicester taxis"],
      ["/wallingford-taxis", "Wallingford taxis"],
      ["/henley-on-thames-taxis", "Henley-on-Thames taxis"],
    ],
    airportHref: "/thame-airport-transfers",
  },
  {
    slug: "henley-on-thames-taxis",
    name: "Henley-on-Thames",
    journey: [
      "Henley-on-Thames sits on the river, south east of Oxford. Bookings are often for Oxford station, the hospitals, the universities, or a direct run onwards to an airport. During regatta week the roads are busier, so book earlier and send the exact address.",
      "Henley station and the town centre are different pickups. Residential roads towards Shiplake or the fairmile can also change the journey. We quote the address you give us.",
    ],
    minutes: "Henley-on-Thames to Oxford is often about 45 to 70 minutes, depending on the route and traffic.",
    nearby: [],
    links: [
      ["/wallingford-taxis", "Wallingford taxis"],
      ["/thame-taxis", "Thame taxis"],
      ["/didcot-taxis", "Didcot taxis"],
    ],
  },
  {
    slug: "abingdon-taxis",
    name: "Abingdon",
    journey: [
      "Abingdon to Oxford is a regular south Oxfordshire run: the town centre, the precinct, residential streets, and journeys connected with Culham and Radley. Radley is the nearest railway station. Culham Science Centre is a workplace pickup and is quoted from that address, not assumed to match the town centre range.",
      "Oxford destinations are often the hospitals, the universities, Oxford station and the city centre. An early morning airport connection is quoted separately from this local range.",
    ],
    minutes: "Abingdon to central Oxford is often about 20 to 35 minutes.",
    nearby: [],
    links: [
      ["/didcot-taxis", "Didcot taxis"],
      ["/wantage-taxis", "Wantage taxis"],
      ["/oxford-taxis", "Oxford taxis"],
    ],
    airportHref: "/abingdon-airport-transfers",
  },
  {
    slug: "wantage-taxis",
    name: "Wantage",
    journey: [
      "Wantage market place and the residential streets around Charlton and the new estates are the usual pickups. Oxford journeys are often for the hospitals, the universities and Oxford station. Grove is next door and has its own range.",
      "There is no mainline station in the town. If you want Didcot Parkway or Oxford station, say which one. We quote the full address rather than a flat town fare.",
    ],
    minutes: "Wantage to Oxford is often about 35 to 50 minutes.",
    nearby: [],
    links: [
      ["/grove-taxis", "Grove taxis"],
      ["/didcot-taxis", "Didcot taxis"],
      ["/abingdon-taxis", "Abingdon taxis"],
    ],
    airportHref: "/wantage-airport-transfers",
  },
  {
    slug: "grove-taxis",
    name: "Grove",
    journey: [
      "Grove is immediately east of Wantage, with its own streets, the airfield housing and the road towards Didcot. Because it is not the same pickup as Wantage town centre, it has its own indicative range.",
      "Oxford bookings from Grove are often for the hospitals, the universities and the stations. Send the house address. A pickup on the Wantage side of the boundary can be quoted differently.",
    ],
    minutes: "Grove to Oxford is often about 35 to 55 minutes.",
    nearby: [],
    links: [
      ["/wantage-taxis", "Wantage taxis"],
      ["/didcot-taxis", "Didcot taxis"],
      ["/abingdon-taxis", "Abingdon taxis"],
    ],
  },
  {
    slug: "witney-taxis",
    name: "Witney",
    journey: [
      "Witney is the main town on the A40 west of Oxford. We collect from the High Street and Woolgate area, Windrush Place, and home addresses across the town. Oxford bookings are often for the hospitals, the universities, Oxford station and evening returns.",
      "The nearest station is Hanborough, which has its own range when that is the actual pickup. A Witney town centre fare is not automatically the fare from an outlying village.",
    ],
    minutes: "Witney to central Oxford is often about 30 to 45 minutes via the A40.",
    nearby: [
      ["Eynsham", "Closer to Oxford on the A40. Lower indicative range than Witney."],
      ["Long Hanborough", "Includes the station area. Quoted separately from Witney town."],
      ["Bampton", "South of Witney. Use the Bampton range for that village."],
      ["Burford", "Further west on the A40. Higher indicative range."],
    ],
    links: [
      ["/carterton-taxis", "Carterton taxis"],
      ["/woodstock-taxis", "Woodstock taxis"],
      ["/oxford-taxis", "Oxford taxis"],
    ],
    airportHref: "/witney-airport-transfers",
  },
  {
    slug: "carterton-taxis",
    name: "Carterton",
    journey: [
      "Carterton is west of Witney. We collect from home addresses and the town streets. If a pickup is inside RAF Brize Norton, tell us the gate and the access rules with the enquiry. We cannot assume a car can enter a military site.",
      "Oxford journeys pass Witney and the A40. The indicative range is for a typical town centre run, not for every address on the airfield side.",
    ],
    minutes: "Carterton to Oxford is often about 40 to 55 minutes.",
    nearby: [],
    links: [
      ["/witney-taxis", "Witney taxis"],
      ["/woodstock-taxis", "Woodstock taxis"],
      ["/oxford-taxis", "Oxford taxis"],
    ],
    airportHref: "/carterton-airport-transfers",
  },
  {
    slug: "woodstock-taxis",
    name: "Woodstock",
    journey: [
      "Woodstock town and Blenheim Palace are the usual pickups. A palace entrance and a High Street address are not the same place, especially on event days. Send the exact point and the time you need to be collected.",
      "Oxford journeys use the A44. People book for the hospitals, the universities, Oxford station and evenings in the city. Nearby Charlbury, including the station, has its own range.",
    ],
    minutes: "Woodstock to central Oxford is often about 20 to 35 minutes.",
    nearby: [
      ["Charlbury", "North of Woodstock, with its own station. Quoted separately."],
    ],
    links: [
      ["/kidlington-taxis", "Kidlington taxis"],
      ["/witney-taxis", "Witney taxis"],
      ["/chipping-norton-taxis", "Chipping Norton taxis"],
    ],
  },
  {
    slug: "chipping-norton-taxis",
    name: "Chipping Norton",
    journey: [
      "Chipping Norton is in the north of Oxfordshire, so the journey into Oxford is longer than the towns on the ring road. Typical reasons are hospital appointments, the universities, Oxford station and travel onwards to an airport.",
      "We collect from the town centre and from home addresses. Villages around the town are quoted from the postcode. The indicative range is for a typical run between the town centre and Oxford city centre.",
    ],
    minutes: "Chipping Norton to Oxford is often about 45 to 65 minutes.",
    nearby: [],
    links: [
      ["/banbury-to-oxford-taxi", "Banbury taxis"],
      ["/woodstock-taxis", "Woodstock taxis"],
      ["/witney-taxis", "Witney taxis"],
    ],
  },
];

export const REGIONAL_PAGES = PAGES.map((page) => ({
  ...page,
  ...rangeFor(page.name),
  nearby: (page.nearby || []).map(([name, note]) => ({ ...rangeFor(name), note })),
}));
