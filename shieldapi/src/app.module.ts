import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterModule } from './character/character.module.js';
import { TeamModule } from './team/team.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5433)),
        username: config.get<string>('DB_USER', 'marvel'),
        password: config.get<string>('DB_PASSWORD', 'marvel123'),
        database: config.get<string>('DB_NAME', 'marvel_db'),
        autoLoadEntities: true,
        // El esquema ya existe (db/init.sql): la API nunca crea ni modifica tablas.
        synchronize: false,
      }),
    }),
    TeamModule,
    CharacterModule,
  ],
})
export class AppModule {}
