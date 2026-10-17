import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from '../character/entities/character.entity.js';
import { Team } from './entities/team.entity.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Character])],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
