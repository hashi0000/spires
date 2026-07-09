// hooks/useFirebase.ts - Compatible with your App.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../utils/firebase';
import { Driver, Vehicle, Booking } from '../types/types';
import { normalizeBooking } from '../utils/bookingMapper';
import { generateSpiresBookingNumber } from '../utils/bookingNumber';
import { normalizeDriverFromFirestore } from '../utils/driverNormalize';
import { newDriverFirestorePayload, applyDriverComplianceUpdate } from '../utils/driverFirestoreWrite';

/** Firestore listeners must start after sign-in; they do not recover from permission-denied on their own. */
function subscribeWhenAuthenticated(
  subscribe: () => () => void,
  onSignedOut: () => void
): () => void {
  let unsubSnapshot: (() => void) | undefined;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubSnapshot) {
      unsubSnapshot();
      unsubSnapshot = undefined;
    }
    if (!user) {
      onSignedOut();
      return;
    }
    unsubSnapshot = subscribe();
  });

  return () => {
    unsubAuth();
    if (unsubSnapshot) unsubSnapshot();
  };
}

export const useDrivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeWhenAuthenticated(
      () => {
        setLoading(true);
        const q = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
        return onSnapshot(
          q,
          (snapshot) => {
            const driversData = snapshot.docs.map((d) =>
              normalizeDriverFromFirestore(d.id, d.data() as Record<string, unknown>)
            );
            setDrivers(driversData);
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching drivers:', error);
            setLoading(false);
          }
        );
      },
      () => {
        setDrivers([]);
        setLoading(false);
      }
    );
  }, []);

  const addDriver = async (driverData: Omit<Driver, 'id' | 'createdAt'>) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'drivers'), newDriverFirestorePayload(driverData));
      // Let Firebase onSnapshot handle the state update automatically
    } catch (error) {
      console.error('Error adding driver:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDriver = async (id: string, driverData: Partial<Driver>) => {
    setLoading(true);
    try {
      await applyDriverComplianceUpdate(id, driverData);
    } catch (error) {
      console.error('Error updating driver:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteDriver = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'drivers', id));
      setDrivers(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting driver:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getActiveDrivers = () => drivers.filter(driver => driver.active);

  return {
    drivers,
    loading,
    addDriver,
    updateDriver,
    deleteDriver,
    getActiveDrivers
  };
};

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeWhenAuthenticated(
      () => {
        setLoading(true);
        const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
        return onSnapshot(
          q,
          (snapshot) => {
            const vehiclesData = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
              createdAt: docSnap.data().createdAt?.toDate() || new Date(),
            })) as Vehicle[];
            setVehicles(vehiclesData);
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching vehicles:', error);
            setLoading(false);
          }
        );
      },
      () => {
        setVehicles([]);
        setLoading(false);
      }
    );
  }, []);

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt'>) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'vehicles'), {
        ...vehicleData,
        createdAt: Timestamp.now()
      });
      // Let Firebase onSnapshot handle the state update automatically
    } catch (error) {
      console.error('Error adding vehicle:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateVehicle = async (id: string, vehicleData: Partial<Vehicle>) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'vehicles', id), vehicleData);
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...vehicleData } : v));
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'vehicles', id));
      setVehicles(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getAvailableVehicles = () => vehicles.filter(vehicle => vehicle.available);

  return {
    vehicles,
    loading,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    getAvailableVehicles
  };
};

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeWhenAuthenticated(
      () => {
        setLoading(true);
        const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
        return onSnapshot(
          q,
          (snapshot) => {
            const bookingsData = snapshot.docs.map((docSnap) => {
              const data = {
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate() || new Date(),
              };
              return normalizeBooking(data);
            }) as Booking[];
            setBookings(bookingsData);
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching bookings:', error);
            setLoading(false);
          }
        );
      },
      () => {
        setBookings([]);
        setLoading(false);
      }
    );
  }, []);

  const generateBookingNumber = (): string => generateSpiresBookingNumber();

  const addBooking = async (bookingData: any) => {
    setLoading(true);
    try {
      const bookingNumber = generateBookingNumber();
      await addDoc(collection(db, 'bookings'), {
        ...bookingData,
        bookingNumber,
        createdAt: Timestamp.now()
      });
      // Let Firebase onSnapshot handle the state update automatically
    } catch (error) {
      console.error('Error adding booking:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateBooking = async (id: string, bookingData: any) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', id), bookingData);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...bookingData } : b));
    } catch (error) {
      console.error('Error updating booking:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteBooking = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getTodaysBookings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.pickupTime);
      return bookingDate >= today && bookingDate < tomorrow;
    });
  };

  return {
    bookings,
    loading,
    addBooking,
    updateBooking,
    deleteBooking,
    getTodaysBookings
  };
};

export const useDriverLimitCheck = (drivers: Driver[]) => {
  const MAX_ACTIVE_DRIVERS = 3;
  
  const activeDrivers = drivers.filter(driver => driver.active);
  const activeCount = activeDrivers.length;
  const isAtLimit = activeCount >= MAX_ACTIVE_DRIVERS;
  const remainingSlots = Math.max(0, MAX_ACTIVE_DRIVERS - activeCount);
  
  return {
    activeCount,
    isAtLimit,
    remainingSlots
  };
};