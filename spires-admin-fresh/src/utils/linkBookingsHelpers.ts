// linkBookingsHelpers.ts - Firestore helper functions for linking bookings to customers
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  writeBatch,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Customer, Booking } from '../types/types';

/**
 * Get customer by ID
 */
export const getCustomerById = async (customerId: string): Promise<Customer | null> => {
  try {
    const customerDoc = await getDoc(doc(db, 'customers', customerId));
    if (!customerDoc.exists()) {
      return null;
    }
    const data = customerDoc.data();
    return {
      id: customerDoc.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      dateOfBirth: data.dateOfBirth,
      addresses: data.addresses,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    };
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
};

/**
 * Get all bookings that are linked to customers
 */
export const getLinkedBookings = async (limitCount: number = 100): Promise<Booking[]> => {
  try {
    const bookingsRef = collection(db, 'bookings');
    // Query for bookings that have a customerId
    const q = query(
      bookingsRef,
      where('customerId', '!=', null),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const bookings: Booking[] = [];

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      const booking: Booking = {
        id: docSnapshot.id,
        bookingNumber: data.bookingNumber || '',
        dateTime: data.dateTime || data.pickupTime || '',
        hirerName: data.hirerName || data.name || '',
        hirerAddress: data.hirerAddress || '',
        hirerPhone: data.hirerPhone || data.phone || '',
        bookingMethod: data.bookingMethod || 'internet',
        pickupTime: data.pickupTime || data.dateTime || '',
        pickupLocation: data.pickupLocation || data.pickup || '',
        destination: data.destination || '',
        driverId: data.driverId,
        vehicleId: data.vehicleId,
        subContract: data.subContract,
        status: data.status || 'pending',
        notes: data.notes,
        allocatedTime: data.allocatedTime,
        actualFare: data.actualFare,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentStatus,
        expenses: data.expenses,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        customerId: data.customerId,
        linkedAt: data.linkedAt?.toDate?.() || data.linkedAt,
        linkedBy: data.linkedBy,
        email: data.email,
        uid: data.uid,
      } as Booking;
      bookings.push(booking);
    });

    // Sort by linkedAt or createdAt (most recent first)
    bookings.sort((a, b) => {
      const dateA = a.linkedAt 
        ? (a.linkedAt instanceof Date ? a.linkedAt.getTime() : new Date(a.linkedAt).getTime())
        : (a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0);
      const dateB = b.linkedAt 
        ? (b.linkedAt instanceof Date ? b.linkedAt.getTime() : new Date(b.linkedAt).getTime())
        : (b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0);
      return dateB - dateA;
    });

    return bookings;
  } catch (error) {
    console.error('Error getting linked bookings:', error);
    // If the query fails (e.g., no index), try a different approach
    // Get all bookings and filter in memory
    try {
      const bookingsRef = collection(db, 'bookings');
      const allBookingsQuery = query(bookingsRef, limit(500));
      const snapshot = await getDocs(allBookingsQuery);
      const bookings: Booking[] = [];

      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() as any;
        if (data.customerId) {
          const booking: Booking = {
            id: docSnapshot.id,
            bookingNumber: data.bookingNumber || '',
            dateTime: data.dateTime || data.pickupTime || '',
            hirerName: data.hirerName || data.name || '',
            hirerAddress: data.hirerAddress || '',
            hirerPhone: data.hirerPhone || data.phone || '',
            bookingMethod: data.bookingMethod || 'internet',
            pickupTime: data.pickupTime || data.dateTime || '',
            pickupLocation: data.pickupLocation || data.pickup || '',
            destination: data.destination || '',
            driverId: data.driverId,
            vehicleId: data.vehicleId,
            subContract: data.subContract,
            status: data.status || 'pending',
            notes: data.notes,
            allocatedTime: data.allocatedTime,
            actualFare: data.actualFare,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            expenses: data.expenses,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            customerId: data.customerId,
            linkedAt: data.linkedAt?.toDate?.() || data.linkedAt,
            linkedBy: data.linkedBy,
            email: data.email,
            uid: data.uid,
          } as Booking;
          bookings.push(booking);
        }
      });

      bookings.sort((a, b) => {
        const dateA = a.linkedAt 
          ? (a.linkedAt instanceof Date ? a.linkedAt.getTime() : new Date(a.linkedAt).getTime())
          : (a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0);
        const dateB = b.linkedAt 
          ? (b.linkedAt instanceof Date ? b.linkedAt.getTime() : new Date(b.linkedAt).getTime())
          : (b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0);
        return dateB - dateA;
      });

      return bookings;
    } catch (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      throw fallbackError;
    }
  }
};

/**
 * Search customers by email or name
 */
export const searchCustomers = async (
  searchTerm: string
): Promise<Customer[]> => {
  if (!searchTerm.trim()) {
    return [];
  }

  const customersRef = collection(db, 'customers');
  const searchLower = searchTerm.toLowerCase().trim();
  const results: Customer[] = [];

  try {
    // Get all customers (we'll filter in memory since Firestore doesn't support
    // case-insensitive search or full-text search easily)
    // For better performance with many customers, consider using Algolia or similar
    const allCustomersQuery = query(customersRef, orderBy('createdAt', 'desc'), limit(500));
    const snapshot = await getDocs(allCustomersQuery);

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const customer: Customer = {
        id: docSnapshot.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth,
        addresses: data.addresses,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };

      // Filter by email, name, or phone
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      const email = customer.email.toLowerCase();
      const phone = customer.phone.toLowerCase();

      if (
        email.includes(searchLower) ||
        fullName.includes(searchLower) ||
        phone.includes(searchLower)
      ) {
        results.push(customer);
      }
    });

    return results;
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
};

