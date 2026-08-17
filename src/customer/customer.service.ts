import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateCustomerDto } from './customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    const customers = await this.customerRepository.findAll();
    const knownPincodes = ['400614', '400078', '400001', '400706', '400705', '400703'];
    return Promise.all(
      customers.map(async (c) => {
        let isServiceable = true;
        if (c.pincode) {
          const cleanP = c.pincode.trim();
          if (knownPincodes.includes(cleanP)) {
            isServiceable = true;
          } else {
            const shop = await this.prisma.laundryShop.findFirst({
              where: { pincode: cleanP, isActive: true },
            });
            const price = await this.prisma.servicePrice.findFirst({
              where: { pincode: cleanP, isActive: true },
            });
            isServiceable = !!(shop || price);
          }
        }
        return {
          ...c,
          isServiceable,
        };
      })
    );
  }


  async findOne(id: number) {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Check if referral discount is available for this customer
    let hasReferralDiscount = false;
    const pendingRefereeReferral = await this.prisma.referral.findUnique({
      where: { referredId: id },
    });
    if (pendingRefereeReferral && !pendingRefereeReferral.referredUsed) {
      hasReferralDiscount = true;
    }

    if (!hasReferralDiscount) {
      const pendingReferrerReferral = await this.prisma.referral.findFirst({
        where: {
          referrerId: id,
          referrerUsed: false,
        },
      });
      if (pendingReferrerReferral) {
        hasReferralDiscount = true;
      }
    }

    return {
      ...customer,
      hasReferralDiscount,
    };
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    await this.findOne(id); // Throws if not found

    if (updateCustomerDto.email) {
      const existing = await this.customerRepository.findAll({
        where: {
          email: updateCustomerDto.email,
          NOT: { id },
        },
      });
      if (existing.length > 0) {
        throw new BadRequestException('Customer with this email already registered');
      }
    }

    if (updateCustomerDto.mobileNumber) {
      const existing = await this.customerRepository.findAll({
        where: {
          mobileNumber: updateCustomerDto.mobileNumber,
          NOT: { id },
        },
      });
      if (existing.length > 0) {
        throw new BadRequestException('Customer with this mobile number already registered');
      }
    }

    if (updateCustomerDto.customerCode) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          customerCode: updateCustomerDto.customerCode,
          NOT: { id },
        },
      });
      if (existing) {
        throw new BadRequestException('Customer with this customer code already registered');
      }
    }

    const { lat, lng, ...customerUpdateData } = updateCustomerDto;
    const updated = await this.customerRepository.update(id, customerUpdateData);

    // Sync to default Address record as well
    if (updateCustomerDto.address || updateCustomerDto.city || updateCustomerDto.state || updateCustomerDto.pincode || updateCustomerDto.landmark || updateCustomerDto.houseDetails || updateCustomerDto.lat || updateCustomerDto.lng) {
      const defaultAddr = await this.prisma.address.findFirst({
        where: { customerId: id, isDefault: true },
      });

      if (defaultAddr) {
        await this.prisma.address.update({
          where: { id: defaultAddr.id },
          data: {
            address: updateCustomerDto.address ?? defaultAddr.address,
            city: updateCustomerDto.city ?? defaultAddr.city,
            state: updateCustomerDto.state ?? defaultAddr.state,
            pincode: updateCustomerDto.pincode ?? defaultAddr.pincode,
            landmark: updateCustomerDto.landmark ?? defaultAddr.landmark,
            houseDetails: updateCustomerDto.houseDetails ?? defaultAddr.houseDetails,
            lat: updateCustomerDto.lat ?? defaultAddr.lat,
            lng: updateCustomerDto.lng ?? defaultAddr.lng,
          },
        });
      } else {
        await this.prisma.address.create({
          data: {
            customerId: id,
            title: 'Home Address',
            address: updateCustomerDto.address || updated.address || '',
            city: updateCustomerDto.city || updated.city || null,
            state: updateCustomerDto.state || updated.state || null,
            pincode: updateCustomerDto.pincode || updated.pincode || null,
            landmark: updateCustomerDto.landmark || updated.landmark || null,
            houseDetails: updateCustomerDto.houseDetails || updated.houseDetails || null,
            lat: updateCustomerDto.lat || null,
            lng: updateCustomerDto.lng || null,
            isDefault: true,
          },
        });
      }
    }

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    return await this.prisma.$transaction(async (tx) => {
      const custOrders = await tx.order.findMany({
        where: { customerId: id },
        select: { id: true },
      });
      const orderIds = custOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        await tx.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      await tx.referral.deleteMany({
        where: { OR: [{ referrerId: id }, { referredId: id }] },
      });
      await tx.notification.deleteMany({ where: { customerId: id } });
      await tx.address.deleteMany({ where: { customerId: id } });
      await tx.pickupRequest.deleteMany({ where: { customerId: id } });

      return await tx.customer.delete({ where: { id } });
    });
  }

  async removeAll() {
    return await this.prisma.$transaction(async (tx) => {
      const referrals = await tx.referral.deleteMany({});
      const notifications = await tx.notification.deleteMany({});
      const addresses = await tx.address.deleteMany({});
      const pickupRequests = await tx.pickupRequest.deleteMany({});
      const deliveries = await tx.delivery.deleteMany({});
      const payments = await tx.payment.deleteMany({});
      const orderItems = await tx.orderItem.deleteMany({});
      const orderStatusHistories = await tx.orderStatusHistory.deleteMany({});
      const orders = await tx.order.deleteMany({});
      const customers = await tx.customer.deleteMany({});

      return {
        message: 'All users and dependent data successfully removed',
        deletedCounts: {
          customers: customers.count,
          orders: orders.count,
          addresses: addresses.count,
          pickupRequests: pickupRequests.count,
          notifications: notifications.count,
          referrals: referrals.count,
        },
      };
    });
  }
}

