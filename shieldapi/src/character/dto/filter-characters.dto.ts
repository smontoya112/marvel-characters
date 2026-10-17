import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { CharacterStatus } from '../enums/character-status.enum.js';

export class FilterCharactersDto {
  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;
}
