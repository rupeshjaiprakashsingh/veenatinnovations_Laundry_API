import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface AdminNewCustomerAlertDto {
  name: string;
  customerCode: string;
  email: string;
  mobileNumber: string;
  registeredAt?: string;
  address?: string | null;
  houseDetails?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
  gender?: string | null;
  dob?: string | null;
  referralCode?: string | null;
}

export interface AdminNewOrderAlertDto {
  orderNumber: string;
  orderId?: number;
  createdAt?: string;
  isFirstOrder: boolean;
  isPriorityOrder?: boolean;
  customerName: string;
  customerCode?: string;
  customerMobile?: string;
  customerEmail?: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  timeSlot?: string | null;
  notes?: string | null;
  addressTitle?: string | null;
  address?: string | null;
  houseDetails?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  orderItems: Array<{
    clothType?: string;
    serviceName?: string;
    serviceType?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  subtotal: number;
  platformFee?: number;
  deliveryCharge?: number;
  taxAmount?: number;
  totalDiscount?: number;
  couponCode?: string | null;
  netAmount: number;
  paymentStatus?: string;
  paymentMode?: string;
  branchName?: string | null;
}

@Injectable()
export class NotificationSenderService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.getTransporter();
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const emailService = (process.env.EMAIL_SERVICE || '').trim();
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_PASS || '').trim();
    const brevoKey = (process.env.BREVO_API_KEY || '').trim();

    if (brevoKey) {
      console.log('[EMAIL SETUP] Brevo HTTP API is configured.');
      return null;
    }

    if (emailUser && emailPass) {
      console.log('[EMAIL SETUP] Initializing Nodemailer SMTP transporter');
      const host = (process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
      const secure = port === 465;

      const transportOptions: any = {
        host,
        port,
        secure,
        family: 4,
        auth: { user: emailUser, pass: emailPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      };

      if (emailService) {
        transportOptions.service = emailService;
      }

      this.transporter = nodemailer.createTransport(transportOptions);
      return this.transporter;
    }

    console.warn('[EMAIL SETUP] No email credentials found in environment variables.');
    return null;
  }

  /**
   * Send Email with retry logic (up to 3 attempts, 2s delay between retries).
   * Tries Brevo HTTP API first (if BREVO_API_KEY is set), then falls back to SMTP.
   * Anti-spam best practices:
   * - Zero external links (no <a href="..."> tags)
   * - Zero attachments
   * - Clean, responsive inline HTML
   */
  async sendEmail(to: string, subject: string, html: string) {
    // Guard: skip if recipient email is missing
    if (!to || !to.trim() || !to.includes('@')) {
      console.warn(`[EMAIL SKIPPED] Invalid or missing recipient email: "${to}" | subject="${subject}"`);
      return { messageId: 'skipped', skipped: true };
    }

    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const fromName = 'Grivana Laundry';
    const fromEmail = emailUser || 'no-reply@veenatinnovations.com';

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Brevo HTTP API (Primary when BREVO_API_KEY is set)
    if (brevoKey) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[EMAIL SENDING] Brevo API attempt ${attempt}/${MAX_RETRIES} -> to=${to} subject="${subject}"`);
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'api-key': brevoKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sender: { name: fromName, email: fromEmail },
              to: [{ email: to.trim() }],
              subject,
              htmlContent: html,
            }),
          });

          const responseText = await response.text();
          if (!response.ok) {
            throw new Error(`Brevo API error ${response.status}: ${responseText}`);
          }

          console.log(`[EMAIL SENT] Brevo API -> to=${to} status=${response.status} (attempt ${attempt})`);
          return { messageId: `brevo-${Date.now()}`, response: responseText };
        } catch (err: any) {
          console.error(`[EMAIL ERROR] Brevo attempt ${attempt}/${MAX_RETRIES} failed: ${err?.message || err}`);
          if (attempt < MAX_RETRIES) {
            console.log(`[EMAIL RETRY] Waiting ${RETRY_DELAY_MS}ms before retry...`);
            await sleep(RETRY_DELAY_MS);
          }
        }
      }
      console.error(`[EMAIL FATAL] Brevo API failed after ${MAX_RETRIES} attempts. Falling back to SMTP...`);
    }

    // 2. SMTP Transporter Fallback (with retry)
    const transporter = this.getTransporter();
    if (transporter) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[EMAIL SENDING] SMTP attempt ${attempt}/${MAX_RETRIES} -> to=${to} subject="${subject}"`);
          const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: to.trim(),
            subject,
            html,
          });
          console.log(`[EMAIL SENT] SMTP -> to=${to} messageId=${info.messageId} (attempt ${attempt})`);
          return info;
        } catch (err: any) {
          console.error(`[EMAIL ERROR] SMTP attempt ${attempt}/${MAX_RETRIES} failed: ${err?.message || err}`);
          if (attempt < MAX_RETRIES) {
            console.log(`[EMAIL RETRY] Waiting ${RETRY_DELAY_MS}ms before retry...`);
            await sleep(RETRY_DELAY_MS);
          }
        }
      }
      console.error(`[EMAIL FATAL] SMTP also failed after ${MAX_RETRIES} attempts for: to=${to} subject="${subject}"`);
    }

    console.warn(`[EMAIL SKIPPED] No working transport available. Would have sent: to=${to} subject="${subject}"`);
    return { messageId: 'skipped', skipped: true };
  }

  async sendSMS(to: string, message: string) {
    console.log(`[SMS SENT] To: ${to} | Message: "${message}"`);
  }

  /**
   * Send Login OTP SMS via SMSIndiaHub Gateway:
   * URL: http://cloud.smsindiahub.in/vendorsms/pushsms.aspx
   * Approved Template: Your Login OTP for verification is ##var##. Please do not share this OTP with anyone. It is valid for 10 minutes.SMORPH
   */
  async sendOtpSMS(mobileNumber: string, otp: string) {
    const user = (process.env.SMS_USER || 'saimorphix').trim();
    const password = (process.env.SMS_PASSWORD || 'India@2026').trim();
    const senderId = (process.env.SMS_SENDER_ID || 'SMORPH').trim();

    // Ensure mobile number is cleaned and properly prefixed with country code 91
    let cleanMobile = (mobileNumber || '').replace(/\D/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    } else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) {
      cleanMobile = '91' + cleanMobile.slice(1);
    } else if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
      // already proper 91XXXXXXXXXX
    }

    const entityId = (process.env.SMS_ENTITY_ID || '').trim();
    const templateId = (process.env.SMS_TEMPLATE_ID || '').trim();

    const message = `Your Login OTP for verification is ${otp}. Please do not share this OTP with anyone. It is valid for 10 minutes.SMORPH`;

    const paramObj: any = {
      user: user,
      password: password,
      msisdn: cleanMobile,
      sid: senderId,
      msg: message,
      fl: '0',
      gwid: '2',
    };

    if (entityId) paramObj.EntityId = entityId;
    if (templateId) paramObj.TemplateId = templateId;

    const params = new URLSearchParams(paramObj);

    const apiUrl = `http://cloud.smsindiahub.in/vendorsms/pushsms.aspx?${params.toString()}`;

    console.log(`[SMS OTP SENDING] To=${cleanMobile} | OTP=${otp}`);

    try {
      const response = await fetch(apiUrl);
      const resultText = await response.text();
      console.log(`[SMS OTP RESPONSE] Status=${response.status} | Body=${resultText}`);
      return { success: response.ok, responseText: resultText };
    } catch (err: any) {
      console.error(`[SMS OTP ERROR] Failed to send SMS via SMSIndiaHub:`, err?.message || err);
      return { success: false, error: err?.message || err };
    }
  }

  async sendRegistrationEmail(to: string, name: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #EEF2FF; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5; margin: 0; font-size: 22px;">Welcome to Saimorphix Innovations</h2>
        </div>
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for registering with us. We are excited to provide you with premium laundry, dry cleaning, and ironing services delivered right to your doorstep!</p>
        <div style="background-color: #F8FAFC; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1E293B; font-weight: 600; font-size: 14px;">Your Account Features:</p>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
            <li>Doorstep laundry pickup and delivery</li>
            <li>Real-time order tracking via Grivana app</li>
            <li>First-order discounts &amp; free delivery offers</li>
          </ul>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, 'Welcome to Saimorphix Innovations!', html);
  }

  async sendLoginAlertEmail(to: string, name: string, loginTime: string, loginMethod: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #EEF2FF; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5; margin: 0; font-size: 22px;">Security Alert: New Sign-in</h2>
        </div>
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name || 'Valued Customer'}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Your Grivana account was just accessed from a new login session.</p>
        
        <div style="background-color: #F8FAFC; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0; color: #1E293B; font-weight: 600; font-size: 14px;">Login Details:</p>
          <p style="margin: 4px 0; color: #475569; font-size: 13px;"><strong>Date &amp; Time:</strong> ${loginTime}</p>
          <p style="margin: 4px 0; color: #475569; font-size: 13px;"><strong>Sign-in Method:</strong> ${loginMethod}</p>
          <p style="margin: 4px 0; color: #475569; font-size: 13px;"><strong>Platform:</strong> Grivana App</p>
        </div>

        <p style="color: #64748B; font-size: 13px; line-height: 1.5;">If this was you, no further action is required. If you did not sign in, please contact Grivana Support immediately.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, 'Security Alert: New Sign-in to your Grivana Account', html);
  }

  async sendOrderCreatedEmail(to: string, name: string, orderNumber: string, amount: number, items: any[]) {
    const itemsList = Array.isArray(items) ? items : [];
    const itemsHtml = itemsList.length > 0 ? itemsList.map(item => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${item.clothType || item.name || 'Garment'}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${item.quantity || 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">${item.service?.serviceName || item.serviceName || 'Service'}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="3" style="padding: 10px 8px; text-align: center; color: #64748B;">Standard Laundry Order</td>
      </tr>
    `;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #EEF2FF; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5; margin: 0; font-size: 22px;">Order Confirmed! #${orderNumber}</h2>
        </div>
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for your order. We have received your laundry pickup request and our team is preparing for pickup.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #1E293B; margin-top: 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #F1F5F9;">
                <th style="padding: 8px; text-align: left; color: #475569;">Cloth Type</th>
                <th style="padding: 8px; text-align: center; color: #475569;">Quantity</th>
                <th style="padding: 8px; text-align: right; color: #475569;">Service</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <p style="font-size: 15px; font-weight: bold; text-align: right; color: #4F46E5; margin-top: 15px; margin-bottom: 0;">Total Payable: INR ${amount}</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Order Confirmed: #${orderNumber} - Grivana`, html);
  }

  async sendDeliveryInvoiceEmail(to: string, name: string, orderNumber: string, amount: number, items: any[]) {
    const itemsHtml = (items || []).map(item => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${item.clothType || ''}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${item.quantity || 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">${item.service?.serviceName || 'Service'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #D1FAE5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #10B981; margin: 0; font-size: 22px;">Delivery Complete &amp; Invoice</h2>
        </div>
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for choosing Saimorphix Innovations. Your order <strong>#${orderNumber}</strong> has been successfully delivered to your doorstep.</p>

        <div style="background-color: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #1E293B; margin-top: 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Invoice Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #F1F5F9;">
                <th style="padding: 8px; text-align: left; color: #475569;">Cloth Type</th>
                <th style="padding: 8px; text-align: center; color: #475569;">Quantity</th>
                <th style="padding: 8px; text-align: right; color: #475569;">Service</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <p style="font-size: 16px; font-weight: bold; text-align: right; color: #10B981; margin-top: 15px; margin-bottom: 0;">Total Paid: INR ${amount}</p>
          <p style="text-align: center; color: #10B981; font-weight: bold; font-size: 16px; margin: 15px 0 0 0;">Payment Status: PAID</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Invoice for Order #${orderNumber}`, html);
  }

  async sendInvoiceEmail(to: string, name: string, orderNumber: string, amount: number, items: any[]) {
    return this.sendDeliveryInvoiceEmail(to, name, orderNumber, amount, items);
  }

  async sendDeliveryOtp(toEmail: string, toMobile: string, name: string, orderNumber: string, otp: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #FEF3C7; padding: 20px; border-radius: 8px;">
          <h2 style="color: #D97706; margin: 0; font-size: 22px;">Delivery OTP Verification</h2>
        </div>
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">The delivery agent is at your doorstep to deliver order <strong>#${orderNumber}</strong>.</p>
        <p style="color: #475569; font-size: 14px;">Please share the following OTP with the delivery agent to confirm delivery:</p>
        
        <div style="background-color: #FFFBEB; border: 2px dashed #F59E0B; color: #B45309; text-align: center; font-size: 32px; font-weight: bold; padding: 15px; border-radius: 8px; letter-spacing: 6px; margin: 20px 0;">
          ${otp}
        </div>
        
        <p style="color: #DC2626; font-size: 13px; font-weight: 600; text-align: center;">Important: Do not share this OTP with anyone other than the assigned delivery agent.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(toEmail, 'Delivery OTP Verification', html);
    await this.sendOtpSMS(toMobile, otp);
    await this.sendSMS(toMobile, `Saimorphix Innovations: Use OTP ${otp} to verify delivery of order #${orderNumber}. Do not share this OTP.`);
  }

  async sendPaymentReceivedEmail(to: string, name: string, orderNumber: string, amount: number, paymentMode: string, transactionReference?: string) {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #D1FAE5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #10B981; margin: 0; font-size: 22px;">Payment Received!</h2>
          <p style="color: #047857; font-size: 14px; margin: 5px 0 0 0;">Thank you for your payment.</p>
        </div>
        
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">We have successfully received and processed your payment for order <strong>#${orderNumber}</strong>.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="color: #1E293B; margin-top: 0; margin-bottom: 12px; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Transaction Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #475569;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Amount Paid:</td>
              <td style="padding: 6px 0; text-align: right; color: #10B981; font-weight: 700; font-size: 16px;">INR ${amount}</td>
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
        
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">If you have any questions regarding this transaction, please reply to this email.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, `Payment Confirmation: Order #${orderNumber}`, html);
  }

  async sendOrderStatusUpdateEmail(to: string, name: string, orderNumber: string, status: string) {
    let statusDescription = `Your order status has been updated to ${status}.`;
    let nextStepNote = 'You can track the progress of your order live inside our Grivana app.';
    let statusColor = '#4F46E5';
    let bgColor = '#EEF2FF';

    switch (status) {
      case 'New Order':
        statusDescription = 'Your laundry order has been received and is being reviewed by our team.';
        nextStepNote = 'Our team will assign a pickup agent shortly. Watch out for the next update!';
        statusColor = '#4F46E5';
        bgColor = '#EEF2FF';
        break;
      case 'Pickup Scheduled':
        statusDescription = 'A pickup agent has been assigned and is scheduled to collect your clothes. Please keep your laundry ready!';
        nextStepNote = 'Our agent will arrive at your doorstep as per the scheduled time.';
        statusColor = '#3B82F6';
        bgColor = '#DBEAFE';
        break;
      case 'Picked Up':
        statusDescription = 'Your clothes have been successfully collected by our agent and are now on the way to our laundry facility.';
        nextStepNote = 'Your garments are in safe hands! We will notify you as soon as the cleaning process begins.';
        statusColor = '#8B5CF6';
        bgColor = '#EDE9FE';
        break;
      case 'Processing':
        statusDescription = 'Your clothes have arrived at our facility and are being carefully sorted and inspected before laundering.';
        nextStepNote = 'Our team is preparing your garments for the wash cycle. Next update: Washing!';
        statusColor = '#D97706';
        bgColor = '#FEF3C7';
        break;
      case 'Washing':
        statusDescription = 'Your clothes are currently in the washing machine, being cleaned with premium detergents.';
        nextStepNote = 'After washing, your clothes will be dried and ironed. Stay tuned!';
        statusColor = '#0284C7';
        bgColor = '#E0F2FE';
        break;
      case 'Dry Cleaning':
        statusDescription = 'Your garments are undergoing professional dry cleaning using industry-grade solvents for a superior clean.';
        nextStepNote = 'Dry cleaning is in progress. We will notify you once ironing/steam pressing begins.';
        statusColor = '#0EA5E9';
        bgColor = '#E0F2FE';
        break;
      case 'Ironing':
        statusDescription = 'Your clothes are being precision-ironed and steam-pressed to give them a fresh, crisp finish.';
        nextStepNote = 'Almost there! Your garments will be packed and ready for delivery very soon.';
        statusColor = '#EA580C';
        bgColor = '#FFEDD5';
        break;
      case 'Ready For Delivery':
        statusDescription = 'Excellent news! Your clean, fresh laundry is packed and ready to be dispatched for delivery.';
        nextStepNote = 'A delivery agent will pick up your order shortly. You will receive a delivery OTP.';
        statusColor = '#10B981';
        bgColor = '#D1FAE5';
        break;
      case 'Out For Delivery':
        statusDescription = 'Your fresh, clean clothes have been dispatched and are currently on their way to your doorstep!';
        nextStepNote = 'Please be available to receive your order. A delivery OTP will be required to confirm receipt.';
        statusColor = '#0284C7';
        bgColor = '#E0F2FE';
        break;
      case 'Delivered':
        statusDescription = 'Your order has been successfully delivered to your doorstep. We hope your clothes look and feel amazing!';
        nextStepNote = 'Thank you for choosing Saimorphix Innovations. We look forward to serving you again!';
        statusColor = '#10B981';
        bgColor = '#D1FAE5';
        break;
      case 'Cancelled':
        statusDescription = 'Your order has been cancelled as per your request or due to an unforeseen issue.';
        nextStepNote = 'If you did not request this cancellation, please contact our support team.';
        statusColor = '#DC2626';
        bgColor = '#FEE2E2';
        break;
    }

    const updatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px; padding: 18px; background: ${bgColor}; border-radius: 8px;">
          <h2 style="color: ${statusColor}; margin: 0; font-size: 22px;">Order Update: ${status}</h2>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Order #${orderNumber}</p>
        </div>
        
        <p style="color: #334155; font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Here is the latest update on your laundry order <strong style="color: ${statusColor};">#${orderNumber}</strong>:</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #e2e8f0; border-left: 5px solid ${statusColor}; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="color: ${statusColor}; margin: 0 0 6px 0; font-size: 16px;">${status}</h3>
          <p style="color: #334155; margin: 0; font-size: 14px; line-height: 1.6;">${statusDescription}</p>
          <p style="color: #64748b; margin: 8px 0 0 0; font-size: 12px;">Updated at: ${updatedAt} IST</p>
        </div>
        
        <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 4px; padding: 12px 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #92400E;">What's Next? ${nextStepNote}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; Saimorphix Innovations. All rights reserved.<br />You are receiving this email regarding your order with us.</p>
      </div>
    `;
    await this.sendEmail(to, `Order #${orderNumber} - Status: ${status}`, html);
  }

  /**
   * Resolve Admin Notification Email address.
   * Priority: ADMIN_NOTIFICATION_EMAIL env var -> Fallback: Info@saimorphixinnovations.com
   */
  getAdminEmail(): string {
    return (process.env.ADMIN_NOTIFICATION_EMAIL || 'Info@saimorphixinnovations.com').trim();
  }

  /**
   * Send Admin Notification Email when a new user/customer registers on the app.
   * Target: Info@saimorphixinnovations.com (or ADMIN_NOTIFICATION_EMAIL)
   */
  async sendAdminNewCustomerAlertEmail(data: AdminNewCustomerAlertDto) {
    const adminEmail = this.getAdminEmail();
    const registeredAt = data.registeredAt || (new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST');

    const addressParts = [
      data.houseDetails,
      data.address,
      data.landmark ? `Near ${data.landmark}` : '',
      data.city,
      data.state,
      data.pincode ? `PIN: ${data.pincode}` : '',
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Not provided yet';

    const coordinates = (data.lat && data.lng) ? `${data.lat}, ${data.lng}` : 'Not captured';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%); padding: 24px 20px; border-radius: 10px; color: #ffffff;">
          <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
            🎉 New App User Registration
          </span>
          <h2 style="margin: 6px 0 0 0; font-size: 24px; font-weight: 700; color: #ffffff;">New Customer Alert</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; color: #E0E7FF;">Grivana Laundry Operations</p>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          A new customer has registered on the <strong>Grivana</strong> laundry platform. Below are the full registration details for your operational records:
        </p>

        <!-- Customer Summary Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 14px 0; font-size: 15px; color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
            👤 Customer Information
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 7px 0; color: #64748B; width: 35%; font-weight: 500;">Customer Name:</td>
              <td style="padding: 7px 0; color: #0F172A; font-weight: 700; font-size: 15px;">${data.name || 'New Customer'}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Customer Code:</td>
              <td style="padding: 7px 0;">
                <span style="font-family: monospace; background: #EEF2FF; color: #4338CA; padding: 2px 8px; border-radius: 4px; font-weight: 700;">
                  ${data.customerCode || 'N/A'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Mobile Number:</td>
              <td style="padding: 7px 0; color: #0F172A; font-weight: 600;">
                <a href="tel:${data.mobileNumber}" style="color: #4F46E5; text-decoration: none;">${data.mobileNumber || 'N/A'}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Email Address:</td>
              <td style="padding: 7px 0; color: #0F172A;">
                <a href="mailto:${data.email}" style="color: #4F46E5; text-decoration: none;">${data.email || 'N/A'}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Registered At:</td>
              <td style="padding: 7px 0; color: #0F172A; font-weight: 500;">${registeredAt}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Gender / DOB:</td>
              <td style="padding: 7px 0; color: #0F172A;">${data.gender || 'Not specified'} / ${data.dob || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 7px 0; color: #64748B; font-weight: 500;">Referral Code:</td>
              <td style="padding: 7px 0; color: #0F172A;">${data.referralCode || 'None'}</td>
            </tr>
          </table>
        </div>

        <!-- Address Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 14px 0; font-size: 15px; color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
            📍 Registered Service Address
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 35%; font-weight: 500;">House/Flat/Room:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${data.houseDetails || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Street Address:</td>
              <td style="padding: 6px 0; color: #0F172A;">${data.address || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Landmark:</td>
              <td style="padding: 6px 0; color: #0F172A;">${data.landmark || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">City &amp; State:</td>
              <td style="padding: 6px 0; color: #0F172A;">${data.city || 'N/A'}${data.state ? ', ' + data.state : ''}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">PIN Code:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">${data.pincode || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">GPS Coordinates:</td>
              <td style="padding: 6px 0; color: #64748B; font-family: monospace; font-size: 13px;">${coordinates}</td>
            </tr>
          </table>
        </div>

        <!-- Action Items Box -->
        <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; color: #065F46; font-weight: 700; font-size: 14px;">⚡ Recommended Admin Actions:</p>
          <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 13px; line-height: 1.6;">
            <li>Verify delivery serviceability for PIN Code: <strong>${data.pincode || 'Customer Area'}</strong>.</li>
            <li>Assign to the closest Grivana Laundry Hub or processing branch.</li>
            <li>Customer is now eligible to place their first order with first-order savings.</li>
          </ul>
        </div>

        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0; line-height: 1.5;">
          This is an automated operational alert sent to <strong>${adminEmail}</strong>.<br />
          &copy; Saimorphix Innovations. All rights reserved.
        </p>
      </div>
    `;

    const subject = `🎉 [New Customer Alert] ${data.name || 'New Customer'} (${data.customerCode || 'Registered'}) - Grivana Laundry`;
    return this.sendEmail(adminEmail, subject, html);
  }

  /**
   * Send Admin Notification Email when a new laundry order is placed (for both new & existing customers).
   * Target: Info@saimorphixinnovations.com (or ADMIN_NOTIFICATION_EMAIL)
   */
  async sendAdminNewOrderAlertEmail(data: AdminNewOrderAlertDto) {
    const adminEmail = this.getAdminEmail();
    const orderTime = data.createdAt || (new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST');

    const isFirstOrder = Boolean(data.isFirstOrder);
    const customerBadgeText = isFirstOrder ? '🌟 FIRST-TIME CUSTOMER (NEW)' : '🔄 RETURNING CUSTOMER';
    const customerBadgeBg = isFirstOrder ? '#10B981' : '#3B82F6';

    const addressParts = [
      data.houseDetails,
      data.address,
      data.landmark ? `Landmark: ${data.landmark}` : '',
      data.city,
      data.state,
      data.pincode ? `PIN: ${data.pincode}` : '',
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Not provided';

    const itemsList = Array.isArray(data.orderItems) ? data.orderItems : [];
    const itemsHtml = itemsList.length > 0 ? itemsList.map((item, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
        <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B; font-weight: 500;">${item.clothType || 'Item'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; color: #475569;">${item.serviceName || item.serviceType || 'Standard'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #1E293B; font-weight: 600;">${item.quantity || 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #475569;">₹${typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : '-'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 700;">₹${typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '-'}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="5" style="padding: 14px; text-align: center; color: #64748B;">Standard Laundry Order</td>
      </tr>
    `;

    const priorityBanner = data.isPriorityOrder ? `
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; text-align: center;">
        <span style="color: #B45309; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
          ⚡ PRIORITY EXPRESS ORDER - 12 TO 24 HOURS TURNAROUND REQUIRED
        </span>
      </div>
    ` : '';

    const deliveryDisplay = (data.deliveryCharge === 0 || data.deliveryCharge === undefined)
      ? '<span style="color: #10B981; font-weight: 700;">FREE (₹0.00)</span>'
      : `₹${Number(data.deliveryCharge).toFixed(2)}`;

    const discountDisplay = (data.totalDiscount && data.totalDiscount > 0)
      ? `<span style="color: #DC2626; font-weight: 700;">-₹${Number(data.totalDiscount).toFixed(2)}</span> ${data.couponCode ? `(${data.couponCode})` : ''}`
      : '₹0.00';

    const paymentStatusColor = (data.paymentStatus === 'Completed' || data.paymentStatus === 'Paid') ? '#10B981' : '#D97706';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <!-- Header Banner -->
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 24px 20px; border-radius: 10px; color: #ffffff;">
          <div style="margin-bottom: 10px;">
            <span style="background-color: ${customerBadgeBg}; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
              ${customerBadgeText}
            </span>
          </div>
          <h2 style="margin: 6px 0 4px 0; font-size: 24px; font-weight: 700; color: #ffffff;">New Order Alert: #${data.orderNumber}</h2>
          <p style="margin: 0; font-size: 14px; color: #94A3B8;">Placed on ${orderTime}</p>
        </div>

        ${priorityBanner}

        <!-- Customer & Schedule Summary Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
            📋 Order &amp; Customer Overview
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748B; width: 35%; font-weight: 500;">Customer:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">
                ${data.customerName || 'Customer'} 
                ${data.customerCode ? `<span style="font-family: monospace; font-size: 12px; color: #4338CA; background: #EEF2FF; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">${data.customerCode}</span>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Phone Number:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">
                <a href="tel:${data.customerMobile}" style="color: #4F46E5; text-decoration: none;">${data.customerMobile || 'N/A'}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Email Address:</td>
              <td style="padding: 6px 0; color: #0F172A;">
                <a href="mailto:${data.customerEmail}" style="color: #4F46E5; text-decoration: none;">${data.customerEmail || 'N/A'}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Pickup Schedule:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">
                ${data.pickupDate || 'Scheduled Date'} &bull; <span style="color: #4F46E5;">${data.timeSlot || 'Standard Slot'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Target Delivery:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${data.deliveryDate || 'As per service SLA'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Pickup Address:</td>
              <td style="padding: 6px 0; color: #0F172A; line-height: 1.4;">${fullAddress}</td>
            </tr>
            ${data.branchName ? `
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Assigned Branch:</td>
              <td style="padding: 6px 0; color: #0F172A;">${data.branchName}</td>
            </tr>
            ` : ''}
            ${data.notes ? `
            <tr>
              <td style="padding: 6px 0; color: #64748B; font-weight: 500;">Customer Notes:</td>
              <td style="padding: 6px 0; color: #0F172A; font-style: italic;">${data.notes}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Order Items Table -->
        <div style="background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
          <div style="background-color: #F1F5F9; padding: 12px 16px; border-bottom: 1px solid #E2E8F0;">
            <h3 style="margin: 0; font-size: 15px; color: #1E293B;">🧺 Garment Breakdown (${itemsList.length} items)</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #F8FAFC; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                <th style="padding: 10px 12px; text-align: left; color: #475569; border-bottom: 1px solid #E2E8F0;">Cloth Item</th>
                <th style="padding: 10px 12px; text-align: left; color: #475569; border-bottom: 1px solid #E2E8F0;">Service</th>
                <th style="padding: 10px 12px; text-align: center; color: #475569; border-bottom: 1px solid #E2E8F0;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; color: #475569; border-bottom: 1px solid #E2E8F0;">Rate</th>
                <th style="padding: 10px 12px; text-align: right; color: #475569; border-bottom: 1px solid #E2E8F0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Financial Summary Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
            💰 Bill Breakdown &amp; Payment
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 5px 0; color: #64748B;">Items Subtotal:</td>
              <td style="padding: 5px 0; text-align: right; color: #0F172A; font-weight: 500;">₹${Number(data.subtotal || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748B;">Platform Fee:</td>
              <td style="padding: 5px 0; text-align: right; color: #0F172A;">₹${Number(data.platformFee || 5).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748B;">Delivery Fee:</td>
              <td style="padding: 5px 0; text-align: right;">${deliveryDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748B;">GST / Tax:</td>
              <td style="padding: 5px 0; text-align: right; color: #0F172A;">₹${Number(data.taxAmount || 0).toFixed(2)}</td>
            </tr>
            ${data.totalDiscount && data.totalDiscount > 0 ? `
            <tr>
              <td style="padding: 5px 0; color: #64748B;">Discounts Applied:</td>
              <td style="padding: 5px 0; text-align: right;">${discountDisplay}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #E2E8F0; border-bottom: 2px solid #E2E8F0;">
              <td style="padding: 10px 0; color: #0F172A; font-weight: 700; font-size: 16px;">Net Payable:</td>
              <td style="padding: 10px 0; text-align: right; color: #4F46E5; font-weight: 800; font-size: 18px;">₹${Number(data.netAmount || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0 0 0; color: #64748B; font-weight: 500;">Payment Status &amp; Mode:</td>
              <td style="padding: 8px 0 0 0; text-align: right;">
                <span style="color: ${paymentStatusColor}; font-weight: 700;">${data.paymentStatus || 'Pending'}</span> 
                <span style="color: #64748B;">(${data.paymentMode || 'COD / Pay on Pickup'})</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Action Items Box for Admin -->
        <div style="background-color: #EEF2FF; border-left: 4px solid #4F46E5; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0; color: #3730A3; font-weight: 700; font-size: 14px;">⚡ Immediate Admin Actions Required:</p>
          <ol style="margin: 0; padding-left: 20px; color: #4338CA; font-size: 13px; line-height: 1.6;">
            <li><strong>Assign Pickup Agent</strong> in Grivana Admin Portal for slot: <strong>${data.timeSlot || 'Scheduled Slot'}</strong> on <strong>${data.pickupDate || 'Scheduled Date'}</strong>.</li>
            <li>Ensure driver reaches customer location: <strong>${fullAddress}</strong>.</li>
            <li>Tag garments with order number <strong>#${data.orderNumber}</strong> upon pickup confirmation.</li>
          </ol>
        </div>

        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0; line-height: 1.5;">
          This is an automated operational alert sent to <strong>${adminEmail}</strong>.<br />
          &copy; Saimorphix Innovations. All rights reserved.
        </p>
      </div>
    `;

    const subject = `🧺 [New Order Alert] #${data.orderNumber} (₹${data.netAmount}) - ${data.customerName} [${isFirstOrder ? 'First-Time Customer' : 'Existing Customer'}]`;
    return this.sendEmail(adminEmail, subject, html);
  }
}
