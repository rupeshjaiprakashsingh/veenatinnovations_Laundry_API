import { PrismaService } from '../prisma/prisma.service';
import { IBaseRepository } from './base.repository.interface';

export abstract class BasePrismaRepository<T> implements IBaseRepository<T> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelDelegate: any,
  ) {}

  async findAll(options?: any): Promise<T[]> {
    return this.modelDelegate.findMany(options);
  }

  async findById(id: number): Promise<T | null> {
    return this.modelDelegate.findUnique({
      where: { id },
    });
  }

  async create(data: any): Promise<T> {
    return this.modelDelegate.create({
      data,
    });
  }

  async update(id: number, data: any): Promise<T> {
    return this.modelDelegate.update({
      where: { id },
      data,
    });
  }

  async delete(id: number): Promise<T> {
    return this.modelDelegate.delete({
      where: { id },
    });
  }
}
