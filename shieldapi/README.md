# ShieldAPI — Personajes Marvel (S.H.I.E.L.D.)

API REST con NestJS + TypeORM + PostgreSQL para registrar personajes del universo Marvel y los equipos a los que pertenecen.

## Requisitos
- Node.js 20+
- La base de datos del repositorio [marvel-characters](https://github.com/JGarcia55/marvel-characters) corriendo (`docker compose up -d`, puerto 5433)

## Puesta en marcha
```bash
npm install
cp .env.example .env     # ajusta los datos de conexión si hace falta
npm run start            # o npm run start:dev para recarga automática
```
La API queda en `http://localhost:3000`.

> La API **no crea ni modifica tablas** (`synchronize: false`); usa el esquema de `db/init.sql`.

## Endpoints

### Teams
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/teams` | Lista todos los equipos |
| GET | `/teams/:id` | Obtiene un equipo |
| GET | `/teams/:id/characters` | Personajes del equipo |
| POST | `/teams` | Crea un equipo (opcional `characterIds`) |
| PUT | `/teams/:id` | Reemplaza el equipo completo |
| PATCH | `/teams/:id/characters` | Asigna personajes (`{ "characterIds": [1, 2] }`) |
| DELETE | `/teams/:id` | Elimina un equipo |

### Characters
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/characters?status=&teamId=` | Lista personajes con filtros opcionales |
| GET | `/characters/:id` | Obtiene un personaje con su equipo |
| POST | `/characters` | Crea un personaje |
| PUT | `/characters/:id` | Reemplaza el personaje completo |
| PATCH | `/characters/:id/status` | Cambia solo el estado (`{ "status": "ACTIVE" }`) |
| DELETE | `/characters/:id` | Elimina un personaje |

Campos de personaje: `real_name`, `alias`, `main_power`, `power_level` (1–100), `status` (`ACTIVE|INJURED|MISSING|RETIRED`), `is_villain`, `team_id`.
Campos de equipo: `name`, `base`, `founded_year`, `active`.

## Reglas de negocio
1. Recurso inexistente (consultar/modificar/eliminar) → **404**.
2. `alias` de personaje o `name` de equipo duplicado → **409**.
3. `power_level` fuera de 1–100 o `status` inválido → **400**.
4. Al crear/actualizar un personaje con `team_id`: el equipo debe existir (**404**) y estar activo (**400**).
5. Al asignar personajes a un equipo: todos deben existir (**404**) y el equipo debe estar activo (**400**). Si ya tenían otro equipo, se reasignan.
6. No se elimina un equipo con personajes (**409**); se desactiva con `PUT` (`active: false`).
7. Un personaje `RETIRED` no puede pasar directamente a `INJURED` (**400**); sí puede volver a `ACTIVE`.
