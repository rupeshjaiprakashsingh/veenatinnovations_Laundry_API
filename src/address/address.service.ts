import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AddressRepository } from '../common/repositories/laundry.repositories';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './address.dto';

@Injectable()
export class AddressService {
  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(customerId: number) {
    return this.addressRepository.findAll({
      where: { customerId },
      orderBy: { createdDate: 'desc' },
    });
  }

  async findOne(id: number, customerId: number) {
    const address = await this.addressRepository.findById(id);
    if (!address || address.customerId !== customerId) {
      throw new NotFoundException(`Address with ID ${id} not found for this customer`);
    }
    return address;
  }

  async create(customerId: number, dto: CreateAddressDto) {
    // Check if this is the first address to make it default automatically
    const count = await this.prisma.address.count({ where: { customerId } });
    const isDefault = count === 0 ? true : !!dto.isDefault;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Set all other customer's addresses default to false
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          ...dto,
          customerId,
          isDefault,
        },
      });
    });
  }

  async update(id: number, customerId: number, dto: UpdateAddressDto) {
    const address = await this.findOne(id, customerId);

    return this.prisma.$transaction(async (tx) => {
      let isDefault = dto.isDefault;

      if (isDefault === true && !address.isDefault) {
        // Mark all others as non-default
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      } else if (isDefault === false && address.isDefault) {
        // Prevent unsetting default if there's no other address or default is required
        // Find if there is another address to fallback to
        const otherAddress = await tx.address.findFirst({
          where: { customerId, NOT: { id } },
        });
        if (otherAddress) {
          await tx.address.update({
            where: { id: otherAddress.id },
            data: { isDefault: true },
          });
        } else {
          // If only 1 address, it must stay default
          isDefault = true;
        }
      }

      return tx.address.update({
        where: { id },
        data: {
          ...dto,
          isDefault,
        },
      });
    });
  }

  async remove(id: number, customerId: number) {
    const address = await this.findOne(id, customerId);

    return this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });

      // If we deleted the default address, set another one as default (if exists)
      if (address.isDefault) {
        const nextAddress = await tx.address.findFirst({
          where: { customerId },
          orderBy: { createdDate: 'desc' },
        });
        if (nextAddress) {
          await tx.address.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }

      return { success: true };
    });
  }
}
