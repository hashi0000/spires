import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type CompanyPlace = {
  id: string;
  label: string;
  address: string;
  postcode: string;
  aliases: string[];
  meetingInstructions?: string;
  latitude: number | null;
  longitude: number | null;
};

/** Postcodes checked via postcodes.io on 24 November 2026. */
export const SEEDED_OXFORD_PLACES: CompanyPlace[] = [
  {
    id: "randolph-hotel",
    label: "The Randolph Hotel",
    address: "The Randolph Hotel, Beaumont Street, Oxford",
    postcode: "OX1 2LN",
    aliases: ["Randolph", "Randolph Hotel", "The Randolph"],
    meetingInstructions: "Main entrance on Beaumont Street",
    latitude: 51.75499,
    longitude: -1.259782,
  },
  {
    id: "old-parsonage-hotel",
    label: "Old Parsonage Hotel",
    address: "Old Parsonage Hotel, 1 Banbury Road, Oxford",
    postcode: "OX2 6NN",
    aliases: ["Old Parsonage", "Parsonage"],
    meetingInstructions: "Main entrance on Banbury Road",
    latitude: 51.761074,
    longitude: -1.26061,
  },
  {
    id: "oxford-railway-station",
    label: "Oxford Railway Station",
    address: "Oxford Railway Station, Park End Street, Oxford",
    postcode: "OX1 1HS",
    aliases: ["Oxford station", "Oxford train station", "Oxford Station"],
    meetingInstructions: "Station forecourt / taxi rank unless the note says otherwise",
    latitude: 51.753427,
    longitude: -1.270079,
  },
  {
    id: "gloucester-green-coach",
    label: "Gloucester Green Coach Station",
    address: "Gloucester Green Coach Station, Oxford",
    postcode: "OX1 2BU",
    aliases: ["Gloucester Green", "Oxford coach station", "Gloucester Green bus"],
    meetingInstructions: "Coach station forecourt",
    latitude: 51.75408,
    longitude: -1.26223,
  },
  {
    id: "westgate-oxford",
    label: "Westgate Oxford",
    address: "Westgate Oxford, Bonn Square, Oxford",
    postcode: "OX1 1TR",
    aliases: ["Westgate", "Westgate shopping centre"],
    meetingInstructions: "Bonn Square entrance unless the note says otherwise",
    latitude: 51.747771,
    longitude: -1.259958,
  },
];

export function matchCompanyPlaces(query: string, places: CompanyPlace[]): CompanyPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return places.slice(0, 8);
  return places
    .filter((place) => {
      const hay = `${place.label} ${place.address} ${place.postcode} ${place.aliases.join(" ")}`.toLowerCase();
      return hay.includes(q) || place.aliases.some((alias) => alias.toLowerCase().startsWith(q) || q.startsWith(alias.toLowerCase()));
    })
    .slice(0, 8);
}

export function companyPlaceSuggestionLabel(place: CompanyPlace): string {
  return `${place.label}, ${place.postcode}`;
}

export async function loadCompanyPlaces(): Promise<CompanyPlace[]> {
  const snap = await getDocs(collection(db, "companyPlaces"));
  if (snap.empty) return SEEDED_OXFORD_PLACES;
  return snap.docs.map((row) => {
    const data = row.data() as Partial<CompanyPlace>;
    return {
      id: row.id,
      label: String(data.label || row.id),
      address: String(data.address || data.label || ""),
      postcode: String(data.postcode || ""),
      aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
      meetingInstructions: data.meetingInstructions ? String(data.meetingInstructions) : "",
      latitude: data.latitude == null ? null : Number(data.latitude),
      longitude: data.longitude == null ? null : Number(data.longitude),
    };
  });
}

export async function seedCompanyPlacesIfEmpty(): Promise<number> {
  const snap = await getDocs(collection(db, "companyPlaces"));
  if (!snap.empty) return 0;
  for (const place of SEEDED_OXFORD_PLACES) {
    await setDoc(doc(db, "companyPlaces", place.id), {
      ...place,
      updatedAt: serverTimestamp(),
      seeded: true,
    });
  }
  return SEEDED_OXFORD_PLACES.length;
}

export async function saveCompanyPlace(place: CompanyPlace): Promise<void> {
  await setDoc(
    doc(db, "companyPlaces", place.id),
    {
      ...place,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
