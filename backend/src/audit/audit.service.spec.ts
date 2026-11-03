import { AuditService } from './audit.service';
import { Role } from '../common/enums/role.enum';

describe('AuditService', () => {
  it('stores an entry with actor, action and target', async () => {
    const saved: unknown[] = [];
    const model = {
      create: (doc: unknown) => {
        saved.push(doc);
        return Promise.resolve(doc);
      },
    };
    const service = new AuditService(model as never);

    await service.log({
      actor: { id: 'admin-1', role: Role.ADMIN },
      action: 'ACCOUNT_SUSPENDED',
      targetType: 'user',
      targetId: 'user-9',
      metadata: { reason: 'spam' },
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      actorId: 'admin-1',
      actorRole: Role.ADMIN,
      action: 'ACCOUNT_SUSPENDED',
      targetType: 'user',
      targetId: 'user-9',
      metadata: { reason: 'spam' },
    });
  });
});