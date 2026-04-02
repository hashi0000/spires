# Spires Taxis Navigation Bar - Installation Guide

## 📁 Files Created

1. **`nav-snippet.html`** - Complete HTML navigation code (copy into your HTML files)
2. **`css/navbar.css`** - Complete CSS styling file

## 🚀 Quick Installation

### Step 1: Add CSS File to Your HTML

In the `<head>` section of each HTML file, add:

```html
<link rel="stylesheet" href="css/navbar.css">
```

### Step 2: Replace Existing Navigation

1. Find your existing `<header>` or `<nav>` section in your HTML file
2. Replace it with the code from `nav-snippet.html`
3. The snippet includes:
   - Complete HTML structure
   - Inline JavaScript for mobile menu functionality
   - All necessary classes and IDs

### Step 3: Add Spacer for Fixed Navbar

Since the navbar is fixed at the top, add a spacer div right after the header:

```html
<header class="navbar-header">
    <!-- Navigation code here -->
</header>

<!-- Add this spacer to prevent content from going under navbar -->
<div class="navbar-spacer"></div>

<!-- Your page content starts here -->
```

## ✏️ Easy Customization

### Change Logo Text

Edit the logo lines in the HTML:
```html
<span class="logo-line1">SPIRES</span>
<span class="logo-line2">TAXIS</span>
```

### Change Navigation Links

Edit the links in the `<ul class="nav-links">` section:
```html
<li><a href="./your-page.html" class="nav-link">Your Link</a></li>
```

### Change Phone Number

Find and edit:
```html
<a href="tel:+447776897772" class="navbar-phone">07776 897772</a>
```

### Change Button Text

Edit the button labels:
```html
<a href="./contact.html" class="btn-book-online">Book Online</a>
<a href="./customer-app/" class="btn-my-account">My Account</a>
```

### Change Colors

Edit CSS variables in `css/navbar.css`:
```css
:root {
    --navy-blue: #0b214a;      /* Change navy color */
    --gold-accent: #C19A5B;     /* Change gold color */
    --white: #ffffff;
    --whatsapp-green: #25D366;
}
```

## 📱 Features

✅ **Two-line logo**: "SPIRES" / "TAXIS" with gold underline  
✅ **Centered navigation**: Links evenly spaced in the center  
✅ **Contact info**: Phone number and WhatsApp icon  
✅ **Action buttons**: Book Online (navy) and My Account (gold)  
✅ **Mobile menu**: Smooth hamburger menu that slides down  
✅ **Gold line**: Stays visible under logo even when menu opens  
✅ **Active link**: Automatically highlights current page  
✅ **Smooth animations**: Fade and slide transitions  

## 🎨 Design Details

- **Navbar height**: 80px
- **Logo font**: Cinzel (serif)
- **Text font**: Inter / Poppins (sans-serif)
- **Gold line**: 3px thick, directly under logo
- **Mobile breakpoint**: 768px

## 📝 Notes

- The navbar is **fixed** at the top - always add the spacer div
- Mobile menu closes automatically when clicking a link
- Body scroll is disabled when mobile menu is open
- Active page is automatically detected and highlighted
- All links use relative paths (e.g., `./contact.html`)

## ✅ Ready to Use!

Copy the code from `nav-snippet.html` into your HTML files and add the CSS link. The navigation bar is fully functional and ready to go!



