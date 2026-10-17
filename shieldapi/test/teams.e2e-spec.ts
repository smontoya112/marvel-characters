import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const uid = () => Math.random().toString(36).slice(2, 8);

describe('Teams (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
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
      .send({
        real_name: 'Test Person',
        alias: `A-${uid()}`,
        main_power: 'testing',
        power_level: 50,
        ...overrides,
      })
      .expect(201);
    createdCharacterIds.push(res.body.id);
    return res.body as { id: number; alias: string };
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
    it('GET /teams lista los equipos (200)', async () => {
      const res = await http.get('/teams').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /teams/:id devuelve el equipo (200)', async () => {
      const team = await newTeam();
      const res = await http.get(`/teams/${team.id}`).expect(200);
      expect(res.body.name).toBe(team.name);
    });

    it('GET /teams/:id inexistente -> 404', async () => {
      await http.get('/teams/999999').expect(404);
    });

    it('GET /teams/:id con id no numÃ©rico -> 400', async () => {
      await http.get('/teams/abc').expect(400);
    });

    it('GET /teams/:id/characters lista los personajes del equipo (200)', async () => {
      const team = await newTeam();
      const hero = await newCharacter({ team_id: team.id });
      const res = await http.get(`/teams/${team.id}/characters`).expect(200);
      expect(res.body.map((c: { id: number }) => c.id)).toEqual([hero.id]);
    });

    it('GET /teams/:id/characters de equipo inexistente -> 404', async () => {
      await http.get('/teams/999999/characters').expect(404);
    });
  });

  describe('POST /teams', () => {
    it('crea un equipo (201) con valores por defecto', async () => {
      const team = await newTeam({ base: 'Lab', founded_year: 2020 });
      expect(team.active).toBe(true);
    });

    it('crea un equipo asignando characterIds (201)', async () => {
      const hero = await newCharacter();
      const team = await newTeam({ characterIds: [hero.id] });
      const res = await http.get(`/characters/${hero.id}`).expect(200);
      expect(res.body.team_id).toBe(team.id);
    });

    it('nombre duplicado -> 409', async () => {
      const team = await newTeam();
      await http.post('/teams').send({ name: team.name }).expect(409);
    });

    it('sin name -> 400', async () => {
      await http.post('/teams').send({ base: 'Lab' }).expect(400);
    });

    it('founded_year fuera de rango -> 400', async () => {
      await http
        .post('/teams')
        .send({ name: `T-${uid()}`, founded_year: 1500 })
        .expect(400);
    });

    it('characterIds con un personaje inexistente -> 404', async () => {
      await http
        .post('/teams')
        .send({ name: `T-${uid()}`, characterIds: [999999] })
        .expect(404);
    });

    it('characterIds en un equipo inactivo -> 400', async () => {
      const hero = await newCharacter();
      await http
        .post('/teams')
        .send({ name: `T-${uid()}`, active: false, characterIds: [hero.id] })
        .expect(400);
    });
  });

  describe('PUT /teams/:id', () => {
    it('reemplaza el equipo completo (200)', async () => {
      const team = await newTeam({ base: 'Lab', founded_year: 2020 });
      const name = `T-${uid()}`;
      const res = await http.put(`/teams/${team.id}`).send({ name }).expect(200);
      expect(res.body.name).toBe(name);
      expect(res.body.base).toBeNull();
      expect(res.body.founded_year).toBeNull();
    });

    it('permite desactivar el equipo (active: false)', async () => {
      const team = await newTeam();
      const res = await http
        .put(`/teams/${team.id}`)
        .send({ name: team.name, active: false })
        .expect(200);
      expect(res.body.active).toBe(false);
    });

    it('nombre de otro equipo -> 409', async () => {
      const a = await newTeam();
      const b = await newTeam();
      await http.put(`/teams/${b.id}`).send({ name: a.name }).expect(409);
    });

    it('equipo inexistente -> 404', async () => {
      await http.put('/teams/999999').send({ name: `T-${uid()}` }).expect(404);
    });

    it('name vacÃ­o -> 400', async () => {
      const team = await newTeam();
      await http.put(`/teams/${team.id}`).send({ name: '' }).expect(400);
    });
  });

  describe('PATCH /teams/:id/characters', () => {
    it('asigna personajes (200) y reasigna los que tenÃ­an otro equipo', async () => {
      const first = await newTeam();
      const second = await newTeam();
      const hero = await newCharacter({ team_id: first.id });

      const res = await http
        .patch(`/teams/${second.id}/characters`)
        .send({ characterIds: [hero.id] })
        .expect(200);
      expect(res.body.characters.map((c: { id: number }) => c.id)).toEqual([
        hero.id,
      ]);

      const moved = await http.get(`/characters/${hero.id}`).expect(200);
      expect(moved.body.team_id).toBe(second.id);
    });

    it('equipo inexistente -> 404', async () => {
      const hero = await newCharacter();
      await http
        .patch('/teams/999999/characters')
        .send({ characterIds: [hero.id] })
        .expect(404);
    });

    it('personaje inexistente -> 404', async () => {
      const team = await newTeam();
      await http
        .patch(`/teams/${team.id}/characters`)
        .send({ characterIds: [999999] })
        .expect(404);
    });

    it('equipo inactivo -> 400', async () => {
      const team = await newTeam({ active: false });
      const hero = await newCharacter();
      await http
        .patch(`/teams/${team.id}/characters`)
        .send({ characterIds: [hero.id] })
        .expect(400);
    });

    it('lista vacÃ­a -> 400', async () => {
      const team = await newTeam();
      await http
        .patch(`/teams/${team.id}/characters`)
        .send({ characterIds: [] })
        .expect(400);
    });
  });

  describe('DELETE /teams/:id', () => {
    it('elimina un equipo sin personajes (200)', async () => {
      const team = await newTeam();
      await http.delete(`/teams/${team.id}`).expect(200);
      await http.get(`/teams/${team.id}`).expect(404);
    });

    it('equipo con personajes -> 409', async () => {
      const team = await newTeam();
      await newCharacter({ team_id: team.id });
      await http.delete(`/teams/${team.id}`).expect(409);
    });

    it('equipo inexistente -> 404', async () => {
      await http.delete('/teams/999999').expect(404);
    });
  });
});