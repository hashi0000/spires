import React from "react";
import { Page, Text, View, Document, StyleSheet, Image } from "@react-pdf/renderer";
import { styles } from "./pdfStyles";

const BookingPDF = ({ logoUrl, booking }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Image style={styles.logo} src={logoUrl} />
        <Text style={styles.title}>Booking Confirmation</Text>
      </View>

      {/* Booking Info */}
      <View style={styles.section}>
        <Text style={styles.heading}>Customer Information</Text>
        <Text style={styles.text}>Name: {booking.name}</Text>
        <Text style={styles.text}>Email: {booking.email}</Text>
        <Text style={styles.text}>Phone: {booking.phone}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Trip Details</Text>
        <Text style={styles.text}>Pickup: {booking.pickup}</Text>
        <Text style={styles.text}>Dropoff: {booking.dropoff}</Text>
        <Text style={styles.text}>Date: {booking.date}</Text>
        <Text style={styles.text}>Time: {booking.time}</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>© {new Date().getFullYear()} Spires Taxis - Oxford</Text>
    </Page>
  </Document>
);

export default BookingPDF;
