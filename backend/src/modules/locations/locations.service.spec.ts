import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LocationEntity } from '../../database/entities/location.entity';
import { LOCATION_SEED } from './data/locations.seed';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let store: LocationEntity[];

  beforeEach(() => {
    store = LOCATION_SEED.map((row) => ({ ...row }) as LocationEntity);

    const repo = {
      find: jest.fn(async () =>
        [...store].sort((a, b) => a.id.localeCompare(b.id)),
      ),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        store.find((row) => row.id === where.id) ?? null,
      ),
      increment: jest.fn(
        async ({ id }: { id: string }, _field: string, value: number) => {
          const row = store.find((entry) => entry.id === id);
          if (row) {
            row.sessionsUsing += value;
          }
        },
      ),
      save: jest.fn(async (entity: LocationEntity) => {
        const index = store.findIndex((row) => row.id === entity.id);
        if (index >= 0) {
          store[index] = entity;
        }
        return entity;
      }),
    } as unknown as Repository<LocationEntity>;

    service = new LocationsService(repo);
  });

  it('returns seeded campus locations', async () => {
    const locations = await service.findAll();
    expect(locations.length).toBeGreaterThanOrEqual(6);
    expect(locations.some((location) => location.id === 'LOC-001')).toBe(true);
  });

  it('returns a single location by id', async () => {
    const location = await service.findOne('LOC-001');
    expect(location.name).toContain('Building A');
    expect(location.building).toBe('Building A');
    expect(location.radiusMeters).toBe(80);
    expect(location.latitude).toBe(11.5479313);
    expect(location.longitude).toBe(104.9405941);
  });

  it('rejects unknown location ids', async () => {
    await expect(service.findOne('LOC-missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects inactive locations for session hosting', async () => {
    await expect(service.findActiveById('LOC-005')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('tracks sessionsUsing counters', async () => {
    await service.incrementSessionsUsing('LOC-001');
    expect((await service.findOne('LOC-001')).sessionsUsing).toBe(1);
    await service.decrementSessionsUsing('LOC-001');
    expect((await service.findOne('LOC-001')).sessionsUsing).toBe(0);
  });
});
