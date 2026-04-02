import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import CustomPDF from "./pdf/CustomPDF"; // Adjust path if needed

const PDFButton = () => (
  <PDFDownloadLink
    document={
      <CustomPDF
        logoUrl="/logo.png" // Place your logo in public/ folder
        title="Admin Report"
        content="This is a test PDF styled with Oxford colors."
      />
    }
    fileName="report.pdf"
  >
    {({ loading }) => (loading ? "Preparing PDF..." : "Download PDF")}
  </PDFDownloadLink>
);

export default PDFButton;
