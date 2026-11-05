import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  findByIdWithPassword(id: string) {
    return this.userModel.findById(id).select('+password').exec();
  }

  updateById(id: string, update: UpdateQuery<UserDocument>) {
    return this.userModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }
}