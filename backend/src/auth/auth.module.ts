import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          // '1d'-style strings are valid at runtime; the cast satisfies the typings
          expiresIn: config.get<string>('jwt.expiresIn') as unknown as number,
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}