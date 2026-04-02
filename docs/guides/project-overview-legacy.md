# Spires Taxis Admin Dashboard

## Project Overview
A comprehensive admin dashboard for Spires Taxis, Oxford's premium taxi service. This project combines a static website with a React-based admin dashboard for managing bookings, drivers, vehicles, and generating compliance reports.

## Project Structure
```
spires-taxis-admin/
├── index.html                  # Main website homepage
├── about.html                  # About page
├── contact.html                # Contact page
├── services.html               # Services page
├── css/                        # Website stylesheets
├── js/                         # Website JavaScript
├── images/                     # Website assets
├── spires-admin-dashboard/     # React admin app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── build/                  # Built React app
├── admin/                      # Deployed admin dashboard
├── package.json                # Main project config
├── netlify.toml               # Netlify configuration
├── vercel.json                # Vercel configuration
├── .nvmrc                     # Node version specification
└── .env                       # Environment variables
```

## Features

### Main Website
- Professional landing page for Spires Taxis
- Service information and pricing
- Contact and booking information
- Responsive design optimized for Oxford market

### Admin Dashboard
- **Booking Management**: Create, edit, delete, and track taxi bookings
- **Driver Management**: Manage driver information and licenses
- **Vehicle Management**: Track vehicle details and availability
- **PDF Generation**: Create professional trip confirmation PDFs
- **Firebase Integration**: Real-time database for data persistence
- **Compliance Features**: Oxford City Council compliance tracking
- **Export Functionality**: CSV export for bookings

## Technology Stack

### Frontend
- **React 18.x**: Admin dashboard framework
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling framework
- **HTML/CSS/JS**: Main website

### Backend & Database
- **Firebase Firestore**: Real-time database
- **Firebase Authentication**: User management
- **Firebase Hosting**: Static file hosting

### PDF Generation
- **jsPDF**: PDF creation library
- **jsPDF-AutoTable**: Table generation for PDFs

### Development & Deployment
- **Node.js 22.x**: Runtime environment
- **Vercel**: Deployment platform
- **GitHub**: Version control
- **IONOS**: Domain management

## Setup Instructions

### Prerequisites
- Node.js 22.x or higher
- npm 10.x or higher
- Git
- Firebase account
- Vercel account (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/hashi0000/spires-taxis-admin.git
   cd spires-taxis-admin
   ```

2. **Install dependencies**
   ```bash
   cd spires-admin-dashboard
   npm install
   ```

3. **Set up environment variables**
   Create `.env` file in `spires-admin-dashboard/`:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=spires-taxis.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=spires-taxis
   REACT_APP_FIREBASE_STORAGE_BUCKET=spires-taxis.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
   DISABLE_ESLINT_PLUGIN=true
   ```

4. **Start development server**
   ```bash
   npm start
   ```

### Building for Production

1. **Build the React app**
   ```bash
   cd spires-admin-dashboard
   npm run build
   ```

2. **Copy to admin folder**
   ```bash
   cd ..
   cp -r spires-admin-dashboard/build/* admin/
   ```

## Deployment

### Vercel Deployment (Recommended)

1. **Connect GitHub repository to Vercel**
2. **Configure build settings:**
   - Build Command: `cd spires-admin-dashboard && npm install && npm run build`
   - Output Directory: `.`
   - Node.js Version: 22.x

3. **Add environment variables in Vercel dashboard**

4. **Deploy automatically on push to main branch**

### Manual Deployment
- Drag and drop the entire project folder to Vercel
- Ensure `admin/` folder contains the built React app

## Firebase Configuration

### Firestore Collections
- `bookings`: Store taxi booking information
- `drivers`: Driver details and licenses
- `vehicles`: Vehicle information and status

### Security Rules (Development)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Note: Change for production
    }
  }
}
```

## Usage

### Accessing the Application
- **Main Website**: `https://your-domain.com/`
- **Admin Dashboard**: `https://your-domain.com/admin/`

### Admin Dashboard Features

1. **Dashboard**: Overview and compliance information
2. **Bookings**: Manage all taxi bookings
3. **Drivers**: Add and manage driver information
4. **Vehicles**: Track vehicle details and availability
5. **Compliance**: Oxford City Council compliance tracking
6. **Reports**: Generate and export data

### Creating Bookings
1. Navigate to Bookings section
2. Click "New Booking"
3. Fill out customer and journey details
4. Assign driver and vehicle
5. Save booking to Firebase

### Generating PDFs
1. Navigate to booking list
2. Click PDF button next to any booking
3. Professional trip confirmation downloads automatically
4. Filename format: `Trip_Confirmation_[BookingID].pdf`

## Troubleshooting

### Common Issues

1. **Blank Admin Screen**
   - Check browser console for JavaScript errors
   - Verify Firebase environment variables
   - Ensure admin folder contains current React build

2. **Data Not Saving**
   - Check Firebase connection status
   - Verify Firestore security rules
   - Check environment variables in deployment platform

3. **Build Failures**
   - Ensure Node.js version is 22.x
   - Clear node_modules and reinstall dependencies
   - Check for ESLint errors

4. **PDF Generation Issues**
   - Verify jsPDF libraries are installed
   - Check browser console for errors
   - Ensure booking data is complete

### Firebase Issues
- Check Firebase project configuration
- Verify API keys are correct
- Ensure Firestore is enabled
- Check security rules allow read/write

## Development History

This project went through several deployment challenges:
- Initial attempts with Netlify faced dependency conflicts
- React 19 compatibility issues required downgrade to React 18
- ESLint configuration conflicts resolved
- Node.js version requirements updated for Vercel
- Firebase integration debugging and optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test locally
4. Submit a pull request

## License

This project is private and proprietary to Spires Taxis.

## Contact

For support or questions:
- **Website**: www.spires-taxis.com
- **Phone**: 07776 897772
- **Email**: Contact through website

---

**Note**: This is a production application for Spires Taxis. Ensure all Firebase keys and sensitive information are properly secured before deploying to production.

apiKey: "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
  authDomain: "spires-taxis.firebaseapp.com",
  projectId: "spires-taxis",
  storageBucket: "spires-taxis.firebasestorage.app",
  messagingSenderId: "12158743704",
  appId: "1:12158743704:web:402ace8b3430906bf28ced",
  measurementId: "G-8JQVEJB1NR"