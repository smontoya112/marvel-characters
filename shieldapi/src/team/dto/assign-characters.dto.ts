import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class AssignCharactersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  characterIds: number[];
}
