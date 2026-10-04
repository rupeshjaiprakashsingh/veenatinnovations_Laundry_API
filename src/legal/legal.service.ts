import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateLegalContentDto } from './legal.dto';

@Injectable()
export class LegalService implements OnModuleInit {
  private readonly logger = new Logger(LegalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "legal_contents" (
          "id" SERIAL NOT NULL,
          "key" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "legal_contents_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "legal_contents_key_key" ON "legal_contents"("key");
      `);
      await this.seedDefaultsIfEmpty();
      this.logger.log('LegalContent table verified and initialized.');
    } catch (e: any) {
      this.logger.warn(`Could not verify legal_contents table directly: ${e.message}`);
    }
  }

  private normalizeKey(key: string): string {
    const k = (key || '').toLowerCase().trim();
    if (k.includes('privac')) return 'privacy-policy';
    if (k.includes('term')) return 'terms-of-use';
    return k;
  }

  async findAll() {
    try {
      const records = await this.prisma.legalContent.findMany({
        orderBy: { id: 'asc' },
      });
      if (records && records.length > 0) {
        return records;
      }
    } catch (e: any) {
      this.logger.warn(`Error fetching legal contents: ${e.message}`);
    }
    return [
      await this.findByKey('privacy-policy'),
      await this.findByKey('terms-of-use'),
    ];
  }

  async findByKey(rawKey: string) {
    const key = this.normalizeKey(rawKey);
    try {
      const item = await this.prisma.legalContent.findUnique({
        where: { key },
      });
      if (item) return item;
    } catch (e: any) {
      this.logger.warn(`Error finding legal content for key ${key}: ${e.message}`);
    }

    // Fallback default
    const fallback = this.getDefault(key);
    return {
      id: 0,
      key,
      title: fallback.title,
      content: fallback.content,
      createdDate: new Date(),
      updatedDate: new Date(),
    };
  }

  async update(rawKey: string, dto: UpdateLegalContentDto) {
    const key = this.normalizeKey(rawKey);
    const title = dto.title || (key === 'privacy-policy' ? 'Privacy Policy' : 'Terms of Use');
    const content = dto.content;

    try {
      const updated = await this.prisma.legalContent.upsert({
        where: { key },
        update: {
          title,
          content,
          updatedDate: new Date(),
        },
        create: {
          key,
          title,
          content,
        },
      });
      return updated;
    } catch (e: any) {
      this.logger.error(`Failed to update legal content for key ${key}: ${e.message}`);
      return {
        id: 0,
        key,
        title,
        content,
        createdDate: new Date(),
        updatedDate: new Date(),
      };
    }
  }

  private async seedDefaultsIfEmpty() {
    const keys = ['privacy-policy', 'terms-of-use'];
    for (const k of keys) {
      const existing = await this.prisma.legalContent.findUnique({ where: { key: k } });
      if (!existing) {
        const def = this.getDefault(k);
        await this.prisma.legalContent.create({
          data: {
            key: k,
            title: def.title,
            content: def.content,
          },
        });
      }
    }
  }

  private getDefault(key: string): { title: string; content: string } {
    if (key === 'privacy-policy') {
      return {
        title: 'Privacy Policy',
        content: `1. Introduction & Scope
This Privacy Policy ("Privacy Policy") describes how Saimorphix Innovations LLP (LLPIN: ADA-0394), having its registered office at D-701, Vaikunt Dham Co-Op Hsg. Soc., CTS No. 163-163/17 to 89, JM Road, Bhandup, Mumbai - 400078 ("Grivana", "we", "us", "our"), collects, stores, uses, processes, discloses, and transfers your Personal Information when you access or use the mobile application 'Grivana' or associated website.

2. Information We Collect
We collect:
• Contact and Identity Information (Name, phone, email, delivery address, pincode).
• Order & Transaction Details (Clothes items, order history, timestamps, payment reference IDs).
• Device & Location Data (Device model, OS version, GPS/location coordinates for pickup/delivery).

3. How We Use Information
We use your information to:
1. Create and manage your Account, and communicate with you;
2. Provide, operate, and facilitate the Platform and Services, including bookings with Providers;
3. Process payments through our Payment Processor, verify and reconcile Charges and Fees;
4. Send confirmations, service alerts, administrative notices, and promotional communications via SMS, email, WhatsApp, or push notifications;
5. Respond to customer support queries, complaints, and grievances;
6. Verify identity and eligibility to use the Platform;
7. Monitor, improve, and personalise the Platform and conduct internal analytics;
8. Detect, prevent, and investigate fraud and security incidents;
9. Administer offers, discounts, and promotions in accordance with Terms of Use;
10. Comply with legal, regulatory, and contractual obligations.

4. Cookies and Tracking Technologies
We and our service providers may use cookies, SDKs, and device identifiers to collect log data and analyze app performance.

5. Information Sharing and Disclosure
We do not sell your personal information. We share data only with:
• Independent Service Providers & Delivery Personnel (to fulfill pickup and delivery);
• Payment Gateways (Razorpay / UPI) for secure payment processing;
• Cloud infrastructure & SMS/notification gateway partners;
• Law enforcement or regulatory authorities where required by law.

6. Data Security
We implement technical and organizational security measures to protect your Personal Information against unauthorized access, loss, or misuse.

7. Data Retention
We retain your Personal Information for as long as your account is active or as necessary to provide services and comply with statutory legal requirements.

8. User Rights
You have the right to access, review, update, or correct your personal data through your Profile or by contacting support.

9. Grievance Officer
In accordance with Information Technology Act, 2000:
Name: Ameet Punamiya (Chief Executive Officer)
Address: D-701, Vaikunt Dham Co-Op Hsg. Soc., JM Road, Bhandup, Mumbai - 400078
Email: info@saimorphixinnovations.com
Phone: +91 9136662022`,
      };
    }

    return {
      title: 'Terms of Use',
      content: `1. Introduction & Binding Agreement
These Terms of Use ("Terms") constitute a binding legal contract between Saimorphix Innovations LLP (LLPIN: ADA-0394), having its registered office at D-701, Vaikunt Dham Co-Op Hsg. Soc., CTS No. 163-163/17 to 89, JM Road, Bhandup, Mumbai - 400078 ("Grivana", "we", "us", "our"), and you, a user of the Services ("User", "you"). By using the Platform, you represent that you have full legal capacity and agree to be bound by these Terms.

2. Services Description
Grivana operates an on-demand laundry and garment-care technology platform connecting customers with quality laundry and dry-cleaning service providers.

3. Account Registration & Security
You must provide accurate mobile number and address details. You are responsible for maintaining confidentiality of your account credentials and OTPs.

4. Booking, Pickup & Delivery
• Pickup: Clothes are collected at scheduled time slots from the provided address.
• Counting & Verification: Garment counts and conditions are checked at pickup or at the processing facility.
• Delivery: Finished clothes will be delivered to your registered address upon completion.

5. Pricing & Payments
• Service rates and applicable taxes (GST 18%) are displayed prior to order confirmation.
• Online payments via UPI, Cards, Net Banking (Razorpay) or Cash on Delivery where applicable.
• Wallets: Referral and bonus credits can be applied towards eligible orders.

6. Cancellation & Refunds
• Orders can be cancelled free of charge before pickup boy is dispatched or up to 2 hours before the scheduled pickup slot.
• Refunds for pre-paid cancelled orders are credited back to the original payment source within 5-7 business days.

7. Limitation of Liability
Grivana and its partners take utmost care of all garments. Liability for any unforeseen damage or loss during processing is subject to standard laundry industry guidelines and terms of service.

8. Grievance Redressal Officer
In accordance with Information Technology Act, 2000 & Consumer Protection Rules, 2020:
• Name: Ameet Punamiya (Chief Executive Officer)
• Address: D-701, Vaikunt Dham Co-Op Hsg. Soc., JM Road, Bhandup, Mumbai - 400078
• Phone: +91 9136662022
• Email: info@saimorphixinnovations.com
• Hours: Mon–Fri, 10:00 AM – 6:00 PM

9. Jurisdiction & Dispute Resolution
These Terms are governed by the laws of India. Courts in Mumbai shall have exclusive jurisdiction.`,
    };
  }
}
