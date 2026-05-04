import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { storage, db } from './firebase';

export const DRIVER_DOC_MAX_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;

export type DriverDocumentSlot = 'driverLicence' | 'privateHireLicence' | 'mot';

/** Fixed Storage object names (extension .pdf path; contentType reflects actual file). */
const STORAGE_OBJECT_NAMES: Record<DriverDocumentSlot, string> = {
  driverLicence: 'driver-licence.pdf',
  privateHireLicence: 'private-hire-licence.pdf',
  mot: 'mot.pdf',
};

const FIRESTORE_URL_KEY: Record<DriverDocumentSlot, string> = {
  driverLicence: 'driverLicenceUrl',
  privateHireLicence: 'privateHireLicenceUrl',
  mot: 'motDocumentUrl',
};

export function firestoreUrlKeyForDriverDocumentSlot(slot: DriverDocumentSlot): string {
  return FIRESTORE_URL_KEY[slot];
}

export function validateDriverUploadFile(file: File): string | null {
  if (file.size > DRIVER_DOC_MAX_BYTES) {
    return 'File must be 5MB or smaller.';
  }
  const okMime = file.type && ALLOWED_MIME.has(file.type.toLowerCase());
  const okName = ALLOWED_EXT.test(file.name);
  if (!okMime && !okName) {
    return 'Only PDF, JPG, or PNG files are allowed.';
  }
  return null;
}

/**
 * Upload to Storage (overwrites same path), then merge Firestore `documents` + `updatedAt`.
 */
export async function uploadDriverComplianceDocument(
  driverId: string,
  slot: DriverDocumentSlot,
  file: File
): Promise<string> {
  const err = validateDriverUploadFile(file);
  if (err) throw new Error(err);

  const objectName = STORAGE_OBJECT_NAMES[slot];
  const storageRef = ref(storage, `drivers/${driverId}/${objectName}`);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  });

  const downloadUrl = await getDownloadURL(storageRef);
  const urlField = FIRESTORE_URL_KEY[slot];

  await setDoc(
    doc(db, 'drivers', driverId),
    {
      documents: {
        [urlField]: downloadUrl,
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  return downloadUrl;
}
