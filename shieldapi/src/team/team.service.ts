import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { conflictOnUnique } from '../common/db-errors.js';
import { Character } from '../character/entities/character.entity.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { Team } from './entities/team.entity.js';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Team[]> {
    return this.teams.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Team> {
    const team = await this.teams.findOneBy({ id });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async findCharacters(id: number): Promise<Character[]> {
    await this.findOne(id);
    return this.characters.find({
      where: { team_id: id },
      order: { id: 'ASC' },
    });
  }

  async create(dto: CreateTeamDto): Promise<Team> {
    await this.assertNameFree(dto.name);

    const characterIds = dto.characterIds ?? [];
    const active = dto.active ?? true;
    if (characterIds.length > 0) {
      await this.assertCharactersExist(characterIds);
      if (!active) {
        throw new BadRequestException(
          'Cannot assign characters to an inactive team',
        );
      }
    }

    const teamId = await conflictOnUnique(
      () =>
        this.dataSource.transaction(async (manager) => {
          const team = await manager.save(
            manager.create(Team, {
              name: dto.name,
              base: dto.base ?? null,
              founded_year: dto.founded_year ?? null,
              active,
            }),
          );
          if (characterIds.length > 0) {
            await manager.update(
              Character,
              { id: In(characterIds) },
              { team_id: team.id },
            );
          }
          return team.id;
        }),
      `A team named "${dto.name}" already exists`,
    );
    return this.findOneWithCharacters(teamId);
  }

  async replace(id: number, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    await this.assertNameFree(dto.name, id);

    team.name = dto.name;
    team.base = dto.base ?? null;
    team.founded_year = dto.founded_year ?? null;
    team.active = dto.active ?? true;
    return conflictOnUnique(
      () => this.teams.save(team),
      `A team named "${dto.name}" already exists`,
    );
  }

  async assignCharacters(id: number, characterIds: number[]): Promise<Team> {
    const team = await this.findOne(id);
    await this.assertCharactersExist(characterIds);
    if (!team.active) {
      throw new BadRequestException(
        'Cannot assign characters to an inactive team',
      );
    }
    await this.characters.update({ id: In(characterIds) }, { team_id: id });
    return this.findOneWithCharacters(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);
    const members = await this.characters.countBy({ team_id: id });
    if (members > 0) {
      throw new ConflictException(
        `Team ${id} still has ${members} character(s); deactivate it with PUT (active: false) instead`,
      );
    }
    await this.teams.delete(id);
    return { message: `Team ${id} deleted` };
  }

  private async findOneWithCharacters(id: number): Promise<Team> {
    const team = await this.teams.findOne({
      where: { id },
      relations: { characters: true },
      order: { characters: { id: 'ASC' } },
    });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  private async assertNameFree(name: string, excludeId?: number) {
    const clash = await this.teams.findOne({
      where: excludeId === undefined ? { name } : { name, id: Not(excludeId) },
    });
    if (clash) {
      throw new ConflictException(`A team named "${name}" already exists`);
    }
  }

  private async assertCharactersExist(characterIds: number[]) {
    const found = await this.characters.find({
      where: { id: In(characterIds) },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = characterIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Character(s) not found: ${missing.join(', ')}`,
      );
    }
  }
}
