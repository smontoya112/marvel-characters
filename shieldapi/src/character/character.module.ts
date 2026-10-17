import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../team/entities/team.entity.js';
import { CharacterController } from './character.controller.js';
import { CharacterService } from './character.service.js';
import { Character } from './entities/character.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Character, Team])],
  controllers: [CharacterController],
  providers: [CharacterService],
})
export class CharacterModule {}
