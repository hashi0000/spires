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

/** Cotswolds tour stops. Postcodes checked via postcodes.io on 25 November 2026. */
export const SEEDED_COTSWOLDS_PLACES: CompanyPlace[] = [
  {
    id: "burford",
    label: "Burford",
    address: "Burford, Oxfordshire",
    postcode: "OX18 4QF",
    aliases: ["Burford High Street", "Burford Cotswolds"],
    meetingInstructions: "",
    latitude: 51.808225,
    longitude: -1.636826,
  },
  {
    id: "bibury",
    label: "Bibury",
    address: "Bibury, Gloucestershire",
    postcode: "GL7 5NR",
    aliases: ["Bibury Cotswolds", "Arlington Row"],
    meetingInstructions: "",
    latitude: 51.757342,
    longitude: -1.831173,
  },
  {
    id: "bourton-on-the-water",
    label: "Bourton on the Water",
    address: "Bourton on the Water, Gloucestershire",
    postcode: "GL54 2AP",
    aliases: ["Bourton", "Bourton-on-the-Water", "Bourton Cotswolds"],
    meetingInstructions: "",
    latitude: 51.885422,
    longitude: -1.759095,
  },
  {
    id: "upper-slaughter",
    label: "Upper Slaughter",
    address: "Upper Slaughter, Gloucestershire",
    postcode: "GL54 2JF",
    aliases: ["Upper Slaughter Cotswolds"],
    meetingInstructions: "",
    latitude: 51.907222,
    longitude: -1.775361,
  },
  {
    id: "lower-slaughter",
    label: "Lower Slaughter",
    address: "Lower Slaughter, Gloucestershire",
    postcode: "GL54 2HS",
    aliases: ["Lower Slaughter Cotswolds"],
    meetingInstructions: "",
    latitude: 51.901272,
    longitude: -1.762862,
  },
  {
    id: "stow-on-the-wold",
    label: "Stow on the Wold",
    address: "Stow on the Wold, Gloucestershire",
    postcode: "GL54 1AF",
    aliases: ["Stow", "Stow-on-the-Wold", "Stow Cotswolds"],
    meetingInstructions: "",
    latitude: 51.930423,
    longitude: -1.722452,
  },
  {
    id: "broadway",
    label: "Broadway",
    address: "Broadway, Worcestershire",
    postcode: "WR12 7AA",
    aliases: ["Broadway Cotswolds", "Broadway village"],
    meetingInstructions: "",
    latitude: 52.035692,
    longitude: -1.862783,
  },
  {
    id: "chipping-norton",
    label: "Chipping Norton",
    address: "Chipping Norton, Oxfordshire",
    postcode: "OX7 5DD",
    aliases: ["Chipping Norton Cotswolds", "Chippy"],
    meetingInstructions: "",
    latitude: 51.940688,
    longitude: -1.545275,
  },
  {
    id: "moreton-in-marsh",
    label: "Moreton in Marsh",
    address: "Moreton in Marsh, Gloucestershire",
    postcode: "GL56 0AF",
    aliases: ["Moreton", "Moreton-in-Marsh", "Moreton Cotswolds"],
    meetingInstructions: "",
    latitude: 51.990904,
    longitude: -1.703422,
  },
  {
    id: "cirencester",
    label: "Cirencester",
    address: "Cirencester, Gloucestershire",
    postcode: "GL7 2AE",
    aliases: ["Cirencester Cotswolds", "Ciren"],
    meetingInstructions: "",
    latitude: 51.717547,
    longitude: -1.968779,
  },
  {
    id: "tetbury",
    label: "Tetbury",
    address: "Tetbury, Gloucestershire",
    postcode: "GL8 8AA",
    aliases: ["Tetbury Cotswolds"],
    meetingInstructions: "",
    latitude: 51.638046,
    longitude: -2.160774,
  },
];

export const ALL_SEEDED_COMPANY_PLACES: CompanyPlace[] = [...SEEDED_OXFORD_PLACES, ...SEEDED_COTSWOLDS_PLACES];

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
  if (snap.empty) return ALL_SEEDED_COMPANY_PLACES;
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

/** Adds any seeded Oxford or Cotswolds place that is not already stored. Existing rows are left alone. */
export async function seedMissingCompanyPlaces(): Promise<number> {
  const snap = await getDocs(collection(db, "companyPlaces"));
  const existing = new Set(snap.docs.map((row) => row.id));
  let added = 0;
  for (const place of ALL_SEEDED_COMPANY_PLACES) {
    if (existing.has(place.id)) continue;
    await setDoc(doc(db, "companyPlaces", place.id), {
      ...place,
      updatedAt: serverTimestamp(),
      seeded: true,
    });
    added += 1;
  }
  return added;
}

/** @deprecated Prefer seedMissingCompanyPlaces so Cotswolds stops can be added after Oxford seeds. */
export async function seedCompanyPlacesIfEmpty(): Promise<number> {
  return seedMissingCompanyPlaces();
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
