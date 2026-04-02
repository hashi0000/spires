// Spires Taxis - Main JavaScript File
// Sophisticated interactions and animations

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize all components
    initSmoothScrolling();
    initHeaderEffects();
    initMobileMenu();
    initAnimations();
    initContactTracking();
    initFormHandling();
    
    console.log('Spires Taxis website initialized successfully');
});

// Smooth scrolling for internal links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Header scroll effects and transparency
function initHeaderEffects() {
    const header = document.querySelector('header');
    let ticking = false;
    
    function updateHeader() {
        const scrolled = window.scrollY;
        
        if (scrolled > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
}

// Mobile menu functionality
function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const overlay = document.querySelector('.mobile-nav-overlay');
    const panel = document.querySelector('.mobile-nav-panel');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-list a');
    
    function openMobileMenu() {
        if (overlay) overlay.classList.add('active');
        if (panel) panel.classList.add('active');
        if (mobileToggle) mobileToggle.classList.add('active');
        document.body.classList.add('mobile-menu-open');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        if (mobileToggle) mobileToggle.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
        document.body.style.overflow = '';
    }
    
    // Ensure menu starts closed - do this immediately
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = '';
    }
    if (panel) {
        panel.classList.remove('active');
        panel.style.display = '';
    }
    if (mobileToggle) {
        mobileToggle.classList.remove('active');
    }
    document.body.classList.remove('mobile-menu-open');
    document.body.style.overflow = '';
    
    if (mobileToggle) {
        // Toggle menu on hamburger click
        mobileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!overlay || !panel) {
                console.error('Mobile menu elements not found');
                return;
            }
            
            // Check if panel actually has active class
            const hasActiveClass = panel.classList.contains('active');
            
            if (hasActiveClass) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        // Close menu when clicking overlay
        if (overlay) {
            overlay.addEventListener('click', function() {
                closeMobileMenu();
            });
        }

        // Close menu when clicking on any nav link
        if (mobileNavLinks && mobileNavLinks.length > 0) {
            mobileNavLinks.forEach(link => {
                link.addEventListener('click', function() {
                    closeMobileMenu();
                });
            });
        }

        // Close menu on window resize if screen becomes large
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });
    }
}

// Intersection Observer for animations
function initAnimations() {
    // Configuration for the observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px'
    };
    
    // Callback function for intersection observer
    const observerCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Add staggered delay for multiple elements
                const siblings = Array.from(entry.target.parentNode.children);
                const index = siblings.indexOf(entry.target);
                entry.target.style.transitionDelay = `${index * 100}ms`;
            }
        });
    };
    
    // Create observer
    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Observe all elements with fade-in class
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
    
    // Additional animation for cards on hover
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Contact form and phone tracking
function initContactTracking() {
    // Track phone number clicks for analytics
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
        link.addEventListener('click', function(e) {
            const phoneNumber = this.href.replace('tel:', '');
            const source = this.closest('section')?.className || 'unknown';
            
            // Log the interaction (replace with actual analytics)
            trackEvent('phone_click', {
                phone_number: phoneNumber,
                source: source,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Phone clicked: ${phoneNumber} from ${source}`);
        });
    });
    
    // Track email clicks
    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        link.addEventListener('click', function(e) {
            const email = this.href.replace('mailto:', '');
            const source = this.closest('section')?.className || 'unknown';
            
            trackEvent('email_click', {
                email: email,
                source: source,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Email clicked: ${email} from ${source}`);
        });
    });
}

// Form handling and validation
function initFormHandling() {
    // Handle contact forms when they exist
    const contactForms = document.querySelectorAll('form[data-form="contact"]');
    
    contactForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (validateForm(this)) {
                submitForm(this);
            }
        });
    });
    
    // Real-time validation for inputs
    document.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            // Clear error state on input
            this.classList.remove('error');
            const errorMsg = this.parentNode.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        });
    });
}

// Form validation functions
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const type = field.type;
    let isValid = true;
    let errorMessage = '';
    
    // Clear previous errors
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    // Email validation
    else if (type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    // Phone validation
    else if (type === 'tel' && value) {
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]+$/;
        if (!phoneRegex.test(value) || value.length < 10) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }
    }
    
    // Show error if validation failed
    if (!isValid) {
        field.classList.add('error');
        showFieldError(field, errorMessage);
    }
    
    return isValid;
}

function showFieldError(field, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.color = '#dc2626';
    errorDiv.style.fontSize = '0.85rem';
    errorDiv.style.marginTop = '0.25rem';
    
    field.parentNode.appendChild(errorDiv);
}

// Form submission
function submitForm(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    // Show loading state
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Simulate form submission (replace with actual endpoint)
    setTimeout(() => {
        console.log('Form submitted:', data);
        
        // Show success message
        showNotification('Thank you! Your message has been sent successfully. We\'ll contact you shortly.', 'success');
        
        // Reset form
        form.reset();
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        
        // Track form submission
        trackEvent('form_submit', {
            form_type: 'contact',
            timestamp: new Date().toISOString()
        });
        
    }, 2000);
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : '#3b82f6',
        color: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: '10000',
        maxWidth: '400px',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    const autoRemoveTimeout = setTimeout(() => {
        removeNotification(notification);
    }, 5000);
    
    // Manual close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        clearTimeout(autoRemoveTimeout);
        removeNotification(notification);
    });
}

function removeNotification(notification) {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Analytics tracking function (replace with your analytics service)
function trackEvent(eventName, properties = {}) {
    // Replace this with your actual analytics implementation
    // Examples: Google Analytics, Mixpanel, etc.
    
    console.log('Event tracked:', eventName, properties);
    
    // Example Google Analytics 4 implementation:
    // gtag('event', eventName, properties);
    
    // Example Facebook Pixel implementation:
    // fbq('track', eventName, properties);
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Page-specific initializations
function initPageSpecific() {
    const currentPage = document.body.dataset.page;
    
    switch(currentPage) {
        case 'home':
            initHomepage();
            break;
        case 'services':
            initServicesPage();
            break;
        case 'contact':
            initContactPage();
            break;
        case 'booking':
            initBookingPage();
            break;
    }
}

// Homepage specific functions
function initHomepage() {
    // Add any homepage-specific functionality here
    console.log('Homepage initialized');
}

// Services page specific functions
function initServicesPage() {
    // Add any services page-specific functionality here
    console.log('Services page initialized');
}

// Contact page specific functions
function initContactPage() {
    // Add any contact page-specific functionality here
    console.log('Contact page initialized');
}

// Booking page specific functions
function initBookingPage() {
    // Add any booking page-specific functionality here
    console.log('Booking page initialized');
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    // You could send this to an error tracking service
});

// Performance monitoring
window.addEventListener('load', function() {
    // Monitor page load performance
    const perfData = performance.timing;
    const loadTime = perfData.loadEventEnd - perfData.navigationStart;
    
    console.log(`Page loaded in ${loadTime}ms`);
    
    // Track performance if needed
    trackEvent('page_load', {
        load_time: loadTime,
        page: window.location.pathname
    });
});

// Export functions for use in other scripts if needed
window.SpiresTaxis = {
    showNotification,
    trackEvent,
    validateForm,
    debounce,
    throttle
};