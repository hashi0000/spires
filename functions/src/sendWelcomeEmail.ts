import * as functions from "firebase-functions/v1";
import * as nodemailer from "nodemailer";

/** Lazy init: avoid `functions.config()` at module load (breaks Firebase deploy code analysis / times out). */
let welcomeTransporter: nodemailer.Transporter | null = null;
function getWelcomeTransporter(): nodemailer.Transporter {
  if (!welcomeTransporter) {
    const config = functions.config();
    welcomeTransporter = nodemailer.createTransport({
      host: config.smtp?.host || "smtp.ionos.co.uk",
      port: Number(config.smtp?.port || 587),
      secure: false,
      auth: {
        user: config.email?.user || "bookings@spires-taxis.com",
        pass: config.email?.pass,
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return welcomeTransporter;
}

export async function sendWelcomeEmail(customerData: any) {
  try {
    const { email, firstName, lastName } = customerData;
    
    if (!email) {
      functions.logger.warn("No email provided for welcome email");
      return;
    }

    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "Customer";

    // Welcome email
    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #002147; font-size: 28px; margin: 0;">Welcome to Spires Taxis!</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">Dear ${fullName},</p>
        
        <p style="font-size: 16px; line-height: 1.6;">
          Thank you for signing up with Spires Taxis! We're delighted to have you as part of our community.
        </p>
        
        <div style="background: #f7f9fc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C5A572;">
          <h2 style="color: #002147; font-size: 20px; margin-top: 0;">🎉 Special Offer</h2>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            Book an <strong>airport return trip</strong> through our website and get <strong>£5 off the total</strong>! 
            This offer is valid until <strong>December 31st, 2025</strong>.
          </p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">
          You can now:
        </p>
        <ul style="font-size: 16px; line-height: 1.8;">
          <li>Book your journeys online through your account</li>
          <li>View and manage your bookings</li>
          <li>Save your favorite addresses for quick booking</li>
          <li>Track your booking history</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://customer.spires-taxis.com" 
             style="background: #002147; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Access Your Account
          </a>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">
          If you have any questions or need assistance, please don't hesitate to contact us:
        </p>
        
        <div style="background: #f7f9fc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 14px;">
            📞 <strong>Phone:</strong> <a href="tel:+447776897772" style="color: #002147;">07776 897772</a><br>
            💬 <strong>WhatsApp:</strong> <a href="https://wa.me/447776897772" style="color: #002147;">07776 897772</a><br>
            📧 <strong>Email:</strong> <a href="mailto:bookings@spires-taxis.com" style="color: #002147;">bookings@spires-taxis.com</a><br>
            🌐 <strong>Website:</strong> <a href="https://www.spires-taxis.com" style="color: #002147;">www.spires-taxis.com</a>
          </p>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          Best regards,<br>
          <strong>The Spires Taxis Team</strong>
        </p>
      </div>
    `;

    await getWelcomeTransporter().sendMail({
      from: `"Spires Taxis" <bookings@spires-taxis.com>`,
      to: email,
      subject: "Welcome to Spires Taxis - Your Account is Ready!",
      html: welcomeHtml,
    });

    functions.logger.info(`✅ Welcome email sent to ${email}`);

    // Login details email
    const loginHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #002147; font-size: 28px; margin: 0;">Your Spires Taxis Login Details</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">Dear ${fullName},</p>
        
        <p style="font-size: 16px; line-height: 1.6;">
          Here are your login details for your Spires Taxis account:
        </p>
        
        <div style="background: #f7f9fc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C5A572;">
          <p style="margin: 10px 0; font-size: 16px;">
            <strong>Email:</strong> ${email}<br>
            <strong>Password:</strong> [The password you created during signup]
          </p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>🔒 Security Note:</strong> For your security, we don't store your password in plain text. 
            If you forget your password, you can reset it using the "Forgot Password" link on the login page.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://customer.spires-taxis.com" 
             style="background: #002147; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Login to Your Account
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          If you didn't create this account, please contact us immediately at 
          <a href="mailto:bookings@spires-taxis.com" style="color: #002147;">bookings@spires-taxis.com</a>
        </p>
        
        <p style="font-size: 14px; color: #666;">
          Best regards,<br>
          <strong>The Spires Taxis Team</strong>
        </p>
      </div>
    `;

    await getWelcomeTransporter().sendMail({
      from: `"Spires Taxis" <bookings@spires-taxis.com>`,
      to: email,
      subject: "Your Spires Taxis Login Details",
      html: loginHtml,
    });

    functions.logger.info(`✅ Login details email sent to ${email}`);
  } catch (err) {
    functions.logger.error("❌ Failed to send welcome email", err);
  }
}

