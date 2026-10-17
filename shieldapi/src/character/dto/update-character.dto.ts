import { CreateCharacterDto } from './create-character.dto.js';

// PUT reemplaza el personaje completo: mismos campos que al crear.
export class UpdateCharacterDto extends CreateCharacterDto {}
