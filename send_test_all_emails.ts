import { NotificationSenderService } from './src/notification/notification-sender.service';

async function runTest() {
  console.log('Sending test emails to rupeshsingh7208@gmail.com...');
  const sender = new NotificationSenderService();
  const targetEmail = 'rupeshsingh7208@gmail.com';
  const name = 'Rupesh Singh';
  const orderNumber = 'ORD-TEST-' + Math.floor(1000 + Math.random() * 9000);
  const amount = 350;
  const items = [
    { clothType: 'Shirts (Dry Cleaning)', quantity: 2, service: { serviceName: 'Dry Cleaning' } },
    { clothType: 'Pants (Steam Press)', quantity: 3, service: { serviceName: 'Press / Ironing' } },
  ];

  try {
    console.log('1. Sending Registration email...');
    await sender.sendRegistrationEmail(targetEmail, name);

    console.log('2. Sending Order Created email...');
    await sender.sendOrderCreatedEmail(targetEmail, name, orderNumber, amount, items);

    console.log('3. Sending Order Status Update (Picked Up) email...');
    await sender.sendOrderStatusUpdateEmail(targetEmail, name, orderNumber, 'Picked Up');

    console.log('4. Sending Order Status Update (Out For Delivery) email...');
    await sender.sendOrderStatusUpdateEmail(targetEmail, name, orderNumber, 'Out For Delivery');

    console.log('5. Sending Delivery OTP email...');
    await sender.sendDeliveryOtp(targetEmail, '918433711031', name, orderNumber, '4928');

    console.log('6. Sending Payment Confirmation email...');
    await sender.sendPaymentReceivedEmail(targetEmail, name, orderNumber, amount, 'UPI / GPay', 'UPI98421038521');

    console.log('7. Sending Delivery Invoice email...');
    await sender.sendDeliveryInvoiceEmail(targetEmail, name, orderNumber, amount, items);

    console.log('All test emails triggered successfully!');
  } catch (err) {
    console.error('Error sending test emails:', err);
  }
}

runTest();
