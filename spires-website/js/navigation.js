// Universal Navigation Component for Spires Taxis
// This ensures consistent navigation across all pages

document.addEventListener('DOMContentLoaded', function() {
    // Function to create the destinations dropdown menu
    function createDestinationsDropdown() {
        return `
            <div class="dropdown-menu destinations-menu">
                <div class="dropdown-section">
                    <h4>Airport Transfers</h4>
                    <a href="/pages/heathrow-airport">Heathrow Airport</a>
                    <a href="/destinations/airport-transfers">All Airport Transfers</a>
                </div>
                <div class="dropdown-section">
                    <h4>Popular Attractions</h4>
                    <a href="/destinations/attractions/bicester-village">Bicester Village</a>
                    <a href="/destinations/blenheim-palace">Blenheim Palace</a>
                    <a href="/destinations/attractions/stratford-upon-avon">Stratford-upon-Avon</a>
                    <a href="/destinations/warner-bros-studios">Warner Bros Studios</a>
                </div>
                <div class="dropdown-section">
                    <h4>University & Tours</h4>
                    <a href="/destinations/oxford-colleges">Oxford Colleges</a>
                    <a href="/destinations/cotswold-tours">Cotswold Tours</a>
                </div>
            </div>
        `;
    }

    // Function to create the services dropdown menu
    function createServicesDropdown() {
        return `
            <div class="dropdown-menu">
                <div class="dropdown-section">
                    <a href="/services">All Services</a>
                    <a href="/student-taxis">Student Offers</a>
                    <a href="/services#corporate">Corporate Travel</a>
                    <a href="/services#airport">Airport Transfers</a>
                </div>
            </div>
        `;
    }

    // Function to create the complete navigation
    function createNavigation() {
        return `
            <nav>
                <a href="/" class="logo">Spires Taxis</a>
                
                <ul class="nav-links">
                    <li><a href="/" class="nav-home">Home</a></li>
                    <li><a href="/about" class="nav-about">About Us</a></li>
                    <li class="dropdown">
                        <a href="/services" class="dropdown-toggle nav-services">Services ▼</a>
                        ${createServicesDropdown()}
                    </li>
                    <li class="dropdown">
                        <a href="/destinations" class="dropdown-toggle nav-destinations">Destinations ▼</a>
                        ${createDestinationsDropdown()}
                    </li>
                    <li><a href="/rates" class="nav-rates">Rates</a></li>
                    <li><a href="/contact" class="nav-contact">Contact</a></li>
                </ul>
                
                <div class="nav-cta">
                    <a href="tel:+447776897772" class="phone-btn">📞 07776 897772</a>
                    <a href="https://wa.me/447776897772?text=Hello,%20I'd%20like%20to%20book%20a%20taxi%20please" class="whatsapp-btn">
                        <img src="./images/whatsapp-icon.svg" alt="WhatsApp" class="whatsapp-icon">
                    </a>
                    <a href="https://booking.spires-taxis.com" class="book-btn" target="_blank" rel="noopener noreferrer">BOOK ONLINE</a>
                </div>
                
                <div class="mobile-menu-toggle">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </nav>
        `;
    }

    // Function to set active navigation item based on current page
    function setActiveNav() {
        const currentPage = window.location.pathname.split('/').pop();
        const navLinks = document.querySelectorAll('.nav-links a');
        
        // Remove all active classes
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class based on current page
        switch(currentPage) {
            case 'index.html':
            case '':
                document.querySelector('.nav-home')?.classList.add('active');
                break;
            case 'about.html':
                document.querySelector('.nav-about')?.classList.add('active');
                break;
            case 'services.html':
            case 'student-offers.html':
                document.querySelector('.nav-services')?.classList.add('active');
                break;
            case 'destinations.html':
                document.querySelector('.nav-destinations')?.classList.add('active');
                break;
            case 'rates.html':
                document.querySelector('.nav-rates')?.classList.add('active');
                break;
            case 'contact.html':
            case 'booking.html':
                document.querySelector('.nav-contact')?.classList.add('active');
                break;
        }
        
        // Special handling for pages in subdirectories
        if (currentPage.includes('.html')) {
            const path = window.location.pathname;
            if (path.includes('/destinations/')) {
                document.querySelector('.nav-destinations')?.classList.add('active');
            } else if (path.includes('/pages/')) {
                document.querySelector('.nav-destinations')?.classList.add('active');
            }
        }
    }

    // Initialize navigation if there's a header element
    const header = document.querySelector('header');
    if (header && !header.querySelector('nav')) {
        header.innerHTML = createNavigation();
    }

    // Set active navigation
    setActiveNav();

    // Mobile menu functionality
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function() {
            navLinks?.classList.remove('active');
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!header?.contains(event.target)) {
            navLinks?.classList.remove('active');
        }
    });
});

// Export functions for use in other scripts if needed
window.SpiresTaxis = {
    createNavigation: function() {
        return createNavigation();
    },
    setActiveNav: function() {
        return setActiveNav();
    }
};
