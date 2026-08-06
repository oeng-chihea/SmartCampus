import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('locations')
export class LocationEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 80 })
  building!: string;

  @Column({ type: 'varchar', length: 40 })
  room!: string;

  @Column({ name: 'radius_meters', type: 'int' })
  radiusMeters!: number;

  @Column({ type: 'double' })
  latitude!: number;

  @Column({ type: 'double' })
  longitude!: number;

  /** Active | Inactive */
  @Column({ type: 'varchar', length: 20, default: 'Active' })
  status!: string;

  @Column({ name: 'sessions_using', type: 'int', default: 0 })
  sessionsUsing!: number;
}
