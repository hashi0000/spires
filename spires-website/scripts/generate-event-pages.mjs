/**
 * Writes the permanent event venue pages. Run once after copy changes:
 * node scripts/generate-event-pages.mjs
 * Prices stay "quote on request". Do not add fixture dates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://www.spires-taxis.com';

function escText(value) {
  return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escAttr(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function strip(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const venues = [
  {
    slug: 'oxford-to-lords-cricket-ground',
    page: 'lords',
    crumb: "Lord's",
    title: "Oxford to Lord's Cricket Ground Taxi | Spires Taxis",
    description: "Private hire from Oxford to Lord's Cricket Ground in St John's Wood. Standard Car or 8 Seater, one way or return. The fare is quoted for your match date.",
    h1: "Oxford to Lord's Cricket Ground taxi",
    lead: "A pre booked car from Oxford to Lord's, the MCC ground in St John's Wood, for the date on your ticket. The fare is quoted before you travel.",
    destination: "Lord's Cricket Ground, St John's Wood, London",
    venue: "Lord's Cricket Ground",
    locality: 'London',
    placeType: 'StadiumOrArena',
    vehicleNote: "Cricket groups often travel with coats and a bag each. Say how many people are coming so we quote a Standard Car or an 8 Seater with enough room.",
    sections: [
      {
        title: "Lord's from an Oxford address",
        html: `<p>Lord's is in St John's Wood, north west London. People in Oxford use it for Test matches, one day internationals, county cricket and the domestic finals the ground hosts. This page does not list the season. The date that matters is the one printed on your ticket.</p>
        <p>Spires Taxis is a family run private hire operator licensed by Oxford City Council. We are not part of MCC and we are not the ground's own transport. You book the whole vehicle from your pickup, not a seat on a shared coach.</p>
        <p>If the day also includes <a href="/oxford-to-the-oval">The Oval</a>, book that as its own journey. Kennington is on the other side of London, and the two grounds are not one round trip unless you ask us to quote it that way.</p>`
      },
      {
        title: 'One way, or a return after the close of play',
        html: `<p>A one way suits a match where you are staying in London, or someone else is bringing you home. A return is the request we see most often. Tell us the pickup time in Oxford and the time you expect to be ready to leave the ground.</p>
        <p>The return collection is agreed when we quote. We do not leave the car at Lord's through the day unless that waiting is written into the quote you accept. A request on this form is not a confirmed booking.</p>`
      },
      {
        title: "Arriving in St John's Wood",
        html: `<p>The streets around Lord's are residential, and a match day changes which of them can be used. We agree a drop off that the roads allow, rather than naming a gate or a car park. We also do not publish a journey time. The roads that afternoon decide it.</p>
        <p>Other Oxfordshire pickups can be quoted. They are not a second published fare. Vehicle types are on <a href="/our-vehicles">our vehicles</a>, and the full event list is on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-the-oval', 'The Oval', 'Kennington, if the cricket is south of the river.'],
      ['/oxford-to-edgbaston-cricket-ground', 'Edgbaston', 'Warwickshire cricket in Birmingham, not the airport.'],
      ['/long-distance-taxis', 'Long distance taxis', 'Cruise, rail and other journeys from Oxford.']
    ],
    faqs: [
      ["Do you publish an Oxford to Lord's fare?", 'No. A Standard Car and an 8 Seater are both quote on request. We confirm the fare for your date and addresses before you travel.'],
      ['Can the return be after the match?', 'Yes. Send the time you expect to be collected. The meeting point near the ground is agreed with the quote, not at the roadside afterwards.'],
      ['Will you list the next Test at Lord\'s?', 'No. Send the date on your ticket. We do not keep a fixture list on this page.'],
      ['Are you the official taxi for Lord\'s?', 'No. Spires Taxis is an Oxford private hire operator. We are not affiliated with MCC or the ground.']
    ]
  },
  {
    slug: 'oxford-to-the-oval',
    page: 'oval',
    crumb: 'The Oval',
    title: 'Oxford to The Oval Taxi | Spires Taxis',
    description: 'Taxi from Oxford to The Oval in Kennington for international and county cricket. Book the whole vehicle, one way or return. Standard Car and 8 Seater quotes on request.',
    h1: 'Oxford to The Oval taxi',
    lead: "Private hire from Oxford to The Oval in Kennington. International and county cricket, with the fare quoted for the date you send.",
    destination: 'The Oval, Kennington, London',
    venue: 'The Oval',
    locality: 'London',
    placeType: 'StadiumOrArena',
    vehicleNote: 'A family or a group of friends booking The Oval together usually wants one vehicle, so the return is one collection rather than several cars trying to meet.',
    sections: [
      {
        title: 'Kennington, not St John\'s Wood',
        html: `<p>The Oval is in Kennington, south London. It is the Surrey ground, used for international cricket and for county matches. Sponsor names for the ground change, so this page uses The Oval, which is the name customers actually say.</p>
        <p>It is a different booking from <a href="/oxford-to-lords-cricket-ground">Lord's</a>. One is north west London and the other is south of the river. If you need both in the same week, ask for two quotes.</p>
        <p>We collect from an Oxford address, or from another Oxfordshire address when you ask us to price it. The car is yours for the booking. We do not sell single seats.</p>`
      },
      {
        title: 'Out and back on the same request',
        html: `<p>Choose one way if London is where the day ends. Choose return if you want to be collected after the cricket and brought back to Oxford. The expected return time is part of the request, because a day match and a later finish are not the same collection.</p>
        <p>That return stop is agreed when we quote. The vehicle is not held at the ground unless the accepted quote says so. Sending the form asks for a price. It does not confirm the car.</p>`
      },
      {
        title: 'Drop off around Kennington',
        html: `<p>Kennington's streets are managed locally when the ground is full. We agree the drop off for that day. We do not name a gate, a car park, or a journey time from Oxford.</p>
        <p>See <a href="/events">all event transfers</a> for the other cricket grounds, including <a href="/oxford-to-trent-bridge">Trent Bridge</a>. Fleet sizes are on <a href="/our-vehicles">our vehicles</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-lords-cricket-ground', "Lord's", "St John's Wood, when the cricket is there instead."],
      ['/oxford-to-trent-bridge', 'Trent Bridge', 'Nottinghamshire cricket, quoted as its own journey.'],
      ['/contact', 'Contact', 'A ground that does not have its own page yet.']
    ],
    faqs: [
      ['Is The Oval the same quote as Lord\'s?', "No. Lord's is in St John's Wood and The Oval is in Kennington. Each journey is quoted on its own."],
      ['Which name should I use if the sponsor has changed?', 'The Oval is enough. Add the date and your pickup address. You do not need to guess the current sponsor name.'],
      ['Can four of us share a Standard Car?', 'Yes, up to 4 passengers. An 8 Seater takes up to 8. Both are quote on request, for the whole vehicle.'],
      ['Do you wait at the ground?', 'Only if we have quoted that waiting. Otherwise book a return collection at a time you can meet.']
    ]
  },
  {
    slug: 'oxford-to-edgbaston-cricket-ground',
    page: 'edgbaston',
    crumb: 'Edgbaston',
    title: 'Oxford to Edgbaston Cricket Ground Taxi | Spires Taxis',
    description: 'Oxford to Edgbaston Cricket Ground in Birmingham. Pre booked Standard Car or 8 Seater for the match date you send. One way or return, quoted before you travel.',
    h1: 'Oxford to Edgbaston Cricket Ground taxi',
    lead: 'Private hire from Oxford to Edgbaston, Warwickshire\'s cricket ground in Birmingham. The fare is quoted for your match, not taken from the airport price list.',
    destination: 'Edgbaston Cricket Ground, Birmingham',
    venue: 'Edgbaston Cricket Ground',
    locality: 'Birmingham',
    placeType: 'StadiumOrArena',
    vehicleNote: 'Say if you are coming straight from an Oxford college, a hotel or a home address. The quote uses that pickup, not a generic Birmingham fare.',
    sections: [
      {
        title: 'The ground in Birmingham, not the airport',
        html: `<p>Edgbaston is Warwickshire's home ground in Birmingham. Oxford customers use it for international matches and for county cricket. This is not a trip to Birmingham Airport. Airport fares are published on the <a href="/oxford-to-birmingham-airport-taxi">Birmingham Airport</a> page and they do not apply to the cricket ground.</p>
        <p>We are not affiliated with Warwickshire or with the ground. Spires Taxis is licensed in Oxford and the booking starts at your pickup.</p>
        <p>There is no fixture list here. If your tickets are for a particular day, that is the date to send. <a href="/oxford-to-trent-bridge">Trent Bridge</a> is the Nottingham ground, and it needs its own quote.</p>`
      },
      {
        title: 'Coming home the same evening',
        html: `<p>Birmingham traffic on a match day is the reason to agree the return before you go through the turnstiles. Tell us whether you want one way or a return, the outbound pickup time, and the time you expect to be ready afterwards.</p>
        <p>The collection point is part of that quote. We do not promise to hold a car outside the ground for the whole match unless you have asked for waiting and we have priced it.</p>`
      },
      {
        title: 'What we can and cannot say about arrival',
        html: `<p>We can collect you in Oxford and take you to Edgbaston. We cannot publish a gate, a supporters' car park, or a driving time. Access on the day is what the ground and the city allow.</p>
        <p>Groups booking the whole car are on <a href="/our-vehicles">our vehicles</a>. The rest of the event list is on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-birmingham-airport-taxi', 'Birmingham Airport', 'A different destination, with published airport fares.'],
      ['/oxford-to-trent-bridge', 'Trent Bridge', 'Cricket in Nottingham, quoted separately.'],
      ['/oxford-to-utilita-bowl', 'Utilita Bowl', 'Hampshire cricket near Southampton.']
    ],
    faqs: [
      ['Is the Edgbaston fare the same as Birmingham Airport?', 'No. The airport has its own published prices. Edgbaston Cricket Ground is quote on request for a Standard Car or an 8 Seater.'],
      ['Can you collect us in Oxford and drop a bag at a hotel on the way?', 'Ask in the message. An extra stop is only included when we agree it in the quote.'],
      ['Do you publish the next Edgbaston Test date?', 'No. Use the date on your ticket. We do not keep a calendar of fixtures on this page.'],
      ['How many passengers fit?', 'A Standard Car takes up to 4. An 8 Seater takes up to 8. You are booking the vehicle.']
    ]
  },
  {
    slug: 'oxford-to-trent-bridge',
    page: 'trent-bridge',
    crumb: 'Trent Bridge',
    title: 'Oxford to Trent Bridge Taxi | Spires Taxis',
    description: 'Oxford to Trent Bridge for cricket in Nottingham. One way or return in a Standard Car or 8 Seater. The fare and the collection point are agreed when you book.',
    h1: 'Oxford to Trent Bridge taxi',
    lead: 'Private hire from Oxford to Trent Bridge, Nottinghamshire\'s cricket ground in West Bridgford. One way or return, quoted for the date on your ticket.',
    destination: 'Trent Bridge, West Bridgford, Nottingham',
    venue: 'Trent Bridge',
    locality: 'Nottingham',
    placeType: 'StadiumOrArena',
    vehicleNote: 'Nottingham is a long day out from Oxford, so groups usually book the 8 Seater when more than four people want to stay together for the journey home.',
    sections: [
      {
        title: 'West Bridgford, from Oxford',
        html: `<p>Trent Bridge is in West Bridgford, Nottingham. It is Nottinghamshire's ground, used for county cricket and for international matches. Oxford to Nottingham is not a short hop across the city, so the usual booking is the outbound and the return together.</p>
        <p>We do not publish this year's fixtures. Send the date you are actually travelling. If the cricket is at <a href="/oxford-to-edgbaston-cricket-ground">Edgbaston</a> instead, use that page. The two cities are different quotes.</p>
        <p>Spires Taxis is not affiliated with the ground or the county club. The car is a private hire booking from your address.</p>`
      },
      {
        title: 'One way into Nottingham, or a booked return',
        html: `<p>One way is right if you are staying over or continuing elsewhere. A return needs the date, the time you leave Oxford, and the time you expect to be collected in West Bridgford. Those times can be the same day or a later day.</p>
        <p>We agree where the driver meets you on the way back when we quote. The car is not kept at the ground for the afternoon unless that is the arrangement you have accepted.</p>`
      },
      {
        title: 'Arrival without a promised gate',
        html: `<p>We agree a drop off the roads allow that day. We do not name an entrance, a car park, or a journey time from Oxford. Match days change the approaches to the ground.</p>
        <p>Passenger numbers decide the vehicle. See <a href="/our-vehicles">our vehicles</a>, or start from the <a href="/events">events hub</a> if you are still choosing a ground.</p>`
      }
    ],
    related: [
      ['/oxford-to-edgbaston-cricket-ground', 'Edgbaston', 'Birmingham cricket, kept separate from the airport.'],
      ['/oxford-to-lords-cricket-ground', "Lord's", "St John's Wood, when the match is in London."],
      ['/long-distance-taxis', 'Long distance taxis', 'Other booked journeys out of Oxford.']
    ],
    faqs: [
      ['Where exactly is Trent Bridge?', 'The cricket ground is in West Bridgford, Nottingham. Put that on the request if your ticket uses the ground name.'],
      ['Why is there no price on this page?', 'We have not published a fixed Trent Bridge fare. Standard Car and 8 Seater are quote on request for your date and addresses.'],
      ['Can the return be the next morning?', 'Yes. Send the return date and the expected collection time. It stays on the same request.'],
      ['Will the driver know a particular stand?', 'Tell us which side of the ground you can walk to. We still cannot promise a named gate, because access changes.']
    ]
  },
  {
    slug: 'oxford-to-utilita-bowl',
    page: 'utilita-bowl',
    crumb: 'Utilita Bowl',
    title: 'Oxford to Utilita Bowl Taxi | Spires Taxis',
    description: 'Oxford to the Utilita Bowl, the Hampshire ground near Southampton. Quote a Standard Car or 8 Seater for the date on your ticket, one way or as a return.',
    h1: 'Oxford to Utilita Bowl taxi',
    lead: 'Private hire from Oxford to the Utilita Bowl at West End, near Southampton. Hampshire cricket, quoted for the date on your ticket.',
    destination: 'Utilita Bowl, West End, near Southampton',
    venue: 'Utilita Bowl',
    locality: 'Southampton',
    placeType: 'StadiumOrArena',
    vehicleNote: 'Short format matches can finish later than a day of championship cricket. The return time you send should be the time you can actually meet the driver, not the first ball.',
    sections: [
      {
        title: 'The Hampshire ground, formerly the Rose Bowl',
        html: `<p>The Utilita Bowl is Hampshire's cricket ground at West End, on the edge of Southampton. For years it was widely called the Rose Bowl. This page uses the current ground name, and a quote request that says Rose Bowl still reaches us.</p>
        <p>It is cricket, not a cruise. Southampton's cruise terminals have a separate page, <a href="/oxford-to-southampton-cruise-terminal">Oxford to Southampton Cruise Terminal</a>. Do not use the ship booking if you are going to the ground, and do not use this page for a sailing.</p>
        <p>We do not list the international or domestic fixtures. Send the date on the ticket. We are not affiliated with Hampshire or with the ground.</p>`
      },
      {
        title: 'One way to West End, or a return to Oxford',
        html: `<p>Choose one way or return on the form. A return should include the expected collection time after the match. Day matches and later finishes need different pickup times, so we do not guess one for you.</p>
        <p>The collection point is agreed in the quote. We do not hold the vehicle at the ground unless you have asked for that and accepted the price.</p>`
      },
      {
        title: 'What we will not invent about the drive',
        html: `<p>We will not publish a journey time, a car park name, or a gate. Event traffic around West End is managed on the day. We agree a drop off that those roads allow.</p>
        <p>An 8 Seater is the group option, up to 8 passengers. A Standard Car takes up to 4. Both are quote on request. The other grounds are listed under cricket on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-southampton-cruise-terminal', 'Southampton cruise terminal', 'A different Southampton journey, for ships rather than cricket.'],
      ['/oxford-to-edgbaston-cricket-ground', 'Edgbaston', 'Warwickshire cricket in Birmingham.'],
      ['/oxford-to-the-oval', 'The Oval', 'Kennington, if the match is in London.']
    ],
    faqs: [
      ['Is the Rose Bowl the same ground?', 'It is the earlier name for the Hampshire ground at West End. The current name we use is the Utilita Bowl. Either name is clear on a quote request.'],
      ['Does the Southampton cruise price cover the cricket?', 'No. Cruise terminals and the Utilita Bowl are different destinations. This ground is quote on request.'],
      ['Can you book the return if the match might finish late?', 'Send the time you expect to be ready. If that changes, contact us. We do not promise a car sitting at the ground.'],
      ['Is there a published journey time from Oxford?', 'No. We do not print a driving time for this route.']
    ]
  },
  {
    slug: 'oxford-to-wembley-stadium',
    page: 'wembley',
    crumb: 'Wembley',
    title: 'Oxford to Wembley Stadium Taxi | Spires Taxis',
    description: 'Oxford to Wembley Stadium for football or a concert. Book a Standard Car or 8 Seater, one way or return. The fare is quoted for the event date you send.',
    h1: 'Oxford to Wembley Stadium taxi',
    lead: 'Private hire from Oxford to Wembley Stadium for football or a concert. One page covers both. The fare is quoted for the event date you send.',
    destination: 'Wembley Stadium, London',
    venue: 'Wembley Stadium',
    locality: 'London',
    placeType: 'StadiumOrArena',
    vehicleNote: 'Football groups and concert groups ask for the same two vehicles. The difference is the finish time you send, not a separate Wembley product.',
    sections: [
      {
        title: 'Football and concerts on one booking page',
        html: `<p>Wembley Stadium is in Wembley, London. It holds football matches and large concerts. We have not split those into two websites, because the journey from Oxford is the same road and the fare depends on the date, the vehicle and whether you need the return.</p>
        <p>We do not publish a club fixture list or a concert calendar. Send the event name and the date on your ticket. We are not affiliated with the stadium, the FA, or any promoter.</p>
        <p>Other football grounds do not have their own pages. Name the ground on the <a href="/contact">contact form</a> and we will quote that journey instead.</p>`
      },
      {
        title: 'Getting there, and getting back to Oxford',
        html: `<p>A one way drop is enough if you are staying in London. A return should include the time you expect to leave the stadium. Concert finishes and full time are both estimates when you book, so send the time you can meet rather than the scheduled kick off or the stage time.</p>
        <p>The return collection is agreed when we quote. The car is not held at Wembley through the event unless that waiting is in the accepted quote. The form is a request, not a confirmation.</p>`
      },
      {
        title: 'Wembley Way, without a promised entrance',
        html: `<p>Wembley Way is busy when the stadium is full, and the roads around it change with the event. We agree a drop off the roads allow that day. We do not promise a named gate, a car park, or a journey time from Oxford.</p>
        <p>Book the whole Standard Car or <a href="/our-vehicles">8 Seater</a>. Concerts at <a href="/oxford-to-the-o2-arena">The O2</a> and <a href="/oxford-to-alexandra-palace">Alexandra Palace</a> are separate pages.</p>`
      }
    ],
    related: [
      ['/oxford-to-the-o2-arena', 'The O2', 'Arena shows on the Greenwich Peninsula.'],
      ['/oxford-to-alexandra-palace', 'Alexandra Palace', 'Muswell Hill concerts, darts and exhibitions.'],
      ['/events', 'All events', 'Cricket, racing, rugby and the rest of the list.']
    ],
    faqs: [
      ['Is a Wembley concert a different fare from a football match?', 'Each date is quoted. There is not a football price and a concert price printed on this page. Tell us which event it is.'],
      ['Can you meet us on Wembley Way?', 'We will not promise a pin on Wembley Way. The drop off and the return collection are agreed for the roads that are open that day.'],
      ['Do you list upcoming Wembley events?', 'No. Send the date on your ticket. We do not copy a fixtures or listings calendar onto this page.'],
      ['What if our match is not at Wembley?', 'Use the contact form and name the ground. Only Wembley has a football page.']
    ]
  },
  {
    slug: 'oxford-to-cheltenham-racecourse',
    page: 'cheltenham-races',
    crumb: 'Cheltenham',
    title: 'Oxford to Cheltenham Racecourse Taxi | Spires Taxis',
    description: 'Oxford to Cheltenham Racecourse at Prestbury Park. Standard Car or 8 Seater, one way or return. The fare is quoted for your raceday, including Festival week.',
    h1: 'Oxford to Cheltenham Racecourse taxi',
    lead: 'Private hire from Oxford to Cheltenham Racecourse at Prestbury Park. The Festival is the meeting people ask about most. The fare is quoted for your raceday.',
    destination: 'Cheltenham Racecourse, Prestbury Park, Cheltenham',
    venue: 'Cheltenham Racecourse',
    locality: 'Cheltenham',
    placeType: 'SportsActivityLocation',
    vehicleNote: 'If more than four of you are going, ask for the 8 Seater when the raceday is fixed. The quote is for that vehicle, not a seat on a coach.',
    sections: [
      {
        title: 'Prestbury Park, without a race card',
        html: `<p>Cheltenham Racecourse is at Prestbury Park in Cheltenham. The Festival, usually held in March, is the meeting most Oxford customers ask about. The course also races on other days through the jumps season. This page does not print those dates. Your raceday is the date you send.</p>
        <p>We are not affiliated with the racecourse. Dress codes and badges are between you and the course. We need the pickup, the passenger count, and whether the car is coming back.</p>
        <p><a href="/oxford-to-ascot-racecourse">Ascot</a> is a separate racecourse and a separate quote. <a href="/oxford-to-silverstone-taxi">Silverstone</a> is motorsport, not a raceday.</p>`
      },
      {
        title: 'One way to the course, or back to Oxford after the last',
        html: `<p>Some groups go one way because they are staying in Cheltenham. Most want a return to Oxford the same evening. Send the time you need to leave Oxford and the time you expect to be ready to leave Prestbury Park.</p>
        <p>That collection is agreed when we quote. We do not keep the vehicle on the course all afternoon unless you have asked for waiting and we have priced it. A form submission is a request, not a confirmed car.</p>`
      },
      {
        title: 'Arrival on a raceday',
        html: `<p>Festival week and other busy racedays change the roads into Prestbury Park. We agree a drop off for that day. We do not promise a particular car park, an owners' entrance, or a driving time from Oxford.</p>
        <p>You book the vehicle. A Standard Car takes up to 4 passengers and an 8 Seater takes up to 8. See <a href="/our-vehicles">our vehicles</a> and the racing section on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-ascot-racecourse', 'Ascot', 'Royal Ascot and the other racedays in Berkshire.'],
      ['/oxford-to-silverstone-taxi', 'Silverstone', 'Motorsport at the circuit, quoted for the date.'],
      ['/events', 'All events', 'Cricket, rugby, concerts and the other venues.']
    ],
    faqs: [
      ['Do you publish Cheltenham Festival dates?', 'No. The Festival is usually in March, but the raceday on your ticket is the date to send. We do not print a race programme.'],
      ['Is there a fixed Oxford to Cheltenham fare?', 'Not on this page. Standard Car and 8 Seater are quote on request for the addresses and the date.'],
      ['Can you drop us at a named car park?', 'We will not promise one. Tell us if you already know a meeting point the course has given you, and we will say whether we can use it that day.'],
      ['Can the return be a different day?', 'Yes. Send the return date and the expected collection time on the same request.']
    ]
  },
  {
    slug: 'oxford-to-ascot-racecourse',
    page: 'ascot',
    crumb: 'Ascot',
    title: 'Oxford to Ascot Racecourse Taxi | Spires Taxis',
    description: 'Oxford to Ascot Racecourse for Royal Ascot and other racedays. Book the whole Standard Car or 8 Seater. One way or return, quoted before you travel.',
    h1: 'Oxford to Ascot Racecourse taxi',
    lead: 'Private hire from Oxford to Ascot Racecourse in Berkshire. Royal Ascot is the meeting most people book. Other racedays are quoted the same way, from the date you send.',
    destination: 'Ascot Racecourse, Ascot, Berkshire',
    venue: 'Ascot Racecourse',
    locality: 'Ascot',
    placeType: 'SportsActivityLocation',
    vehicleNote: 'If you are carrying hats or extra bags, say so. That can be the reason to quote an 8 Seater even when the passenger count would fit a Standard Car.',
    sections: [
      {
        title: 'Ascot in Berkshire, from Oxford',
        html: `<p>Ascot Racecourse is in Ascot, Berkshire. Royal Ascot, usually held in June, is the meeting we are asked for most. The course also races on many other days. None of those dates are listed here, because a wrong calendar is worse than none. Send the date on your ticket.</p>
        <p>We are not affiliated with Ascot Racecourse. Enclosure rules and dress codes are yours to check with the course. Our job is the car from Oxford and, if you want it, the car back.</p>
        <p>Cheltenham is a different course. Use <a href="/oxford-to-cheltenham-racecourse">Oxford to Cheltenham Racecourse</a> for Prestbury Park.</p>`
      },
      {
        title: 'Out in the morning, back when you are ready',
        html: `<p>A return is the booking that keeps a group together. Tell us the pickup time and the time you expect to leave the racecourse. One way is there if you are not coming back to Oxford with us.</p>
        <p>The return collection point is agreed when we quote. We do not leave the driver in a car park for the whole card unless that waiting has been priced and accepted. The request itself is not a confirmation.</p>`
      },
      {
        title: 'No promised entrance',
        html: `<p>Racedays use different approaches, and Royal Ascot is busier than an ordinary afternoon. We agree the drop off the roads allow. We do not publish a gate, a car park, or a journey time.</p>
        <p>Standard Car up to 4. 8 Seater up to 8. Both quote on request. More venues are on <a href="/events">event transfers</a>, and the cars are described on <a href="/our-vehicles">our vehicles</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-cheltenham-racecourse', 'Cheltenham', 'Prestbury Park, including Festival week.'],
      ['/oxford-to-wembley-stadium', 'Wembley', 'Football and concerts, if the day out is not racing.'],
      ['/long-distance-taxis', 'Long distance taxis', 'Other fixed purpose journeys from Oxford.']
    ],
    faqs: [
      ['Is Royal Ascot the only raceday you cover?', 'No. Any raceday at Ascot can be quoted. Royal Ascot is simply the one most people name. We still need your date.'],
      ['Why is June mentioned if you will not list the dates?', 'Royal Ascot is usually held in June. The exact days change by year, so they are not printed here.'],
      ['Can six of us book one car?', 'That is an 8 Seater, up to 8 passengers. A Standard Car stops at 4. The fare is quote on request either way.'],
      ['Will you use the main public car park?', 'Only if that is possible on the day and we have agreed it. We do not promise an entrance in advance.']
    ]
  },
  {
    slug: 'oxford-to-alexandra-palace',
    page: 'alexandra-palace',
    crumb: 'Alexandra Palace',
    title: 'Oxford to Alexandra Palace Taxi | Spires Taxis',
    description: 'Oxford to Alexandra Palace in Muswell Hill for concerts, darts and exhibitions. Standard Car or 8 Seater, one way or return, quoted for the date on your ticket.',
    h1: 'Oxford to Alexandra Palace taxi',
    lead: 'Private hire from Oxford to Alexandra Palace in Muswell Hill. Concerts, darts and exhibitions, quoted for the date on your ticket.',
    destination: 'Alexandra Palace, Muswell Hill, London',
    venue: 'Alexandra Palace',
    locality: 'London',
    placeType: 'EventVenue',
    vehicleNote: 'Darts crowds and concert crowds leave at different speeds. The return time is your best estimate of when the group will be at the agreed meeting point.',
    sections: [
      {
        title: 'The palace in Muswell Hill',
        html: `<p>Alexandra Palace is in Muswell Hill, north London, set in its own park. Oxford customers book it for concerts, for darts, and for exhibitions. Those are different nights, but they are the same kind of booking: a pre booked car to the palace and, usually, a car home.</p>
        <p>We do not publish the show calendar. Promoters change listings, and a date we copied would go stale. Send the name of the event and the date on the ticket.</p>
        <p>We are not affiliated with Alexandra Palace or with any promoter. <a href="/oxford-to-the-o2-arena">The O2</a> and <a href="/oxford-to-wembley-stadium">Wembley</a> have their own pages when the ticket is for those buildings.</p>`
      },
      {
        title: 'One way in, or a return after the show',
        html: `<p>Choose one way if you are staying in London. Choose return if Oxford is home that night. The form asks for the outbound pickup time and, for a return, the time you expect to be collected. Late shows need a later collection than a matinee.</p>
        <p>We agree that collection point when we quote. The car is not parked at the palace for the whole show unless the quote you accept includes the waiting. Submitting the form does not confirm the booking.</p>`
      },
      {
        title: 'The park, and why the drop off is agreed later',
        html: `<p>The palace sits in a park, and event days do not all use the same approach. We agree a drop off the roads allow. We do not name a gate, a car park, or a journey time from Oxford.</p>
        <p>A Standard Car takes up to 4 passengers. An 8 Seater takes up to 8. See <a href="/our-vehicles">our vehicles</a>. Other nights out are grouped under concerts on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-the-o2-arena', 'The O2', 'Greenwich Peninsula, for arena shows.'],
      ['/oxford-to-wembley-stadium', 'Wembley', 'Stadium concerts and football.'],
      ['/events', 'All events', 'Cricket, racing and rugby as well as concerts.']
    ],
    faqs: [
      ['Do you only cover concerts at Alexandra Palace?', 'No. Darts, exhibitions and other ticketed events at the palace can be quoted. Tell us what the ticket is for.'],
      ['Is there a fixed fare from Oxford?', 'No. Standard Car and 8 Seater are quote on request for the date and the addresses.'],
      ['Can you list what is on this month?', 'No. Use the date on your ticket. We do not copy the palace listings onto this page.'],
      ['Where do we meet afterwards?', 'That point is agreed when we quote. We do not publish a standing meeting place, because the park approaches change by event.']
    ]
  },
  {
    slug: 'oxford-to-the-o2-arena',
    page: 'o2',
    crumb: 'The O2',
    title: 'Oxford to The O2 Arena Taxi | Spires Taxis',
    description: 'Oxford to The O2 on the Greenwich Peninsula. Private hire for arena shows, one way or return. Standard Car and 8 Seater fares are quoted for your date.',
    h1: 'Oxford to The O2 Arena taxi',
    lead: 'Private hire from Oxford to The O2 on the Greenwich Peninsula. Arena shows and other ticketed events, one way or return, quoted for your date.',
    destination: 'The O2, Greenwich Peninsula, London',
    venue: 'The O2',
    locality: 'London',
    placeType: 'StadiumOrArena',
    vehicleNote: 'An arena show can run later than the time on the ticket. Book the return for when you can meet, and message us if the night overruns.',
    sections: [
      {
        title: 'The arena on the Greenwich Peninsula',
        html: `<p>The O2 is on the Greenwich Peninsula in London. People in Oxford book it for arena concerts and for other ticketed shows in the building. North Greenwich is the public transport stop. This page is the private hire option when a group wants the car from an Oxford door instead.</p>
        <p>We do not publish the arena listings. Send the show and the date on your ticket. We are not affiliated with The O2 or with the promoter.</p>
        <p>If the ticket is for <a href="/oxford-to-alexandra-palace">Alexandra Palace</a> or a concert at <a href="/oxford-to-wembley-stadium">Wembley</a>, those pages are the right ones. They are not the same drop off.</p>`
      },
      {
        title: 'A one way drop, or a car back to Oxford',
        html: `<p>One way ends at the peninsula. A return brings you back to the Oxford address you give us, or to another address you write in. Tell us the pickup time and the time you expect the group to be ready after the show.</p>
        <p>The return collection is agreed when we quote. We do not hold the car at the arena through the performance unless that waiting is part of the price you accept. The form asks for a quote. It is not itself a confirmed booking.</p>`
      },
      {
        title: 'Drop off when the peninsula is busy',
        html: `<p>Show nights change how close a car can get. We agree the drop off for that night. We do not promise a door, a car park, or a journey time from Oxford, and we do not tell you to meet us at the station.</p>
        <p>Up to 4 passengers in a Standard Car, up to 8 in an <a href="/our-vehicles">8 Seater</a>. Both are quote on request. The concert list starts on <a href="/events">event transfers</a>.</p>`
      }
    ],
    related: [
      ['/oxford-to-alexandra-palace', 'Alexandra Palace', 'Muswell Hill, for a different kind of night.'],
      ['/oxford-to-wembley-stadium', 'Wembley', 'Stadium football and stadium concerts.'],
      ['/long-distance-taxis', 'Long distance taxis', 'Stations, cruises and other Oxford journeys.']
    ],
    faqs: [
      ['Do you meet at North Greenwich station?', 'No. The station is the public transport stop. Our drop off and the return collection are agreed for the car, when we quote.'],
      ['Is the fare on this page?', 'No. A Standard Car and an 8 Seater are quote on request. We confirm the price before you travel.'],
      ['Can you tell me who is playing this month?', 'No. Send the date on your ticket. We do not keep an arena listings page.'],
      ['What if the show finishes later than we said?', 'Contact us. The booked collection is the time we agreed. Extra waiting is only added when we have told you.']
    ]
  }
];

const photos = {
  'oxford-to-lords-cricket-ground': {
    file: 'lords-cricket-ground.jpg', width: 1788, height: 1073, position: 'center 42%',
    alt: "The pavilion at Lord's Cricket Ground, photographed in August 2017.",
    by: 'Yorkspotter', when: 'Taken in August 2017.',
    commons: 'https://commons.wikimedia.org/wiki/File:Lords-Cricket-Ground-Pavilion-06-08-2017.jpg',
    licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
  },
  'oxford-to-the-oval': {
    file: 'the-oval.jpg', width: 1920, height: 1440, position: 'center 45%',
    alt: 'The Oval in Kennington, photographed in January 2020.',
    by: 'Marathon', when: 'Taken in January 2020.',
    commons: 'https://commons.wikimedia.org/wiki/File:Oval_Cricket_Ground_-_geograph.org.uk_-_6374861.jpg',
    licence: 'CC BY-SA 2.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/'
  },
  'oxford-to-edgbaston-cricket-ground': {
    file: 'edgbaston-cricket-ground.jpg', width: 1920, height: 1446, position: 'center',
    alt: 'The exterior of Edgbaston Cricket Ground, photographed in August 2023.',
    by: 'Asheiou', when: 'Taken in August 2023.',
    commons: 'https://commons.wikimedia.org/wiki/File:Edgbaston_Stadium_August_2023.jpg',
    licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
  },
  'oxford-to-trent-bridge': {
    file: 'trent-bridge.jpg', width: 1024, height: 752, position: 'center',
    alt: 'Trent Bridge cricket ground, photographed in April 2011.',
    by: 'John Sutton', when: 'Taken in April 2011.',
    commons: 'https://commons.wikimedia.org/wiki/File:Trent_Bridge_Cricket_Ground_-_geograph.org.uk_-_2363388.jpg',
    licence: 'CC BY-SA 2.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/'
  },
  'oxford-to-utilita-bowl': {
    file: 'utilita-bowl.jpg', width: 1920, height: 1440, position: 'center 40%',
    alt: 'The Hampshire cricket ground at West End, photographed in June 2010, when it was known as the Rose Bowl.',
    by: 'AssociateAffiliate', when: 'Taken in June 2010.',
    commons: 'https://commons.wikimedia.org/wiki/File:Pavilion_stands.JPG',
    licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/'
  },
  'oxford-to-wembley-stadium': {
    file: 'wembley-stadium.jpg', width: 1920, height: 1440, position: 'center 18%',
    alt: 'Wembley Stadium and the steps up to the entrance, photographed in October 2025.',
    by: 'Stephen McKay', when: 'Taken in October 2025.',
    commons: 'https://commons.wikimedia.org/wiki/File:Wembley_Stadium_-_geograph.org.uk_-_8166249.jpg',
    licence: 'CC BY-SA 2.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/'
  },
  'oxford-to-cheltenham-racecourse': {
    file: 'cheltenham-racecourse.jpg', width: 1600, height: 1064, position: 'center',
    alt: 'The stand at Cheltenham Racecourse, photographed in October 2017.',
    by: 'John M', when: 'Taken in October 2017.',
    commons: 'https://commons.wikimedia.org/wiki/File:Cheltenham_Racecourse_-_Stand_-_geograph.org.uk_-_5567619.jpg',
    licence: 'CC BY-SA 2.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/'
  },
  'oxford-to-ascot-racecourse': {
    file: 'ascot-racecourse.jpg', width: 1920, height: 1395, position: 'center 35%',
    alt: 'The grandstand at Ascot Racecourse, photographed in June 2013.',
    by: 'Anthony Parkes', when: 'Taken in June 2013.',
    commons: 'https://commons.wikimedia.org/wiki/File:The_Grandstand_at_Ascot_Racecourse_-_geograph.org.uk_-_3530641.jpg',
    licence: 'CC BY-SA 2.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/'
  },
  'oxford-to-alexandra-palace': {
    file: 'alexandra-palace.jpg', width: 1920, height: 1440, position: 'center',
    alt: 'Alexandra Palace in Muswell Hill, photographed in September 2016.',
    by: 'Philafrenzy', when: 'Taken in September 2016.',
    commons: 'https://commons.wikimedia.org/wiki/File:Alexandra_Palace_Sept._2016_05.jpg',
    licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
  },
  'oxford-to-the-o2-arena': {
    file: 'the-o2.jpg', width: 1920, height: 1277, position: 'center 40%',
    alt: 'The O2 on the Greenwich Peninsula, photographed in May 2014.',
    by: 'Lewis Hulbert', when: 'Taken in May 2014.',
    commons: 'https://commons.wikimedia.org/wiki/File:The_O2,_Greenwich,_London.jpg',
    licence: 'CC BY-SA 3.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/'
  }
};

function photoFigure(slug) {
  const photo = photos[slug];
  return `<figure class="venue-photo">
    <img src="/images/${photo.file}" width="${photo.width}" height="${photo.height}" alt="${escAttr(photo.alt)}" style="object-position:${photo.position}" fetchpriority="high" decoding="async">
    <figcaption>Photograph by ${escText(photo.by)}, <a href="${escAttr(photo.commons)}">Wikimedia Commons</a>, <a href="${escAttr(photo.licenceUrl)}">${escText(photo.licence)}</a>. ${escText(photo.when)}</figcaption>
  </figure>`;
}

function relatedHtml(items) {
  return items.map(([href, title, text]) =>
    `<a class="card card--link" href="${escAttr(href)}"><h3>${escText(title)}</h3><p>${escText(text)}</p></a>`
  ).join('\n');
}

function faqHtml(faqs) {
  return faqs.map(([q, a]) =>
    `<details><summary>${escText(q)}</summary><p>${a}</p></details>`
  ).join('\n');
}

function formHtml(v) {
  const wa = 'https://wa.me/447776897772?text=' + encodeURIComponent(
    `Hi, I would like a quote from Oxford to ${v.venue}. Date: . Passengers: . One way or return: .`
  );
  return `<section class="section" id="quote">
    <div class="container" style="max-width:40rem;">
      <h2>Request a quote</h2>
      <p>Standard Car and 8 Seater are quote on request. Tell us the event date, the pickup time, and a return time if you need collecting afterwards. The return collection is agreed when we quote. Sending this form does not confirm the booking.</p>
      <div id="event-quote-result" hidden></div>
      <form class="event-quote" id="event-quote-form" novalidate>
        <input type="text" name="_gotcha" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-field">
          <label for="eq-name">Full name</label>
          <input type="text" id="eq-name" name="name" autocomplete="name" required>
        </div>
        <p class="form-help" id="eq-contact-help">A phone number or an email is enough. Landlines are fine.</p>
        <div class="form-row">
          <div class="form-field">
            <label for="eq-phone">Phone number</label>
            <input type="tel" id="eq-phone" name="phone" autocomplete="tel" inputmode="tel" aria-describedby="eq-contact-help">
          </div>
          <div class="form-field">
            <label for="eq-email">Email address</label>
            <input type="email" id="eq-email" name="email" autocomplete="email" aria-describedby="eq-contact-help">
          </div>
        </div>
        <p class="form-status" data-contact-error role="alert" hidden>Please provide a phone number or email address so we can respond to your request.</p>
        <fieldset class="journey-box">
          <legend>Journey</legend>
          <div class="form-field">
            <label for="eq-journey">Journey type</label>
            <select id="eq-journey" name="bookingType">
              <option value="one_way">One way</option>
              <option value="return">Return</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="eq-date">Event date</label>
              <input type="date" id="eq-date" name="date" required>
            </div>
            <div class="form-field">
              <label for="eq-time">Pickup time</label>
              <input type="time" id="eq-time" name="time" required>
            </div>
          </div>
          <div class="form-field">
            <label for="eq-pickup">Pickup</label>
            <input type="text" id="eq-pickup" name="pickup" autocomplete="street-address" required placeholder="Oxford address">
          </div>
          <div class="form-field">
            <label for="eq-destination">Destination</label>
            <input type="text" id="eq-destination" name="destination" required value="${escAttr(v.destination)}">
          </div>
        </fieldset>
        <div data-return-fields hidden>
          <fieldset class="journey-box">
            <legend>Return collection</legend>
            <p class="form-help">Agreed when we quote. The vehicle is not held at the venue unless that is part of the quote.</p>
            <div class="form-row">
              <div class="form-field">
                <label for="eq-return-date">Return date</label>
                <input type="date" id="eq-return-date" name="returnDate">
              </div>
              <div class="form-field">
                <label for="eq-return-time">Expected return time</label>
                <input type="time" id="eq-return-time" name="returnTime">
              </div>
            </div>
            <div class="form-field">
              <label for="eq-return-pickup">Return pickup</label>
              <input type="text" id="eq-return-pickup" name="returnPickupLocation" value="${escAttr(v.destination)}">
            </div>
            <div class="form-field">
              <label for="eq-return-destination">Return destination</label>
              <input type="text" id="eq-return-destination" name="returnDestination" placeholder="Same as the outbound pickup, unless you need somewhere else">
            </div>
          </fieldset>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="eq-passengers">Passengers</label>
            <input type="number" id="eq-passengers" name="passengers" min="1" max="4" value="1" required>
          </div>
          <div class="form-field">
            <label for="eq-luggage">Luggage pieces</label>
            <input type="number" id="eq-luggage" name="luggage" min="0" max="10" value="0">
          </div>
        </div>
        <fieldset class="vehicle-choice">
          <legend>Vehicle</legend>
          <label class="choice-card">
            <input type="radio" name="vehicleType" value="standard" required>
            <span><strong>Standard Car</strong><br>Up to 4 passengers. Quote on request.</span>
          </label>
          <label class="choice-card">
            <input type="radio" name="vehicleType" value="8_seater">
            <span><strong>8 Seater</strong><br>Up to 8 passengers. Quote on request.</span>
          </label>
        </fieldset>
        <input type="hidden" name="paymentMethod" value="undecided">
        <div class="form-field">
          <label for="eq-message">Event and anything else</label>
          <textarea id="eq-message" name="message" rows="4" placeholder="Event name, child seats, or another stop"></textarea>
        </div>
        <div class="terms-agreement">
          <label class="terms-agreement__line" for="eq-terms">
            <input type="checkbox" id="eq-terms" name="termsAccepted" value="yes" required>
            <span>I agree to the <a href="/terms/2026-10-25" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>.</span>
          </label>
          <input type="hidden" name="termsVersion" value="2026-10-25">
          <p class="terms-agreement__error" data-terms-error role="alert" hidden>Please agree to the Terms and Conditions before submitting.</p>
        </div>
        <p class="form-status" data-quote-status role="status" hidden></p>
        <div class="btn-group">
          <button type="submit" class="btn btn--primary">Request a quote</button>
          <a class="btn btn--outline" href="${escAttr(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="btn btn--outline" href="tel:+447776897772">Call 07776 897772</a>
        </div>
      </form>
    </div>
  </section>`;
}

function schema(v, faqs) {
  const url = `${origin}/${v.slug}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Events', item: `${origin}/events` },
          { '@type': 'ListItem', position: 3, name: v.crumb, item: url }
        ]
      },
      {
        '@type': 'Service',
        name: v.h1,
        serviceType: 'Private hire',
        url,
        provider: { '@id': `${origin}/#taxiservice` },
        areaServed: { '@type': 'City', name: 'Oxford' },
        description: v.description
      },
      {
        '@type': v.placeType,
        name: v.venue,
        address: { '@type': 'PostalAddress', addressLocality: v.locality, addressCountry: 'GB' }
      },
      {
        '@type': 'TaxiService',
        '@id': `${origin}/#taxiservice`,
        name: 'Spires Taxis',
        url: origin,
        telephone: '+447776897772',
        parentOrganization: { '@id': `${origin}/#organization` }
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: strip(a) }
        }))
      }
    ]
  };
  return JSON.stringify(graph);
}

function page(v) {
  const url = `${origin}/${v.slug}`;
  const sections = v.sections.map((section, index) => `<section class="section${index % 2 ? ' section--soft' : ''}">
    <div class="container prose" style="max-width:46rem;">
      <h2>${escText(section.title)}</h2>
      ${section.html}
    </div>
  </section>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="/js/measurement.js"></script>
  <link rel="icon" href="/images/spireslogo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/spireslogo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#002147">
  <meta property="og:site_name" content="Spires Taxis">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escAttr(v.title)}">
  <title>${escText(v.title)}</title>
  <meta name="description" content="${escAttr(v.description)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escAttr(v.title)}">
  <meta property="og:description" content="${escAttr(v.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${origin}/images/${photos[v.slug].file}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="${photos[v.slug].width}">
  <meta property="og:image:height" content="${photos[v.slug].height}">
  <meta name="twitter:image" content="${origin}/images/${photos[v.slug].file}">
  <meta name="twitter:description" content="${escAttr(v.description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <script type="application/ld+json">
  ${schema(v, v.faqs)}
  </script>
</head>
<body data-page="${v.page}">
<!-- SITE-HEADER -->
<!-- /SITE-HEADER -->
<main id="main-content">
  <section class="hero hero--compact">
    <div class="container hero__inner">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/events">Events</a> / ${escText(v.crumb)}</nav>
      <p class="section__eyebrow">Oxford private hire</p>
      <h1>${escText(v.h1)}</h1>
      <p class="hero__lead">${escText(v.lead)}</p>
      <div class="btn-group">
        <a class="btn btn--primary" href="#quote">Request a quote</a>
        <a class="btn btn--outline" href="tel:+447776897772">Call 07776 897772</a>
      </div>
    </div>
  </section>
  ${photoFigure(v.slug)}
  ${sections}
  <section class="section section--soft">
    <div class="container">
      <div class="section__header">
        <h2>Vehicles</h2>
        <p>${escText(v.vehicleNote)}</p>
      </div>
      <div class="grid grid-2">
        <article class="card">
          <h3>Standard Car</h3>
          <p class="event-fare">Quote <span>on request</span></p>
          <p>Up to 4 passengers. The fare is for the whole car.</p>
        </article>
        <article class="card">
          <h3>8 Seater</h3>
          <p class="event-fare">Quote <span>on request</span></p>
          <p>Up to 8 passengers. One collection for the group, not a seat each.</p>
        </article>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section__header">
        <h2>Other journeys</h2>
      </div>
      <div class="grid grid-3">
        ${relatedHtml(v.related)}
      </div>
    </div>
  </section>
  <section class="section section--soft">
    <div class="container faq">
      <h2>Questions</h2>
      ${faqHtml(v.faqs)}
    </div>
  </section>
  ${formHtml(v)}
</main>
<script src="/js/event-quote.js" defer></script>
<!-- SITE-FOOTER -->
<!-- /SITE-FOOTER -->
</body>
</html>
`;
}

const hyphen = /\b[A-Za-z]{2,}-[A-Za-z]{2,}\b/g;
const problems = [];
for (const venue of venues) {
  const html = page(venue);
  const visible = strip(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  const hits = (visible.match(hyphen) || []).filter((word) => word.toUpperCase() !== 'BY-SA');
  if (hits.length) problems.push(`${venue.slug}: ${[...new Set(hits)].join(', ')}`);
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) problems.push(`${venue.slug}: ${h1s.length} h1 tags`);
  fs.writeFileSync(path.join(root, `${venue.slug}.html`), html);
  console.log('Wrote', venue.slug);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
