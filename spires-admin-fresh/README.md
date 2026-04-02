# Spires Taxis Website Structure & Design Guide

## File Organization
```
spires-taxis/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
├── images/
│   ├── blenheim.jpg
│   ├── bridge-of-sighs.jpg
│   ├── carfax-tower.jpg
│   ├── christ-church.jpg
│   ├── oxford-station.jpg
│   ├── sheldonian-exterior.jpg
│   └── westgate-centre.jpg
├── pages/
│   ├── about.html
│   ├── airport.html
│   ├── booking.html
│   ├── contact.html
│   ├── coverage.html
│   ├── rates.html
│   ├── seo.html
│   └── services.html
└── destinations/
    ├── blenheim-palace.html
    ├── cotswold-tours.html
    ├── oxford-colleges.html
    ├── stratford-upon-avon.html
    └── warner-bros-studios.html
```

## Navigation Structure

### Main Navigation
- **Home** (`../index.html`)
- **Services** (`../pages/services.html`)
- **Destinations** (dropdown menu)
- **About** (`../pages/about.html`)
- **Contact** (`../pages/contact.html`)

### Destinations Dropdown Menu
**Attractions Section:**
- Blenheim Palace (`blenheim-palace.html`)
- Oxford Colleges (`oxford-colleges.html`)
- Cotswolds Tours (`cotswold-tours.html`)
- Stratford-upon-Avon (`stratford-upon-avon.html`)
- Warner Bros Studios (`warner-bros-studios.html`)

**Transport Section:**
- Airport Transfers (`../pages/airport.html`)
- Book Now (`../pages/booking.html`)

**Information Section:**
- Rates (`../pages/rates.html`)
- Coverage Area (`../pages/coverage.html`)

### Header Elements
- **Logo:** "Spires Taxis" (links to home)
- **Phone CTA:** "07776 897772" (tel:+447776897772)
- **Mobile Menu Toggle:** Three-line hamburger menu

## CSS Classes & Design System

### Layout Classes
- `.hero` - Hero section container
- `.hero-content` - Content wrapper within hero
- `.hero-subtitle` - Small caps subtitle above main heading
- `.hero-buttons` - Button container in hero
- `.section` - Main content sections
- `.container` - Content wrapper (max-width container)
- `.section-header` - Section heading area
- `.section-title` - Main section heading (h2)
- `.section-subtitle` - Small caps section subtitle
- `.section-description` - Introductory paragraph

### Grid System
- `.grid` - Base grid container
- `.grid-2` - Two-column grid
- `.grid-3` - Three-column grid  
- `.grid-4` - Four-column grid

### Card Components
- `.card` - Basic card container
- `.card-icon` - Icon container within card
- `.contact-card` - Special styling for contact cards

### Button Classes
- `.btn` - Base button class
- `.btn-primary` - Primary golden button
- `.btn-secondary` - Secondary transparent button
- `.phone-cta` - Header phone button styling

### Navigation Classes
- `.nav-links` - Main navigation list
- `.dropdown` - Dropdown container
- `.dropdown-toggle` - Dropdown trigger link
- `.dropdown-menu` - Dropdown content container
- `.dropdown-section` - Individual dropdown sections
- `.mobile-menu-toggle` - Mobile hamburger menu

### Animation Classes
- `.fade-in` - Elements that animate in on scroll (requires JavaScript)
- `.visible` - Added by JavaScript when element comes into view

### Background Sections
- `.services-section` - Light cream background
- `.about-section` - White background  
- `.contact-section` - Dark background with white text

### Utility Classes
- `.accent-color` - Golden accent color text
- `.primary-color` - Primary dark color text
- `.text-center` - Center-aligned text
- `.text-left` - Left-aligned text
- `.text-right` - Right-aligned text

## Color Scheme (CSS Variables)

```css
:root {
    --primary-dark: #0f172a;
    --primary-blue: #1e293b;
    --accent-gold: #d4af37;
    --accent-gold-light: #f4e4bc;
    --text-dark: #1e293b;
    --text-gray: #64748b;
    --text-light: #94a3b8;
    --white: #ffffff;
    --cream: #fefcf3;
}
```

## Typography

### Font Families
- **Headings:** 'Playfair Display', serif
- **Body Text:** 'Inter', sans-serif

