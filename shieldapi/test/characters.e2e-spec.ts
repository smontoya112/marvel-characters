import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

// Sufijo para que los datos de prueba no choquen con los existentes.
const uid = () => Math.random().toString(36).slice(2, 8);

const valid = () => ({
  real_name: 'Test Person',
  alias: `A-${uid()}`,
  main_power: 'testing',
  power_level: 50,
});

describe('Characters (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  // Ids creados por las pruebas, para borrarlos al terminar y dejar la BD como estaba.
  const createdTeamIds: number[] = [];
  const createdCharacterIds: number[] = [];

  async function newTeam(overrides: Record<string, unknown> = {}) {
    const res = await http
      .post('/teams')
      .send({ name: `T-${uid()}`, ...overrides })
      .expect(201);
    createdTeamIds.push(res.body.id);
    return res.body as { id: number; name: string; active: boolean };
  }

  async function newCharacter(overrides: Record<string, unknown> = {}) {
    const res = await http
      .post('/characters')
      .send({ ...valid(), ...overrides })
      .expect(201);
    createdCharacterIds.push(res.body.id);
    return res.body as { id: number; alias: string; status: string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración que src/main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    for (const id of createdCharacterIds) await http.delete(`/characters/${id}`);
    for (const id of createdTeamIds) await http.delete(`/teams/${id}`);
    await app.close();
  });

  describe('GET', () => {
    it('GET /characters lista los personajes (200)', async () => {
      const res = await http.get('/characters').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('filtra por status', async () => {
      const hero = await newCharacter({ status: 'MISSING' });
      const res = await http.get('/characters?status=MISSING').expect(200);
      const ids = res.body.map((c: { id: number }) => c.id);
      expect(ids).toContain(hero.id);
      expect(res.body.every((c: { status: string }) => c.status === 'MISSING')).toBe(
        true,
      );
    });

    it('filtra por teamId', async () => {
      const team = await newTeam();
      const hero = await newCharacter({ team_id: team.id });
      const res = await http.get(`/characters?teamId=${team.id}`).expect(200);
      expect(res.body.map((c: { id: number }) => c.id)).toEqual([hero.id]);
    });

    it('status invÃ¡lido en el filtro -> 400', async () => {
      await http.get('/characters?status=NOPE').expect(400);
    });

    it('GET /characters/:id incluye los datos del equipo (200)', async () => {
      const team = await newTeam();
      const hero = await newCharacter({ team_id: team.id });
      const res = await http.get(`/characters/${hero.id}`).expect(200);
      expect(res.body.team.id).toBe(team.id);
      expect(res.body.team.name).toBe(team.name);
    });

    it('personaje sin equipo -> team null', async () => {
      const hero = await newCharacter();
      const res = await http.get(`/characters/${hero.id}`).expect(200);
      expect(res.body.team).toBeNull();
    });

    it('personaje inexistente -> 404', async () => {
      await http.get('/characters/999999').expect(404);
    });
  });

  describe('POST /characters', () => {
    it('crea un personaje (201) con valores por defecto', async () => {
      const hero = await newCharacter();
      const res = await http.get(`/characters/${hero.id}`).expect(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.is_villain).toBe(false);
      expect(res.body.team_id).toBeNull();
    });

    it('alias duplicado -> 409', async () => {
      const hero = await newCharacter();
      await http
        .post('/characters')
        .send({ ...valid(), alias: hero.alias })
        .expect(409);
    });

    it.each([0, 101, -5, 50.5])('power_level %s -> 400', async (power_level) => {
      await http
        .post('/characters')
        .send({ ...valid(), power_level })
        .expect(400);
    });

    it('status invÃ¡lido -> 400', async () => {
      await http
        .post('/characters')
        .send({ ...valid(), status: 'BAD' })
        .expect(400);
    });

    it('faltan campos obligatorios -> 400', async () => {
      await http.post('/characters').send({ alias: `A-${uid()}` }).expect(400);
    });

    it('team_id inexistente -> 404', async () => {
      await http
        .post('/characters')
        .send({ ...valid(), team_id: 999999 })
        .expect(404);
    });

    it('team_id de un equipo inactivo -> 400', async () => {
      const team = await newTeam({ active: false });
      await http
        .post('/characters')
        .send({ ...valid(), team_id: team.id })
        .expect(400);
    });
  });

  describe('PUT /characters/:id', () => {
    it('reemplaza el personaje completo (200)', async () => {
      const team = await newTeam();
      const hero = await newCharacter({ team_id: team.id, is_villain: true });
      const res = await http
        .put(`/characters/${hero.id}`)
        .send({ ...valid(), alias: hero.alias, power_level: 77 })
        .expect(200);
      expect(res.body.power_level).toBe(77);
      // PUT reemplaza: lo que no se enví­a vuelve a su valor por defecto
      expect(res.body.team_id).toBeNull();
      expect(res.body.is_villain).toBe(false);
    });

    it('alias de otro personaje -> 409', async () => {
      const a = await newCharacter();
      const b = await newCharacter();
      await http
        .put(`/characters/${b.id}`)
        .send({ ...valid(), alias: a.alias })
        .expect(409);
    });

    it('personaje inexistente -> 404', async () => {
      await http.put('/characters/999999').send(valid()).expect(404);
    });

    it('power_level invÃ¡lido -> 400', async () => {
      const hero = await newCharacter();
      await http
        .put(`/characters/${hero.id}`)
        .send({ ...valid(), power_level: 101 })
        .expect(400);
    });

    it('team_id inexistente -> 404 y equipo inactivo -> 400', async () => {
      const hero = await newCharacter();
      const inactive = await newTeam({ active: false });
      await http
        .put(`/characters/${hero.id}`)
        .send({ ...valid(), team_id: 999999 })
        .expect(404);
      await http
        .put(`/characters/${hero.id}`)
        .send({ ...valid(), team_id: inactive.id })
        .expect(400);
    });
  });

  describe('PATCH /characters/:id/status', () => {
    const setStatus = (id: number, status: string) =>
      http.patch(`/characters/${id}/status`).send({ status });

    it('cambia Ãºnicamente el estado (200)', async () => {
      const hero = await newCharacter();
      const res = await setStatus(hero.id, 'INJURED').expect(200);
      expect(res.body.status).toBe('INJURED');
      expect(res.body.alias).toBe(hero.alias);
    });

    it('RETIRED -> INJURED -> 400', async () => {
      const hero = await newCharacter({ status: 'RETIRED' });
      await setStatus(hero.id, 'INJURED').expect(400);
    });

    it('RETIRED -> ACTIVE -> 200', async () => {
      const hero = await newCharacter({ status: 'RETIRED' });
      await setStatus(hero.id, 'ACTIVE').expect(200);
    });

    it('status invÃ¡lido -> 400', async () => {
      const hero = await newCharacter();
      await setStatus(hero.id, 'WRONG').expect(400);
    });

    it('personaje inexistente -> 404', async () => {
      await setStatus(999999, 'ACTIVE').expect(404);
    });
  });

  describe('DELETE /characters/:id', () => {
    it('elimina el personaje (200) y luego da 404', async () => {
      const hero = await newCharacter();
      await http.delete(`/characters/${hero.id}`).expect(200);
      await http.get(`/characters/${hero.id}`).expect(404);
      await http.delete(`/characters/${hero.id}`).expect(404);
    });
  });
});