import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { conflictOnUnique } from '../common/db-errors.js';
import { Team } from '../team/entities/team.entity.js';
import { CreateCharacterDto } from './dto/create-character.dto.js';
import { FilterCharactersDto } from './dto/filter-characters.dto.js';
import { UpdateCharacterDto } from './dto/update-character.dto.js';
import { Character } from './entities/character.entity.js';
import { CharacterStatus } from './enums/character-status.enum.js';

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
  ) {}

  findAll(filters: FilterCharactersDto): Promise<Character[]> {
    const where: { status?: CharacterStatus; team_id?: number } = {};
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.teamId !== undefined) where.team_id = filters.teamId;
    return this.characters.find({ where, order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Character> {
    const character = await this.characters.findOne({
      where: { id },
      relations: { team: true },
    });
    if (!character) throw new NotFoundException(`Character ${id} not found`);
    return character;
  }

  async create(dto: CreateCharacterDto): Promise<Character> {
    await this.assertAliasFree(dto.alias);
    if (dto.team_id != null) await this.assertTeamUsable(dto.team_id);

    const created = await conflictOnUnique(
      () =>
        this.characters.save(
          this.characters.create({
            real_name: dto.real_name,
            alias: dto.alias,
            main_power: dto.main_power,
            power_level: dto.power_level,
            status: dto.status ?? CharacterStatus.ACTIVE,
            is_villain: dto.is_villain ?? false,
            team_id: dto.team_id ?? null,
          }),
        ),
      `A character with alias "${dto.alias}" already exists`,
    );
    return this.findOne(created.id);
  }

  async replace(id: number, dto: UpdateCharacterDto): Promise<Character> {
    const character = await this.characters.findOneBy({ id });
    if (!character) throw new NotFoundException(`Character ${id} not found`);
    await this.assertAliasFree(dto.alias, id);
    if (dto.team_id != null) await this.assertTeamUsable(dto.team_id);

    character.real_name = dto.real_name;
    character.alias = dto.alias;
    character.main_power = dto.main_power;
    character.power_level = dto.power_level;
    character.status = dto.status ?? CharacterStatus.ACTIVE;
    character.is_villain = dto.is_villain ?? false;
    character.team_id = dto.team_id ?? null;
    await conflictOnUnique(
      () => this.characters.save(character),
      `A character with alias "${dto.alias}" already exists`,
    );
    return this.findOne(id);
  }

  async updateStatus(id: number, status: CharacterStatus): Promise<Character> {
    const character = await this.characters.findOneBy({ id });
    if (!character) throw new NotFoundException(`Character ${id} not found`);
    if (
      character.status === CharacterStatus.RETIRED &&
      status === CharacterStatus.INJURED
    ) {
      throw new BadRequestException(
        'A RETIRED character cannot change directly to INJURED',
      );
    }
    character.status = status;
    await this.characters.save(character);
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    const result = await this.characters.delete(id);
    if (!result.affected) throw new NotFoundException(`Character ${id} not found`);
    return { message: `Character ${id} deleted` };
  }

  private async assertAliasFree(alias: string, excludeId?: number) {
    const clash = await this.characters.findOne({
      where: excludeId === undefined ? { alias } : { alias, id: Not(excludeId) },
    });
    if (clash) {
      throw new ConflictException(
        `A character with alias "${alias}" already exists`,
      );
    }
  }

  private async assertTeamUsable(teamId: number) {
    const team = await this.teams.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    if (!team.active) {
      throw new BadRequestException(`Team ${teamId} is not active`);
    }
  }
}
