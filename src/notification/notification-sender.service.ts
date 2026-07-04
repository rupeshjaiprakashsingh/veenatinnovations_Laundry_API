import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationSenderService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'ethereal.password',
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Veena Innovations Laundry" <no-reply@veenatinnovations.com>',
        to,
        subject,
        html,
      });
      console.log(`[EMAIL SENT] Subject: "${subject}" to ${to}. MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    }
  }

  async sendSMS(to: string, message: string) {
    console.log(`[SMS SENT] To: ${to} | Message: "${message}"`);
  }

  async sendRegistrationEmail(to: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Welcome to Veena Innovations Laundry!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for registering with us. We are excited to provide you with the best laundry and pickup services in India!</p>
        <p>You can now book laundry, dry cleaning, and ironing services right from your doorstep.</p>
        <br />
        <p style="text-align: center;">
          <a href="#" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Book Your First Order</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">© Veena Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, 'Welcome to Veena Innovations Laundry!', html);
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
        <p style="font-size: 12px; color: #888; text-align: center;">© Veena Innovations Laundry. All rights reserved.</p>
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
        <p>Thank you for choosing Veena Innovations Laundry. Your order <strong>#${orderNumber}</strong> has been successfully delivered to your doorstep.</p>
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
        <p style="font-size: 12px; color: #888; text-align: center;">© Veena Innovations Laundry. All rights reserved.</p>
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
        <p style="font-size: 12px; color: #888; text-align: center;">© Veena Innovations Laundry. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(toEmail, 'Delivery OTP Verification', html);
    await this.sendSMS(toMobile, `Veena Innovations Laundry: Use OTP ${otp} to verify delivery of order #${orderNumber}. Do not share this OTP.`);
  }
}
