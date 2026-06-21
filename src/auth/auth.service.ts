import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  LoginDto,
  RegisterCustomerDto,
  RegisterEmployeeDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  PhoneLoginDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Try finding in Employee
    let user: any = await this.prisma.employee.findUnique({
      where: { email },
      include: { branch: true },
    });
    let isCustomer = false;

    // 2. Try finding in Customer if not found in Employee
    if (!user) {
      user = await this.prisma.customer.findUnique({
        where: { email },
      });
      isCustomer = true;
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or account is inactive');
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const role = isCustomer ? 'Customer' : user.role;
    const code = isCustomer ? user.customerCode : user.employeeCode;
    const name = isCustomer ? `${user.firstName} ${user.lastName}` : user.fullName;

    // 4. Generate Tokens
    const tokens = await this.generateTokens(user.id, user.email, role, code);

    // 5. Save Refresh Token
    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name,
        role,
        code,
        branchId: !isCustomer ? user.branchId : undefined,
        branchName: !isCustomer && user.branch ? user.branch.branchName : undefined,
      },
      ...tokens,
    };
  }

  async registerCustomer(dto: RegisterCustomerDto) {
    // Check if email or mobile exists
    const emailExists = await this.prisma.customer.findUnique({ where: { email: dto.email } });
    if (emailExists) throw new BadRequestException('Email already registered');

    const mobileExists = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { mobileNumber: dto.mobileNumber },
          { mobileNumber: dto.mobileNumber.startsWith('+91') ? dto.mobileNumber.slice(3) : `+91${dto.mobileNumber}` }
        ]
      }
    });
    if (mobileExists) throw new BadRequestException('Mobile number already registered');

    // Auto-generate CustomerCode (e.g. CUST-xxxx)
    const count = await this.prisma.customer.count();
    const customerCode = `CUST-${String(count + 1).padStart(4, '0')}`;

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const customer = await this.prisma.customer.create({
      data: {
        customerCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        mobileNumber: dto.mobileNumber,
        password: hashedPassword,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        landmark: dto.landmark,
        gender: dto.gender,
        dob: dto.dob,
        referralCode: dto.referralCode,
        isActive: true,
      },
    });

    const tokens = await this.generateTokens(customer.id, customer.email, 'Customer', customer.customerCode);
    
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: {
        id: customer.id,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
        role: 'Customer',
        code: customer.customerCode,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        landmark: customer.landmark,
        gender: customer.gender,
        dob: customer.dob,
        referralCode: customer.referralCode,
      },
      ...tokens,
    };
  }

  async registerEmployee(dto: RegisterEmployeeDto) {
    const emailExists = await this.prisma.employee.findUnique({ where: { email: dto.email } });
    if (emailExists) throw new BadRequestException('Email already registered');

    const mobileExists = await this.prisma.employee.findUnique({ where: { mobileNumber: dto.mobileNumber } });
    if (mobileExists) throw new BadRequestException('Mobile number already registered');

    // Generate EmployeeCode
    const count = await this.prisma.employee.count();
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const employee = await this.prisma.employee.create({
      data: {
        employeeCode,
        fullName: dto.fullName,
        email: dto.email,
        mobileNumber: dto.mobileNumber,
        role: dto.role,
        branchId: dto.branchId,
        password: hashedPassword,
        isActive: true,
      },
    });

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    // Find user by refresh token in Employee
    let user: any = await this.prisma.employee.findFirst({
      where: { refreshToken: dto.refreshToken },
    });
    let isCustomer = false;

    if (!user) {
      user = await this.prisma.customer.findFirst({
        where: { refreshToken: dto.refreshToken },
      });
      isCustomer = true;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const role = isCustomer ? 'Customer' : user.role;
    const code = isCustomer ? user.customerCode : user.employeeCode;

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, role, code);

    // Save refresh token
    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });
    }

    return tokens;
  }

  async changePassword(userId: number, role: string, dto: ChangePasswordDto) {
    let user: any;
    if (role === 'Customer') {
      user = await this.prisma.customer.findUnique({ where: { id: userId } });
    } else {
      user = await this.prisma.employee.findUnique({ where: { id: userId } });
    }

    if (!user) throw new NotFoundException('User not found');

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isPasswordValid) throw new BadRequestException('Incorrect old password');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    if (role === 'Customer') {
      await this.prisma.customer.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    }

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // 1. Check in Customer
    let user: any = await this.prisma.customer.findUnique({ where: { email: dto.email } });
    let isCustomer = true;

    if (!user) {
      user = await this.prisma.employee.findUnique({ where: { email: dto.email } });
      isCustomer = false;
    }

    if (!user) throw new NotFoundException('User with this email does not exist');

    // Generate reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpires },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpires },
      });
    }

    // In a real-world scenario, you would send this via email. We will log it.
    console.log(`[FORGOT PASSWORD] Reset token for ${dto.email} is: ${resetToken}`);

    return {
      message: 'Password reset link sent successfully. Please check server logs for the token.',
      // For easy testing, we return the token in non-production, but since this is production-ready, we just tell them to check logs or mock it.
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Try customer
    let user: any = await this.prisma.customer.findFirst({
      where: {
        email: dto.email,
        resetToken: dto.token,
        resetTokenExpires: { gte: new Date() },
      },
    });
    let isCustomer = true;

    if (!user) {
      user = await this.prisma.employee.findFirst({
        where: {
          email: dto.email,
          resetToken: dto.token,
          resetTokenExpires: { gte: new Date() },
        },
      });
      isCustomer = false;
    }

    if (!user) {
      throw new BadRequestException('Invalid reset token or token has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
    }

    return { message: 'Password has been reset successfully' };
  }

  private async generateTokens(userId: number, email: string, role: string, code: string) {
    const payload = { sub: userId, email, role, code };

    // Access token: 1 year (365 days). Env var overrides the default.
    const accessTokenExpiry  = (process.env.JWT_EXPIRATION         || '365d') as any;
    // Refresh token: 1 year as well so users are never forced to re-login.
    const refreshTokenExpiry = (process.env.JWT_REFRESH_EXPIRATION || '365d') as any;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: accessTokenExpiry  }),
      this.jwtService.signAsync(payload, { expiresIn: refreshTokenExpiry }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async phoneLogin(dto: PhoneLoginDto) {
    const { mobileNumber } = dto;

    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { mobileNumber },
          { mobileNumber: mobileNumber.startsWith('+91') ? mobileNumber.slice(3) : `+91${mobileNumber}` }
        ]
      },
    });

    if (!customer) {
      return {
        exists: false,
        message: 'User not registered',
      };
    }

    if (!customer.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const tokens = await this.generateTokens(customer.id, customer.email, 'Customer', customer.customerCode);

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      exists: true,
      user: {
        id: customer.id,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
        role: 'Customer',
        code: customer.customerCode,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        landmark: customer.landmark,
        gender: customer.gender,
        dob: customer.dob,
        referralCode: customer.referralCode,
      },
      ...tokens,
    };
  }
}
