# Spires Taxis Oxford - Website & Admin Dashboard

> Premium taxi service website with integrated admin dashboard for managing Oxford taxi operations.

## 🌐 Live Website
- **Main Website**: [spirestaxis.co.uk](https://spirestaxis.co.uk)
- **Admin Dashboard**: [spirestaxis.co.uk/admin](https://spirestaxis.co.uk/admin)

## 📋 Project Overview

Spires Taxis is a premium taxi service based in Oxford, UK. This project consists of:

1. **Public Website** - Customer-facing site for bookings and information
2. **Admin Dashboard** - React-based management system for operations

## 🏗️ Project Structure

```
spires-taxis/
├── index.html                 # Main website homepage
├── services.html              # Services page
├── destinations.html          # Popular destinations
├── rates.html                # Pricing information
├── about.html                # About us page
├── contact.html              # Contact information
├── login.html                # Admin login page
├── css/
│   └── style.css             # Main website styles
├── js/
│   ├── navigation.js         # Navigation functionality
│   └── main.js              # General JavaScript
├── admin/                    # React admin dashboard (built)
│   ├── index.html           # Dashboard entry point
│   ├── static/             # React build assets
│   └── manifest.json       # PWA manifest
└── spires-admin-dashboard/   # React source code
    ├── src/
    ├── public/
    ├── package.json
    └── build/
```

## 🎨 Features

### Public Website
- **Modern Design**: Oxford University inspired color scheme (Oxford Blue #002147, Oxford Gold #C5A572)
- **Mobile Responsive**: Optimized for all devices
- **Professional Layout**: Clean, trustworthy design for taxi business
- **Contact Integration**: Phone, WhatsApp, and email contact options
- **SEO Optimized**: Local search optimization for Oxford taxi services

### Admin Dashboard
- **Secure Login**: Protected access with username/password
- **Professional Interface**: Blue gradient sidebar with navigation
- **Multiple Sections**:
  - Dashboard - Overview and statistics
  - Bookings - Trip management
  - Drivers - Driver information
  - Vehicles - Fleet management
  - Reports - Business analytics
- **Mobile Responsive**: Works on all devices

## 🚀 Technology Stack

### Frontend (Public Website)
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS Variables
- **JavaScript** - Interactive features
- **Google Fonts** - Cinzel, Playfair Display, Inter

### Admin Dashboard
- **React 18** - Modern React with hooks
- **CSS Modules** - Component-scoped styling
- **Lucide React** - Professional icon library
- **Session Storage** - Authentication state management

### Hosting & Deployment
- **Netlify** - Static site hosting
- **Ionos** - Domain registration (.co.uk)
- **Custom Domain** - spirestaxis.co.uk

## 🔧 Setup & Development

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spires-taxis
   ```

2. **Install React dashboard dependencies**
   ```bash
   cd spires-admin-dashboard
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

### Local Development

1. **Main Website**: Open `index.html` in browser or use live server
2. **Admin Dashboard**: Run `npm start` in `spires-admin-dashboard/` folder

## 🔐 Authentication

### Admin Login Credentials
- **Username**: `admin`
- **Password**: `spires2024`

**Alternative:**
- **Username**: `spiresadmin` 
- **Password**: `oxford123`

### Security Notes
- Credentials stored in client-side JavaScript (development only)
- For production: Implement proper backend authentication
- Use environment variables for sensitive data
- Consider JWT tokens or OAuth

## 📱 Mobile Optimization

The website is fully responsive with:
- **Breakpoints**: 
  - Desktop: 1024px+
  - Tablet: 768px - 1023px  
  - Mobile: 320px - 767px
- **Touch-friendly**: 44px minimum touch targets
- **Performance**: Optimized images and CSS
- **Navigation**: Hamburger menu for mobile

## 🎯 Business Information

### Contact Details
- **Phone**: 07776 897772
- **Email**: bookings@spires-taxis.com@gmail.com
- **WhatsApp**: Available
- **Coverage**: Oxford, Oxfordshire, Airport transfers
- **Hours**: 24/7 service

### Key Services
- Airport transfers (Heathrow, Gatwick, Luton)
- Student discounts for Oxford University
- Local Oxford transport
- Corporate travel
- Long-distance journeys

## 🚀 Deployment

### Production Deployment

1. **Build React Dashboard**
   ```bash
   cd spires-admin-dashboard
   npm run build
   ```

2. **Copy build files to admin folder**
   ```bash
   cp -r build/* ../admin/
   ```

3. **Upload to Netlify**
   - Drag entire project folder to Netlify
   - Configure custom domain
   - Set up SSL/HTTPS

### Environment Variables
For production, set these environment variables:
- `REACT_APP_API_URL` - Backend API endpoint
- `REACT_APP_AUTH_SECRET` - Authentication secret

## 🔍 SEO & Local Search

### Keywords Targeting
- "Oxford taxi"
- "airport transfer Oxford"
- "Heathrow taxi Oxford"
- "student taxi Oxford"
- "taxi service Oxford"

### Local SEO Setup
- Google Business Profile configured
- Schema markup for TaxiService
- Local citations and directories
- Reviews management

## 🐛 Troubleshooting

### Common Issues

1. **Admin dashboard not loading**
   - Check if `/admin/` path is accessible
   - Verify build files copied correctly
   - Check console for JavaScript errors

2. **Mobile layout issues**
   - Clear browser cache
   - Check viewport meta tag
   - Verify CSS media queries

3. **Login not working**
   - Check browser console for errors
   - Verify credentials
   - Check session storage support

## 📄 License

This project is proprietary software for Spires Taxis Oxford.

## 🤝 Contributing

This is a private business website. For updates or modifications, contact the development team.

---

**Built with ❤️ for Oxford's newest premium taxi service**

*Last updated: July 2025*