/**
 * Search bookings by email, phone, or booking reference
 */
export const searchBookings = async (
  searchParams: {
    email?: string;
    phone?: string;
    bookingRef?: string;
  }
): Promise<Booking[]> => {
  const bookingsRef = collection(db, 'bookings');
  const queries: any[] = [];

  try {
    // Build queries based on provided search params
    // Note: We don't use orderBy with where on different fields to avoid requiring composite indexes
    // Results will be sorted in memory instead
    if (searchParams.email?.trim()) {
      queries.push(
        query(
          bookingsRef,
          where('email', '==', searchParams.email.trim()),
          limit(100)
        )
      );
    }

    if (searchParams.phone?.trim()) {
      // Search by hirerPhone (admin bookings) or phone (customer bookings)
      // Note: Firestore doesn't support OR queries easily, so we'll search both
      const phoneTerm = searchParams.phone.trim();
      queries.push(
        query(
          bookingsRef,
          where('hirerPhone', '==', phoneTerm),
          limit(100)
        )
      );
      queries.push(
        query(
          bookingsRef,
          where('phone', '==', phoneTerm),
          limit(100)
        )
      );
    }

    if (searchParams.bookingRef?.trim()) {
      queries.push(
        query(
          bookingsRef,
          where('bookingNumber', '==', searchParams.bookingRef.trim().toUpperCase()),
          limit(100)
        )
      );
    }

    // Execute all queries and combine results
    const allResults = new Map<string, Booking>();

    for (const q of queries) {
      try {
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data() as any;
          const booking: Booking = {
            id: docSnapshot.id,
            bookingNumber: data.bookingNumber || '',
            dateTime: data.dateTime || data.pickupTime || '',
            hirerName: data.hirerName || data.name || '',
            hirerAddress: data.hirerAddress || '',
            hirerPhone: data.hirerPhone || data.phone || '',
            bookingMethod: data.bookingMethod || 'internet',
            pickupTime: data.pickupTime || data.dateTime || '',
            pickupLocation: data.pickupLocation || data.pickup || '',
            destination: data.destination || '',
            driverId: data.driverId,
            vehicleId: data.vehicleId,
            subContract: data.subContract,
            status: data.status || 'pending',
            notes: data.notes,
            allocatedTime: data.allocatedTime,
            actualFare: data.actualFare,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            expenses: data.expenses,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            customerId: data.customerId,
            linkedAt: data.linkedAt?.toDate?.() || data.linkedAt,
            linkedBy: data.linkedBy,
            // Preserve customer app fields
            email: data.email,
            uid: data.uid,
          } as Booking;

          // Use booking ID as key to avoid duplicates
          if (booking.id) {
            allResults.set(booking.id, booking);
          }
        });
      } catch (error: any) {
        // If query fails (e.g., missing index), log but continue with other queries
        console.warn('Query failed:', error.message);
        // Don't throw - allow other queries to proceed
      }
    }

    // If no specific queries, return empty array
    if (queries.length === 0) {
      return [];
    }

    // Sort results by createdAt (most recent first) in memory
    const results = Array.from(allResults.values());
    results.sort((a, b) => {
      const dateA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
      const dateB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
      return dateB - dateA; // Descending order (newest first)
    });

    return results;
  } catch (error) {
    console.error('Error searching bookings:', error);
    throw error;
  }
};

/**
 * Batch update bookings with customerId
 * Only updates bookings that are explicitly selected
 */
export const linkBookingsToCustomer = async (
  bookingIds: string[],
  customerId: string,
  linkedBy: string // Admin email or uid
): Promise<{ success: number; failed: number; errors: string[] }> => {
  if (bookingIds.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Firestore batch limit is 500 operations
  const batches: string[][] = [];
  for (let i = 0; i < bookingIds.length; i += 500) {
    batches.push(bookingIds.slice(i, i + 500));
  }

  try {
    for (const batchIds of batches) {
      const currentBatch = writeBatch(db);
      let batchSuccessCount = 0;

      for (const bookingId of batchIds) {
        try {
          const bookingRef = doc(db, 'bookings', bookingId);
          currentBatch.update(bookingRef, {
            customerId,
            uid: customerId, // Set uid to customerId so customer app can find the booking
            linkedAt: Timestamp.now(),
            linkedBy,
            updatedAt: Timestamp.now(),
          });
          batchSuccessCount++;
        } catch (error: any) {
          errors.push(`Booking ${bookingId}: ${error.message}`);
          failedCount++;
        }
      }

      try {
        await currentBatch.commit();
        successCount += batchSuccessCount;
      } catch (error: any) {
        // If batch commit fails, all operations in that batch failed
        failedCount += batchSuccessCount;
        successCount -= batchSuccessCount;
        errors.push(`Batch commit failed: ${error.message}`);
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors,
    };
  } catch (error: any) {
    console.error('Error linking bookings:', error);
    throw error;
  }
};

