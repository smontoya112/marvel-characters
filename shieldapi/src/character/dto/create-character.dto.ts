import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CharacterStatus } from '../enums/character-status.enum.js';

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  real_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  main_power: string;

  @IsInt()
  @Min(1)
  @Max(100)
  power_level: number;

  @IsOptional()
  @IsEnum(CharacterStatus)
  status?: CharacterStatus;

  @IsOptional()
  @IsBoolean()
  is_villain?: boolean;

  @IsOptional()
  @IsInt()
  team_id?: number | null;
}
