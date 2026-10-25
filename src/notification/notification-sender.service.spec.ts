import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSenderService } from './notification-sender.service';

describe('NotificationSenderService - Admin Alerts', () => {
  let service: NotificationSenderService;
  let sendEmailSpy: jest.SpyInstance;

  beforeEach(async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationSenderService],
    }).compile();

    service = module.get<NotificationSenderService>(NotificationSenderService);
    // Mock sendEmail so it doesn't try network calls
    sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ messageId: 'test-msg-123' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
  });

  describe('getAdminEmail', () => {
    it('should return Info@saimorphixinnovations.com by default', () => {
      expect(service.getAdminEmail()).toBe('Info@saimorphixinnovations.com');
    });

    it('should return configured ADMIN_NOTIFICATION_EMAIL when set in env', () => {
      process.env.ADMIN_NOTIFICATION_EMAIL = 'custom-admin@saimorphixinnovations.com';
      expect(service.getAdminEmail()).toBe('custom-admin@saimorphixinnovations.com');
    });
  });

  describe('sendAdminNewCustomerAlertEmail', () => {
    it('should dispatch alert email to admin with comprehensive customer registration details', async () => {
      const customerData = {
        name: 'Rupesh Sharma',
        customerCode: 'CUST-0042',
        email: 'rupesh@example.com',
        mobileNumber: '9876543210',
        registeredAt: '25 Oct 2026, 07:30 PM IST',
        houseDetails: 'Flat 402, Shivam Heights',
        address: 'MG Road, Near Station',
        landmark: 'Near Shiv Temple',
        city: 'Kalyan',
        state: 'Maharashtra',
        pincode: '421103',
        lat: 19.243109,
        lng: 73.174841,
        gender: 'Male',
        dob: '1995-05-15',
        referralCode: 'REF-GRIVANA',
      };

      await service.sendAdminNewCustomerAlertEmail(customerData);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmailSpy.mock.calls[0];

      expect(to).toBe('Info@saimorphixinnovations.com');
      expect(subject).toContain('New Customer Alert');
      expect(subject).toContain('Rupesh Sharma');
      expect(subject).toContain('CUST-0042');

      // Verify HTML content has all operational data
      expect(html).toContain('Rupesh Sharma');
      expect(html).toContain('CUST-0042');
      expect(html).toContain('9876543210');
      expect(html).toContain('rupesh@example.com');
      expect(html).toContain('Flat 402, Shivam Heights');
      expect(html).toContain('421103');
      expect(html).toContain('Kalyan');
      expect(html).toContain('19.243109, 73.174841');
      expect(html).toContain('Recommended Admin Actions');
    });

    it('should handle optional address/profile fields gracefully with fallbacks', async () => {
      const customerData = {
        name: 'Pooja Verma',
        customerCode: 'CUST-0099',
        email: 'pooja@example.com',
        mobileNumber: '9123456789',
      };

      await service.sendAdminNewCustomerAlertEmail(customerData);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmailSpy.mock.calls[0];

      expect(to).toBe('Info@saimorphixinnovations.com');
      expect(subject).toContain('Pooja Verma');
      expect(html).toContain('N/A');
      expect(html).toContain('Not specified');
      expect(html).toContain('Not captured');
    });
  });

  describe('sendAdminNewOrderAlertEmail', () => {
    it('should send new order alert email for a first-time customer with FIRST-TIME CUSTOMER badge', async () => {
      const orderData = {
        orderNumber: 'ORD-00105',
        orderId: 105,
        isFirstOrder: true,
        isPriorityOrder: false,
        customerName: 'Amit Patel',
        customerCode: 'CUST-0055',
        customerMobile: '9820098200',
        customerEmail: 'amit.patel@example.com',
        pickupDate: '26 Oct 2026',
        deliveryDate: '28 Oct 2026',
        timeSlot: '8 AM - 9 AM',
        notes: 'Please ring bell twice | Slot: 8 AM - 9 AM',
        houseDetails: 'B-101, Gokul Dham',
        address: 'Station Road',
        landmark: 'Opp City Hospital',
        city: 'Thane',
        state: 'Maharashtra',
        pincode: '400601',
        orderItems: [
          { clothType: 'Shirt', serviceName: 'Wash & Iron', quantity: 3, unitPrice: 40, totalPrice: 120 },
          { clothType: 'Trousers', serviceName: 'Dry Cleaning', quantity: 2, unitPrice: 90, totalPrice: 180 },
        ],
        subtotal: 300,
        platformFee: 5,
        deliveryCharge: 0,
        taxAmount: 15,
        totalDiscount: 50,
        couponCode: 'WELCOME50',
        netAmount: 270,
        paymentStatus: 'Pending',
        paymentMode: 'Cash on Pickup',
        branchName: 'Thane Central Branch',
      };

      await service.sendAdminNewOrderAlertEmail(orderData);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmailSpy.mock.calls[0];

      expect(to).toBe('Info@saimorphixinnovations.com');
      expect(subject).toContain('ORD-00105');
      expect(subject).toContain('Amit Patel');
      expect(subject).toContain('First-Time Customer');
      expect(subject).toContain('270');

      // Verify HTML content
      expect(html).toContain('FIRST-TIME CUSTOMER');
      expect(html).toContain('ORD-00105');
      expect(html).toContain('Amit Patel');
      expect(html).toContain('CUST-0055');
      expect(html).toContain('9820098200');
      expect(html).toContain('8 AM - 9 AM');
      expect(html).toContain('B-101, Gokul Dham');
      expect(html).toContain('Opp City Hospital');
      expect(html).toContain('Shirt');
      expect(html).toContain('Wash & Iron');
      expect(html).toContain('Trousers');
      expect(html).toContain('Dry Cleaning');
      expect(html).toContain('FREE (₹0.00)');
      expect(html).toContain('WELCOME50');
      expect(html).toContain('270.00');
      expect(html).toContain('Assign Pickup Agent');
    });

    it('should send new order alert email for an existing customer with RETURNING CUSTOMER badge', async () => {
      const orderData = {
        orderNumber: 'ORD-00210',
        orderId: 210,
        isFirstOrder: false,
        isPriorityOrder: true,
        customerName: 'Sunita Rao',
        customerCode: 'CUST-0012',
        customerMobile: '9988776655',
        customerEmail: 'sunita.rao@example.com',
        pickupDate: '26 Oct 2026',
        deliveryDate: '27 Oct 2026',
        timeSlot: '9 AM - 10 AM',
        notes: 'Priority express requested',
        houseDetails: 'A-304, Green Palms',
        address: 'Sector 15',
        landmark: 'Near D-Mart',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        pincode: '400703',
        orderItems: [
          { clothType: 'Silk Saree', serviceName: 'Express Dry Clean', quantity: 1, unitPrice: 250, totalPrice: 250 },
        ],
        subtotal: 250,
        platformFee: 5,
        deliveryCharge: 30,
        taxAmount: 18,
        totalDiscount: 0,
        netAmount: 303,
        paymentStatus: 'Completed',
        paymentMode: 'UPI (Razorpay)',
        branchName: 'Vashi Hub',
      };

      await service.sendAdminNewOrderAlertEmail(orderData);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmailSpy.mock.calls[0];

      expect(to).toBe('Info@saimorphixinnovations.com');
      expect(subject).toContain('ORD-00210');
      expect(subject).toContain('Sunita Rao');
      expect(subject).toContain('Existing Customer');

      // Verify HTML content
      expect(html).toContain('RETURNING CUSTOMER');
      expect(html).toContain('PRIORITY EXPRESS');
      expect(html).toContain('ORD-00210');
      expect(html).toContain('Silk Saree');
      expect(html).toContain('303.00');
      expect(html).toContain('Completed');
      expect(html).toContain('UPI (Razorpay)');
    });
  });
});
