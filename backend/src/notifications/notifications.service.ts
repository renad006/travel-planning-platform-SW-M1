import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

export interface NotifyInput {
  userId: string;
  type: string; // e.g. 'ACCOUNT_SUSPENDED'
  title: string;
  message: string;
  related?: { type: string; id: string };
}

export type NotifyManyInput = Omit<NotifyInput, 'userId'> & {
  userIds: string[];
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /** Send one in-app notification to one user. */
  async notify(input: NotifyInput): Promise<void> {
    await this.notificationModel.create(this.toDocument(input.userId, input));
  }

  /** Send the same in-app notification to several users. */
  async notifyMany(input: NotifyManyInput): Promise<void> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) {
      return;
    }
    await this.notificationModel.insertMany(
      userIds.map((id) => this.toDocument(id, input)),
    );
  }

  private toDocument(userId: string, input: Omit<NotifyInput, 'userId'>) {
    return {
      userId: new Types.ObjectId(userId),
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.related?.type,
      relatedEntityId: input.related?.id,
    };
  }
}