### Font Sizes (Responsive)
- **h1:** clamp(2.5rem, 5vw, 4rem)
- **h2:** clamp(2rem, 4vw, 3rem)
- **h3:** clamp(1.5rem, 3vw, 2rem)
- **h4:** clamp(1.25rem, 2.5vw, 1.5rem)
- **Body:** 1.1rem

## File Path Reference

### From `destinations/` folder:
- **CSS:** `../css/style.css`
- **JavaScript:** `../js/main.js`
- **Home:** `../index.html`
- **Pages:** `../pages/[filename].html`
- **Other Destinations:** `[filename].html`
- **Images:** `../images/[filename].jpg`

### From `pages/` folder:
- **CSS:** `../css/style.css`
- **JavaScript:** `../js/main.js`
- **Home:** `../index.html`
- **Destinations:** `../destinations/[filename].html`
- **Other Pages:** `[filename].html`
- **Images:** `../images/[filename].jpg`

## Content Style Guide

### Tone & Voice
- **Professional and sophisticated**
- **Premium/luxury focus**
- **Reliable and trustworthy**
- **Local expertise emphasis**
- **British English spelling and terminology**

### Terminology
- Use "chauffeur" instead of "driver"
- Use "luxury transport" or "premium service"
- Emphasise "professional," "reliable," "comfort"
- Reference "Oxford's premier" or "Oxfordshire's leading"
- **British spellings:** realise (not realize), colour (not color), centre (not center), organised (not organized), travelled (not traveled)
- **British terms:** car park (not parking lot), motorway (not highway), petrol station (not gas station), city centre (not downtown)

### Content Structure
1. **Hero Section:** Subtitle, main title, description, CTA buttons
2. **Introduction:** Section subtitle, title, detailed description
3. **Features/Services:** 3-4 cards with icons and descriptions
4. **Detailed Information:** 2-column layout with specifics
5. **Call to Action:** Contact cards with phone and online booking

### Contact Information
- **Email:** spirestaxis24@gmail.com (don't display the email but have a button to email us - also need to get booking form information sent to my email)
- **Phone:** 07776 897772
- **Service Area:** Oxford and surrounding areas
- **Specialties:** Airport transfers, attractions tours, premium transport

## JavaScript Features

### Main Functions (from main.js)
- `initSmoothScrolling()` - Smooth scroll for anchor links
- `initHeaderEffects()` - Header transparency on scroll
- `initMobileMenu()` - Mobile navigation toggle
- `initAnimations()` - Intersection Observer for fade-in effects
- `initContactTracking()` - Phone/email click tracking
- `initFormHandling()` - Form validation and submission

### Key Animations
- Elements with `.fade-in` class animate when scrolled into view
- Cards have hover effects (transform and scale)
- Header changes appearance on scroll
- Mobile menu toggles smoothly

## Responsive Breakpoints

### CSS Media Queries
- **Large screens:** 1024px and up
- **Tablets:** 768px - 1024px
- **Mobile:** Below 768px
- **Small mobile:** Below 480px

### Mobile Adaptations
- Navigation becomes hamburger menu
- Grid columns stack to single column
- Button layouts adjust for touch
- Text sizes scale responsively

## SEO & Meta Information

### Standard Meta Tags
- Title format: "[Page Title] - Spires Taxis | [Description]"
- Description: Focus on location, service type, and key benefits
- Keywords: Include "Oxford," "taxi," "chauffeur," "transport," location names

### Structured Data Opportunities
- Local Business markup
- Service area definitions
- Contact information
- Review/rating schemas

---

## Quick Reference for New Pages

### Standard Page Template Structure:
1. HTML head with correct CSS/JS paths
2. Header with navigation (copy from working page)
3. Hero section with subtitle, title, description, buttons
4. Multiple content sections using the grid system
5. Call-to-action section with contact cards
6. Footer
7. JavaScript include

### Required Classes for Consistency:
- Use `.fade-in` on content sections
- Use `.section` for main content areas
- Use `.container` to wrap content
- Use proper grid classes for layout
- Include section headers with subtitle/title/description pattern#   s p i r e s - t a x i s - f r e s h  
 #   s p i r e s - t a x i s - f r e s h  
 