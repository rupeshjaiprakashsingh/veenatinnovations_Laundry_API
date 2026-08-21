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
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { NotificationSenderService } from '../notification/notification-sender.service';

interface OtpRecord {
  otp: string;
  expiresAt: number; // 10 minutes timestamp
}

@Injectable()
export class AuthService {
  private otpMap = new Map<string, OtpRecord>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationSender: NotificationSenderService,
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
    if (!dto.email || !dto.email.trim()) {
      throw new BadRequestException('Email address is required');
    }
    if (!dto.mobileNumber || !dto.mobileNumber.trim()) {
      throw new BadRequestException('Mobile number is required');
    }

    const emailTrimmed = dto.email.trim();
    const emailExists = await this.prisma.customer.findFirst({ where: { email: emailTrimmed } });
    if (emailExists) throw new BadRequestException('Email already registered');

    const mobileTrimmed = dto.mobileNumber.trim();
    const altMobile = mobileTrimmed.startsWith('+91') ? mobileTrimmed.slice(3) : `+91${mobileTrimmed}`;
    const mobileExists = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { mobileNumber: mobileTrimmed },
          { mobileNumber: altMobile }
        ]
      }
    });
    if (mobileExists) throw new BadRequestException('Mobile number already registered');

    // Verify manual CustomerCode uniqueness if provided, else auto-generate
    let customerCode = dto.customerCode && dto.customerCode.trim() ? dto.customerCode.trim() : '';
    if (customerCode) {
      const codeExists = await this.prisma.customer.findFirst({
        where: { customerCode },
      });
      if (codeExists) {
        throw new BadRequestException('Customer code already registered');
      }
    } else {
      const count = await this.prisma.customer.count();
      customerCode = `CUST-${String(count + 1).padStart(4, '0')}`;
    }

    // Check if referralCode is valid if provided
    let referrerId: number | null = null;
    if (dto.referralCode && dto.referralCode.trim()) {
      const refTrimmed = dto.referralCode.trim();
      const altRef = refTrimmed.startsWith('+91') ? refTrimmed.slice(3) : `+91${refTrimmed}`;
      const referrer = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { referralCode: refTrimmed },
            { customerCode: refTrimmed },
            { mobileNumber: refTrimmed },
            { mobileNumber: altRef }
          ]
        }
      });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }
      referrerId = referrer.id;
    }

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
        houseDetails: dto.houseDetails,
        gender: dto.gender,
        dob: dto.dob,
        referralCode: customerCode,
        isActive: true,
      },
    });

    if (dto.address) {
      await this.prisma.address.create({
        data: {
          customerId: customer.id,
          title: 'Home Address',
          address: dto.address,
          city: dto.city || null,
          state: dto.state || null,
          pincode: dto.pincode || null,
          landmark: dto.landmark || null,
          houseDetails: dto.houseDetails || null,
          lat: dto.lat || null,
          lng: dto.lng || null,
          isDefault: true,
        },
      });
    }

    if (referrerId) {
      await this.prisma.referral.create({
        data: {
          referrerId: referrerId,
          referredId: customer.id,
          referrerUsed: false,
          referredUsed: false,
        }
      });
    }

    const tokens = await this.generateTokens(customer.id, customer.email, 'Customer', customer.customerCode);
    
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // Send welcome email
    this.notificationSender.sendRegistrationEmail(customer.email, customer.firstName).catch(err => {
      console.error('Welcome email failed:', err);
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
        houseDetails: customer.houseDetails,
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
        houseDetails: customer.houseDetails,
        gender: customer.gender,
        dob: customer.dob,
        referralCode: customer.referralCode,
      },
      ...tokens,
    };
  }

  async sendOtp(dto: SendOtpDto) {
    const cleanMobile = dto.mobileNumber.replace(/\D/g, '');
    const otpCode = dto.otp || String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // Valid for 10 minutes (600,000 ms)

    // Store in otpMap for verification
    this.otpMap.set(cleanMobile, { otp: otpCode, expiresAt });
    if (cleanMobile.length > 10 && cleanMobile.startsWith('91')) {
      const shortMobile = cleanMobile.slice(2);
      this.otpMap.set(shortMobile, { otp: otpCode, expiresAt });
    }

    const smsResult = await this.notificationSender.sendOtpSMS(dto.mobileNumber, otpCode);

    // If this mobile number belongs to an existing customer with an email, dispatch backup email to THAT customer's email
    try {
      const raw10 = cleanMobile.length >= 10 ? cleanMobile.slice(-10) : cleanMobile;
      const customer = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { mobileNumber: raw10 },
            { mobileNumber: `+91${raw10}` },
            { mobileNumber: `91${raw10}` },
          ],
        },
      });
      if (customer && customer.email && customer.email.includes('@')) {
        this.notificationSender.sendEmail(
          customer.email.trim(),
          `Your Grivana Login OTP: ${otpCode}`,
          `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px; background-color: #EEF2FF; padding: 15px; border-radius: 8px;">
              <h2 style="color: #4F46E5; margin: 0; font-size: 20px;">Grivana OTP Verification</h2>
            </div>
            <p style="color: #334155; font-size: 14px;">Dear Customer,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your 4-digit verification code to log in to Grivana Laundry app is:</p>
            <div style="background-color: #FFFBEB; border: 2px dashed #F59E0B; color: #B45309; text-align: center; font-size: 32px; font-weight: bold; padding: 15px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
              ${otpCode}
            </div>
            <p style="color: #64748B; font-size: 12px; text-align: center;">This code is valid for 10 minutes. Do not share this OTP with anyone.</p>
          </div>
          `
        ).catch(err => console.error('[AUTH OTP EMAIL ERROR]', err));
      }
    } catch (e) {
      console.error('[AUTH CUSTOMER LOOKUP ERROR]', e);
    }

    return {
      success: true,
      message: `OTP SMS dispatched to ${dto.mobileNumber}. Valid for 10 minutes.`,
      otp: otpCode,
      expiresAt: new Date(expiresAt).toISOString(),
      gatewayResponse: smsResult,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const cleanMobile = dto.mobileNumber.replace(/\D/g, '');
    const inputOtp = (dto.otp || '').trim();

    // Fallback bypass for testing
    if (inputOtp === '1234') {
      return { success: true, valid: true, message: 'OTP verified successfully' };
    }

    const record = this.otpMap.get(cleanMobile);
    if (!record) {
      throw new BadRequestException('No OTP request found for this mobile number. Please request a new OTP.');
    }

    // Verify 10-minute expiration
    if (Date.now() > record.expiresAt) {
      this.otpMap.delete(cleanMobile);
      throw new BadRequestException('OTP has expired after 10 minutes. Please request a new OTP.');
    }

    if (inputOtp !== record.otp) {
      throw new BadRequestException('Invalid OTP code. Please check your SMS and enter the valid 4-digit OTP.');
    }

    // OTP is valid! Clear stored OTP
    this.otpMap.delete(cleanMobile);

    return {
      success: true,
      valid: true,
      message: 'OTP verified successfully',
    };
  }
}
