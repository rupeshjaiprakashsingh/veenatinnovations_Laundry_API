import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceRepository } from '../common/repositories/laundry.repositories';
import { CreateServiceDto, UpdateServiceDto } from './service.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async create(createServiceDto: CreateServiceDto) {
    return this.serviceRepository.create(createServiceDto);
  }

  async findAll() {
    return this.serviceRepository.findAll();
  }

  async findOne(id: number) {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return service;
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    await this.findOne(id); // Throws if not found
    return this.serviceRepository.update(id, updateServiceDto);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.serviceRepository.delete(id);
  }
}
