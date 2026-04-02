import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    backgroundColor: "#F7F4E9"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "2px solid #C5A572",
    paddingBottom: 10,
    marginBottom: 20
  },
  logo: {
    width: 120,
    height: 60
  },
  title: {
    fontSize: 22,
    fontFamily: "Cinzel",
    color: "#002147"
  },
  section: {
    padding: 15,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    border: "1px solid #E8D5B7",
    marginBottom: 20
  },
  heading: {
    fontSize: 16,
    fontFamily: "Playfair Display",
    color: "#002147",
    marginBottom: 6
  },
  text: {
    fontSize: 12,
    color: "#333333",
    lineHeight: 1.4
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#8B8680"
  }
});
