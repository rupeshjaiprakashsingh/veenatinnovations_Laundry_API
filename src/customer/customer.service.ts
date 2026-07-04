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
    return this.customerRepository.findAll();
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

    return this.customerRepository.update(id, updateCustomerDto);
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      return await this.customerRepository.delete(id);
    } catch (error) {
      throw new BadRequestException('Cannot delete customer due to existing orders or dependencies');
    }
  }
}
