import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeeRepository } from '../common/repositories/laundry.repositories';
import { UpdateEmployeeDto } from './employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async findAll() {
    return this.employeeRepository.findAll({
      include: { branch: true },
    });
  }

  async findOne(id: number) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    await this.findOne(id); // Throws if not found

    if (updateEmployeeDto.email) {
      const existing = await this.employeeRepository.findAll({
        where: {
          email: updateEmployeeDto.email,
          NOT: { id },
        },
      });
      if (existing.length > 0) {
        throw new BadRequestException('Employee with this email already exists');
      }
    }

    if (updateEmployeeDto.mobileNumber) {
      const existing = await this.employeeRepository.findAll({
        where: {
          mobileNumber: updateEmployeeDto.mobileNumber,
          NOT: { id },
        },
      });
      if (existing.length > 0) {
        throw new BadRequestException('Employee with this mobile number already exists');
      }
    }

    return this.employeeRepository.update(id, updateEmployeeDto);
  }

  async remove(id: number) {
    const emp = await this.findOne(id);
    if (emp.role === 'SuperAdmin') {
      throw new BadRequestException('Cannot delete SuperAdmin employee');
    }
    return this.employeeRepository.delete(id);
  }
}
