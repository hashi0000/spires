export type AssignmentVehicle = {
  available?: boolean;
  registration?: string;
  motExpiry?: string | null;
};

export function assignmentReview(vehicle: AssignmentVehicle | null, now = new Date()): { block: boolean; notes: string[] } {
  if (!vehicle) return { block: false, notes: [] };
  const notes: string[] = [];
  if (vehicle.available === false) notes.push("This vehicle is off the fleet.");
  if (vehicle.motExpiry) {
    const expiry = new Date(vehicle.motExpiry);
    if (!Number.isNaN(expiry.getTime())) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      if (day < today) notes.push("Stored MOT date needs review. This is the date on file.");
    }
  }
  return { block: vehicle.available === false, notes };
}
