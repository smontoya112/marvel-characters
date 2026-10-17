import { ConflictException } from '@nestjs/common';

const PG_UNIQUE_VIOLATION = '23505';

/** Ejecuta una operación y traduce una violación de UNIQUE de Postgres a 409. */
export async function conflictOnUnique<T>(
  operation: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const code =
      (error as { driverError?: { code?: string } }).driverError?.code ??
      (error as { code?: string }).code;
    if (code === PG_UNIQUE_VIOLATION) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
