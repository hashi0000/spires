import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/Navbar.css";

// ========= CONFIGURATION OBJECT =========
// Edit all navigation content here for easy updates
const NAVBAR_CONFIG = {
  logo: {
    line1: "SPIRES",
    line2: "TAXIS"
  },
  links: [
    { path: "/", label: "Home" },
    { path: "/services", label: "Services" },
    { path: "/rates", label: "Rates" },
    { path: "/about", label: "About" },
    { path: "/contact", label: "Contact" },
    { path: "/reviews", label: "Reviews" }
  ],
  contact: {
    phone: "07776 897772",
    phoneLink: "tel:+447776897772",
    whatsappLink: "https://wa.me/447776897772?text=Hello,%20I'd%20like%20to%20book%20a%20taxi%20please"
  },
  buttons: {
    bookOnline: {
      label: "Book Online",
      path: "https://booking.spires-taxis.com",
      external: true
    },
    myAccount: {
      label: "My Account",
      path: "https://customer.spires-taxis.com"
    }
  }
};

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  // Handle scroll effect for navbar shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest(".navbar-container")) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className={`navbar-header ${isScrolled ? "scrolled" : ""}`}>
      <nav className="navbar-container">
        {/* Logo Section - Two Lines */}
        <div className="navbar-logo-section">
          <Link to="/" className="navbar-logo" onClick={closeMenu}>
            <div className="logo-text-container">
              <span className="logo-line1">{NAVBAR_CONFIG.logo.line1}</span>
              <span className="logo-line2">{NAVBAR_CONFIG.logo.line2}</span>
            </div>
            <span className="logo-underline"></span>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <ul className={`navbar-links ${isMenuOpen ? "active" : ""}`}>
          {NAVBAR_CONFIG.links.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={location.pathname === link.path ? "active" : ""}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Section: Contact & Buttons */}
        <div className="navbar-right-section">
          {/* Contact Info - Desktop Only */}
          <div className="navbar-contact">
            <a 
              href={NAVBAR_CONFIG.contact.phoneLink} 
              className="navbar-phone"
              onClick={closeMenu}
            >
              {NAVBAR_CONFIG.contact.phone}
            </a>
            <a
              href={NAVBAR_CONFIG.contact.whatsappLink}
              className="navbar-whatsapp"
              title="WhatsApp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.403"/>
              </svg>
            </a>
          </div>

          {/* Action Buttons */}
          <div className="navbar-buttons">
            {NAVBAR_CONFIG.buttons.bookOnline.external ? (
              <a
                href={NAVBAR_CONFIG.buttons.bookOnline.path}
                className="btn-book-online"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                {NAVBAR_CONFIG.buttons.bookOnline.label}
              </a>
            ) : (
              <Link
                to={NAVBAR_CONFIG.buttons.bookOnline.path}
                className="btn-book-online"
                onClick={closeMenu}
              >
                {NAVBAR_CONFIG.buttons.bookOnline.label}
              </Link>
            )}
            <a 
              href={NAVBAR_CONFIG.buttons.myAccount.path} 
              className="btn-my-account"
              onClick={closeMenu}
            >
              {NAVBAR_CONFIG.buttons.myAccount.label}
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className={`mobile-menu-toggle ${isMenuOpen ? "active" : ""}`}
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}></div>
      )}

      {/* Mobile Contact & Buttons Section */}
      {isMenuOpen && (
        <div className="mobile-menu-actions">
          <div className="mobile-contact-group">
            <a 
              href={NAVBAR_CONFIG.contact.phoneLink} 
              className="mobile-phone-btn"
              onClick={closeMenu}
            >
              📞 {NAVBAR_CONFIG.contact.phone}
            </a>
            <a
              href={NAVBAR_CONFIG.contact.whatsappLink}
              className="mobile-whatsapp-btn"
              title="WhatsApp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.403"/>
              </svg>
              WhatsApp
            </a>
          </div>
          <div className="mobile-buttons-group">
            {NAVBAR_CONFIG.buttons.bookOnline.external ? (
              <a
                href={NAVBAR_CONFIG.buttons.bookOnline.path}
                className="mobile-book-btn"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                {NAVBAR_CONFIG.buttons.bookOnline.label}
              </a>
            ) : (
              <Link
                to={NAVBAR_CONFIG.buttons.bookOnline.path}
                className="mobile-book-btn"
                onClick={closeMenu}
              >
                {NAVBAR_CONFIG.buttons.bookOnline.label}
              </Link>
            )}
            <a 
              href={NAVBAR_CONFIG.buttons.myAccount.path} 
              className="mobile-account-btn"
              onClick={closeMenu}
            >
              {NAVBAR_CONFIG.buttons.myAccount.label}
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
