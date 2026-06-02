import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BranchRepository } from '../common/repositories/laundry.repositories';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto';

@Injectable()
export class BranchService {
  constructor(private readonly branchRepository: BranchRepository) {}

  async create(createBranchDto: CreateBranchDto) {
    // Check if branchCode already exists
    const existing = await this.branchRepository.findAll({
      where: { branchCode: createBranchDto.branchCode },
    });
    if (existing.length > 0) {
      throw new BadRequestException('Branch with this code already exists');
    }

    return this.branchRepository.create({
      branchName: createBranchDto.branchName,
      branchCode: createBranchDto.branchCode,
      address: createBranchDto.address,
      contactNumber: createBranchDto.contactNumber,
      email: createBranchDto.email,
      isActive: createBranchDto.isActive ?? true,
    });
  }

  async findAll() {
    return this.branchRepository.findAll();
  }

  async findOne(id: number) {
    const branch = await this.branchRepository.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async update(id: number, updateBranchDto: UpdateBranchDto) {
    await this.findOne(id); // Throws if not found

    if (updateBranchDto.branchCode) {
      const existing = await this.branchRepository.findAll({
        where: {
          branchCode: updateBranchDto.branchCode,
          NOT: { id },
        },
      });
      if (existing.length > 0) {
        throw new BadRequestException('Branch with this code already exists');
      }
    }

    return this.branchRepository.update(id, updateBranchDto);
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      return await this.branchRepository.delete(id);
    } catch (error) {
      throw new BadRequestException('Cannot delete branch as it might have linked employees or orders');
    }
  }
}
