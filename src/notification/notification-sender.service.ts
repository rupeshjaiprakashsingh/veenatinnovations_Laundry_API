import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationSenderService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // SMTP transporter - used only when Brevo API key is NOT set (local dev)
    const emailService = (process.env.EMAIL_SERVICE || '').trim();
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_PASS || '').trim();

    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    if (brevoKey) {
      console.log('[EMAIL SETUP] Using Brevo HTTP API for email sending (Render-compatible)');
      // No SMTP transporter needed - we use fetch() against Brevo REST API
    } else if (emailService && emailUser && emailPass) {
      console.log('[EMAIL SETUP] No BREVO_API_KEY found. Falling back to SMTP (local dev only)');
      const transportOptions: any = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,
        auth: { user: emailUser, pass: emailPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      };
      this.transporter = nodemailer.createTransport(transportOptions as any);
    } else {
      console.warn('[EMAIL SETUP] No email credentials found. Emails will be logged but not sent.');
    }
  }

  /**
   * Core send method.
   * Priority: Brevo HTTP API → SMTP (local dev fallback)
   * Brevo works on Render because it uses HTTPS (port 443), not SMTP ports which Render blocks.
   */
  async sendEmail(to: string, subject: string, html: string) {
    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const fromName = 'Saimorphix Innovations Laundry';
    const fromEmail = emailUser || 'no-reply@veenatinnovations.com';

    // --- Brevo HTTP API (Render-compatible) ---
    if (brevoKey) {
      console.log(`[EMAIL SENDING] Brevo API → to=${to} subject="${subject}"`);
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        const responseText = await response.text();
        if (!response.ok) {
          console.error(`[EMAIL ERROR] Brevo API error ${response.status}: ${responseText}`);
          throw new Error(`Brevo API error ${response.status}: ${responseText}`);
        }

        console.log(`[EMAIL SENT] Brevo API → to=${to} status=${response.status}`);
        return { messageId: `brevo-${Date.now()}`, response: responseText };
      } catch (err: any) {
        console.error(`[EMAIL FATAL] Brevo API failed:`, err?.message || err);
        throw err;
      }
    }

    // --- SMTP Fallback (local dev) ---
    if (this.transporter) {
      console.log(`[EMAIL SENDING] SMTP fallback → to=${to} subject="${subject}"`);
      try {
        const info = await this.transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          html,
        });
        console.log(`[EMAIL SENT] SMTP → to=${to} messageId=${info.messageId}`);
        return info;
      } catch (err: any) {
        console.error(`[EMAIL ERROR] SMTP failed:`, err?.message || err);
        throw err;
      }
    }

    // --- No transport configured ---
    console.warn(`[EMAIL SKIPPED] No transport configured. Would have sent: to=${to} subject="${subject}"`);
    return { messageId: 'skipped', skipped: true };
  }

  async sendSMS(to: string, message: string) {
    console.log(`[SMS SENT] To: ${to} | Message: "${message}"`);
  }

  async sendRegistrationEmail(to: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Welcome to Saimorphix Innovations Laundry!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for registering with us. We are excited to provide you with the best laundry and pickup services in India!</p>
        <p>You can now book laundry, dry cleaning, and ironing services right from your doorstep.</p>
        <br />
        <p style="text-align: center;">
          <a href="#" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Book Your First Order</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, 'Welcome to Saimorphix Innovations Laundry!', html);
  }

  async sendOrderCreatedEmail(to: string, name: string, orderNumber: string, amount: number, items: any[]) {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.clothType}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.service?.serviceName || 'Service'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Order Confirmed!</h2>
        <p>Dear ${name},</p>
        <p>Your laundry order <strong>#${orderNumber}</strong> has been successfully received and scheduled for pickup.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Cloth Type</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Service</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <p style="font-size: 16px; font-weight: bold; text-align: right; color: #4F46E5;">Total Amount: ₹${amount}</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Order #${orderNumber} Confirmed!`, html);
  }

  async sendInvoiceEmail(to: string, name: string, orderNumber: string, amount: number, items: any[]) {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.clothType}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.service?.serviceName || 'Service'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #10B981; text-align: center;">Delivery Complete & Invoice</h2>
        <p>Dear ${name},</p>
        <p>Thank you for choosing Saimorphix Innovations Laundry. Your order <strong>#${orderNumber}</strong> has been successfully delivered to your doorstep.</p>
        <p>Here is your invoice summary:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Cloth Type</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Service</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <p style="font-size: 16px; font-weight: bold; text-align: right; color: #10B981;">Total Paid Amount: ₹${amount}</p>
        <p style="text-align: center; color: #10B981; font-weight: bold; font-size: 18px; margin: 20px 0;">Payment Status: PAID</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Invoice for Order #${orderNumber}`, html);
  }

  async sendDeliveryOtp(toEmail: string, toMobile: string, name: string, orderNumber: string, otp: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #F59E0B; text-align: center;">Delivery OTP Verification</h2>
        <p>Dear ${name},</p>
        <p>The delivery boy is at your doorstep to deliver order <strong>#${orderNumber}</strong>.</p>
        <p>Please share the following OTP with the delivery boy to confirm successful receipt of your clothes:</p>
        <div style="background-color: #FFFBEB; border: 1px solid #FCD34D; color: #B45309; text-align: center; font-size: 32px; font-weight: bold; padding: 15px; border-radius: 6px; letter-spacing: 4px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #991B1B; font-weight: bold;">Important: Do not share this OTP with anyone other than the assigned delivery boy.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(toEmail, 'Delivery OTP Verification', html);
    await this.sendSMS(toMobile, `Saimorphix Innovations Laundry: Use OTP ${otp} to verify delivery of order #${orderNumber}. Do not share this OTP.`);
  }

  async sendPaymentReceivedEmail(to: string, name: string, orderNumber: string, amount: number, paymentMode: string, transactionReference?: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #10B981; margin: 0; font-size: 24px; font-weight: 700;">Payment Received!</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Thank you for your payment.</p>
        </div>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Dear ${name},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">We have successfully received and processed your payment for order <strong>#${orderNumber}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Transaction Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #475569;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Amount Paid:</td>
              <td style="padding: 6px 0; text-align: right; color: #10B981; font-weight: 700; font-size: 16px;">₹${amount}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Payment Method:</td>
              <td style="padding: 6px 0; text-align: right;">${paymentMode}</td>
            </tr>
            ${transactionReference ? `
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Transaction Ref:</td>
              <td style="padding: 6px 0; text-align: right; font-family: monospace;">${transactionReference}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">If you have any questions regarding this transaction, please reply to this email or contact our customer support.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Payment Confirmation: Order #${orderNumber}`, html);
  }

  async sendOrderStatusUpdateEmail(to: string, name: string, orderNumber: string, status: string) {
    let statusDescription = `Your order status has been updated to ${status}.`;
    let statusColor = '#4F46E5'; // indigo
    let icon = '🔄';

    switch (status) {
      case 'Pickup Scheduled':
        statusDescription = 'A delivery agent has been assigned and is on the way to pick up your clothes.';
        statusColor = '#3B82F6'; // blue
        icon = '🛵';
        break;
      case 'Picked Up':
        statusDescription = 'Your clothes have been successfully picked up and are on the way to our laundry facility.';
        statusColor = '#8B5CF6'; // purple
        icon = '👕';
        break;
      case 'Processing':
        statusDescription = 'Your clothes are being sorted and prepared for laundry.';
        statusColor = '#EAB308'; // yellow
        icon = '🧼';
        break;
      case 'Washing':
        statusDescription = 'Your clothes are currently undergoing the washing process.';
        statusColor = '#06B6D4'; // cyan
        icon = '🌊';
        break;
      case 'Ironing':
        statusDescription = 'Your clothes are being ironed and steam-pressed to perfection.';
        statusColor = '#F97316'; // orange
        icon = '💨';
        break;
      case 'Ready For Delivery':
        statusDescription = 'Good news! Your clean clothes are ready and packed for delivery.';
        statusColor = '#10B981'; // green
        icon = '📦';
        break;
      case 'Out For Delivery':
        statusDescription = 'Your clean clothes have been handed over to our delivery partner and are out for delivery.';
        statusColor = '#06B6D4'; // cyan
        icon = '🛵';
        break;
      case 'Delivered':
        statusDescription = 'Your order has been successfully delivered! Thank you for choosing Saimorphix Innovations Laundry.';
        statusColor = '#10B981'; // green
        icon = '🎉';
        break;
      case 'Cancelled':
        statusDescription = 'Your order has been cancelled.';
        statusColor = '#EF4444'; // red
        icon = '❌';
        break;
    }

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="font-size: 40px; margin-bottom: 10px; display: inline-block;">${icon}</span>
          <h2 style="color: ${statusColor}; margin: 0; font-size: 24px; font-weight: 700;">Order Status Update</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Order #${orderNumber}</p>
        </div>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Dear ${name},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">The status of your laundry order <strong>#${orderNumber}</strong> has changed:</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid ${statusColor}; border-radius: 4px; padding: 15px 20px; margin: 20px 0;">
          <h3 style="color: ${statusColor}; margin: 0 0 5px 0; font-size: 16px; font-weight: 700;">${status}</h3>
          <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.5;">${statusDescription}</p>
        </div>
        
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">You can track the progress of your order live inside our Grivana app.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">© Saimorphix Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Order #${orderNumber} Status: ${status}`, html);
  }
}
