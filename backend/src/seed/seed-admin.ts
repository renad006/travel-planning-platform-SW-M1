import { hash } from 'bcrypt';
import { PASSWORD_REGEX } from '../common/constants/password-rules';
import { AccountStatus } from '../common/enums/account-status.enum';
import { Role } from '../common/enums/role.enum';
import { UsersService } from '../users/users.service';

// ACC-18: admin accounts are created by seeding only. Safe to run twice.
export async function seedAdmin(
  users: UsersService,
  email: string | undefined,
  password: string | undefined,
): Promise<void> {
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      'ADMIN_PASSWORD must be 8+ characters with a letter and a digit',
    );
  }

  const existing = await users.findByEmail(email);
  if (existing) {
    await users.updateById(existing.id, {
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    });
    console.log(`Admin already exists, kept: ${email}`);
    return;
  }

  await users.create({
    name: 'Platform Admin',
    email: email.toLowerCase(),
    password: await hash(password, 10),
    role: Role.ADMIN,
    status: AccountStatus.ACTIVE,
    termsAcceptedAt: new Date(),
  });
  console.log(`Admin created: ${email}`);
}