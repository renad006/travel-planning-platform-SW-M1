import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { ProviderType } from '../common/enums/provider-type.enum';
import { Role } from '../common/enums/role.enum';
import { Airline, AirlineDocument } from '../flights/schemas/airline.schema';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateModeratorDto } from './dto/create-moderator.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
    @InjectModel(Hotel.name)
    private readonly hotelModel: Model<HotelDocument>,
  ) {}

  // ACC-13: admin creates a moderator linked to exactly one provider
  async createModerator(dto: CreateModeratorDto, admin: UserDocument) {
    const isAirline = dto.role === Role.AIRLINE_MODERATOR;
    const providerType = isAirline ? ProviderType.AIRLINE : ProviderType.HOTEL;

    const providerExists = isAirline
      ? await this.airlineModel.exists({ _id: dto.providerId })
      : await this.hotelModel.exists({ _id: dto.providerId });
    if (!providerExists) {
      throw new NotFoundException(`No ${providerType} found with this id`);
    }

    if (await this.usersService.findByEmail(dto.email)) {
      throw new ConflictException('Email is already registered');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: await bcrypt.hash(temporaryPassword, 10),
      role: dto.role,
      mustChangePassword: true,
      assignedProviderType: providerType,
      assignedProviderId: new Types.ObjectId(dto.providerId),
    });

    await this.auditService.log({
      actor: { id: admin.id, role: admin.role },
      action: 'MODERATOR_CREATED',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        role: dto.role,
        providerType,
        providerId: dto.providerId,
      },
    });

    // The temporary password is returned once and never stored in plain text.
    return { user: user.toJSON(), temporaryPassword };
  }

  // 12 characters, always at least one letter and one digit (password rules)
  private generateTemporaryPassword(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = letters + digits;
    const pick = (set: string) => set[randomInt(set.length)];

    const chars = [pick(letters), pick(digits)];
    while (chars.length < 12) {
      chars.push(pick(all));
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}