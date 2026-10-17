import { IsEnum } from 'class-validator';
import { CharacterStatus } from '../enums/character-status.enum.js';

export class UpdateStatusDto {
  @IsEnum(CharacterStatus)
  status: CharacterStatus;
}
