import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationRepository, CustomerRepository } from '../common/repositories/laundry.repositories';
import { CreateNotificationDto } from './notification.dto';
import { NotificationSenderService } from './notification-sender.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly notificationSender?: NotificationSenderService,
  ) {}

  public static encodeNotificationType(dto: {
    notificationType?: string;
    orderId?: number;
    orderNumber?: string;
    title?: string;
  }): string {
    const isAdmin =
      dto.notificationType === 'AdminMessage' ||
      dto.orderId !== undefined ||
      Boolean(dto.orderNumber) ||
      Boolean(dto.title);

    if (!isAdmin) {
      return dto.notificationType || 'Push';
    }

    const parts = ['ADMIN_MSG'];
    if (dto.orderId) parts.push(`ORD:${dto.orderId}`);
    if (dto.orderNumber) parts.push(`NUM:${dto.orderNumber.trim()}`);
    if (dto.title) parts.push(`TITLE:${encodeURIComponent(dto.title.trim())}`);
    parts.push('UNREAD');
    return parts.join('|');
  }

  public static enrichNotification(n: any) {
    if (!n) return n;
    const rawType = String(n.notificationType || 'Push');
    const rawMsg = String(n.message || '');

    const isAdminMessage = rawType.startsWith('ADMIN_MSG');
    const readMatch = rawType.match(/\|READ\|([^|]+)/);
    const isRead = Boolean(readMatch);
    const readAt = readMatch ? readMatch[1] : null;

    const ordIdMatch = rawType.match(/\|ORD:(\d+)/);
    const orderId = ordIdMatch ? parseInt(ordIdMatch[1], 10) : null;

    const ordNumMatch = rawType.match(/\|NUM:([^|]+)/);
    const msgOrdNumMatch = rawMsg.match(/\b(ORD-\d+)\b/i);
    const orderNumber = ordNumMatch
      ? ordNumMatch[1]
      : msgOrdNumMatch
        ? msgOrdNumMatch[1].toUpperCase()
        : null;

    const titleMatch = rawType.match(/\|TITLE:([^|]+)/);
    let title = '';
    if (titleMatch) {
      try {
        title = decodeURIComponent(titleMatch[1]);
      } catch {
        title = titleMatch[1];
      }
    }
    if (!title) {
      if (isAdminMessage) {
        title = orderNumber ? `Message regarding Order #${orderNumber}` : 'Message from Grivana Admin';
      } else {
        title = orderNumber ? `Order #${orderNumber} Update` : 'Grivana Update';
      }
    }

    const baseType = isAdminMessage
      ? 'AdminMessage'
      : rawType.split('|')[0] || 'Push';

    return {
      ...n,
      notificationType: baseType,
      rawNotificationType: rawType,
      orderId,
      orderNumber,
      title,
      isAdminMessage,
      isRead,
      readAt,
    };
  }

  async create(dto: CreateNotificationDto) {
    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);

    const encodedType = NotificationService.encodeNotificationType(dto);
    const formattedMessage =
      dto.orderNumber && !dto.message.includes(dto.orderNumber)
        ? `[Order #${dto.orderNumber}] ${dto.message.trim()}`
        : dto.message.trim();

    const created = await this.notificationRepository.create({
      customerId: dto.customerId,
      message: formattedMessage,
      notificationType: encodedType,
      isSent: true,
      sentDate: new Date(),
    });

    // Also dispatch email notification if customer has a valid email
    if (customer.email && customer.email.includes('@') && this.notificationSender?.sendEmail) {
      const subject = dto.title
        ? `Grivana Update: ${dto.title}`
        : dto.orderNumber
          ? `Update regarding your Grivana Order #${dto.orderNumber}`
          : 'New Message from Grivana Laundry';
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
      this.notificationSender
        .sendEmail(
          customer.email.trim(),
          subject,
          `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #EEF2FF; padding: 16px 20px; border-radius: 8px; margin-bottom: 18px;">
              <h2 style="color: #4F46E5; margin: 0; font-size: 18px;">${subject}</h2>
            </div>
            <p style="color: #334155; font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
            <div style="background-color: #F8FAFC; border-left: 4px solid #4F46E5; padding: 14px 16px; border-radius: 6px; color: #1E293B; font-size: 15px; line-height: 1.6; margin: 16px 0;">
              ${dto.message.trim()}
            </div>
            ${dto.orderNumber ? `<p style="color: #64748B; font-size: 13px;">Linked Order: <strong>#${dto.orderNumber}</strong></p>` : ''}
            <p style="color: #64748B; font-size: 12px; margin-top: 20px;">Open your Grivana app to view and acknowledge this message.</p>
          </div>
          `,
        )
        .catch(err => console.error('[NOTIFICATION EMAIL ERROR]', err?.message || err));
    }

    return NotificationService.enrichNotification({ ...created, customer });
  }

  async findAll() {
    const list = await this.notificationRepository.findAll({
      include: { customer: true },
      orderBy: { sentDate: 'desc' },
    });
    return list.map(n => NotificationService.enrichNotification(n));
  }

  async findByCustomer(customerId: number) {
    const list = await this.notificationRepository.findAll({
      where: { customerId },
      orderBy: { sentDate: 'desc' },
    });
    return list.map(n => NotificationService.enrichNotification(n));
  }

  async findByOrder(orderId: number, orderNumber?: string) {
    const all = await this.notificationRepository.findAll({
      include: { customer: true },
      orderBy: { sentDate: 'desc' },
    });
    const enriched = all.map(n => NotificationService.enrichNotification(n));
    return enriched.filter(
      n =>
        n.orderId === orderId ||
        (orderNumber && n.orderNumber && n.orderNumber.toUpperCase() === orderNumber.toUpperCase()) ||
        (orderNumber && String(n.message || '').toUpperCase().includes(orderNumber.toUpperCase())),
    );
  }

  async markAsRead(id: number, requesterId?: number, requesterRole?: string) {
    const notif = await this.notificationRepository.findById(id);
    if (!notif) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    if (requesterRole === 'Customer' && requesterId && notif.customerId !== requesterId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }

    const currentType = String(notif.notificationType || 'Push');
    if (currentType.includes('|READ|')) {
      return NotificationService.enrichNotification(notif);
    }

    const nowIso = new Date().toISOString();
    const updatedType = currentType.includes('|UNREAD')
      ? currentType.replace('|UNREAD', `|READ|${nowIso}`)
      : `${currentType}|READ|${nowIso}`;

    const updated = await this.notificationRepository.update(id, {
      notificationType: updatedType,
    });
    return NotificationService.enrichNotification(updated);
  }

  async markAllAsRead(customerId: number) {
    const list = await this.notificationRepository.findAll({
      where: { customerId },
    });
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    for (const notif of list) {
      const currentType = String(notif.notificationType || 'Push');
      if (!currentType.includes('|READ|')) {
        const updatedType = currentType.includes('|UNREAD')
          ? currentType.replace('|UNREAD', `|READ|${nowIso}`)
          : `${currentType}|READ|${nowIso}`;
        await this.notificationRepository.update(notif.id, {
          notificationType: updatedType,
        });
        updatedCount++;
      }
    }

    return { success: true, updatedCount, readAt: nowIso };
  }
}
