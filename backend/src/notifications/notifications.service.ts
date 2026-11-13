import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  buildPaginatedResponse,
  getSkip,
} from '../common/utils/pagination.helper';
import { ListNotificationsDto } from './dto/list-notifications.dto';
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

  /** The current user's notifications, newest first, optionally unread only. */
  async findMine(userId: string, query: ListNotificationsDto) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.unread) filter.read = false;

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(query))
        .limit(query.limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return buildPaginatedResponse(items, total, query);
  }

  /** Mark one notification as read. Only its owner may do this. */
  async markRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Notification not found');
    }
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You can only access your own notifications',
      );
    }
    notification.read = true;
    return notification.save();
  }

  /** Mark all of the current user's unread notifications as read. */
  async markAllRead(userId: string) {
    const result = await this.notificationModel
      .updateMany({ userId: new Types.ObjectId(userId), read: false }, { read: true })
      .exec();
    return { updated: result.modifiedCount };
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