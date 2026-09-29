import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeAttendanceReadPaths1790686478000 implements MigrationInterface {
  name = 'OptimizeAttendanceReadPaths1790686478000';

  private readonly indexes = [
    {
      table: 'attendance_records',
      name: 'IDX_attendance_recorded_at',
      columns: '`recorded_at`',
    },
    {
      table: 'attendance_records',
      name: 'IDX_attendance_session_student',
      columns: '`session_id`, `student_id`',
    },
    {
      table: 'sessions',
      name: 'IDX_sessions_teacher_due_finalized',
      columns: '`teacher_id`, `due_at`, `absents_finalized`',
    },
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    const statusColumn = (await queryRunner.query(
      'SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
      ['attendance_records', 'status'],
    )) as Array<{ IS_NULLABLE?: string; is_nullable?: string }>;

    const nullable = String(
      statusColumn[0]?.IS_NULLABLE ?? statusColumn[0]?.is_nullable ?? '',
    ).toUpperCase();
    if (statusColumn.length > 0 && nullable !== 'YES') {
      await queryRunner.query(
        'ALTER TABLE `attendance_records` MODIFY COLUMN `status` varchar(32) NULL',
      );
    }

    for (const index of this.indexes) {
      if (!(await this.indexExists(queryRunner, index.table, index.name))) {
        await queryRunner.query(
          `CREATE INDEX \`${index.name}\` ON \`${index.table}\` (${index.columns})`,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const nullStatuses = (await queryRunner.query(
      'SELECT COUNT(*) AS total FROM `attendance_records` WHERE `status` IS NULL',
    )) as Array<{ total: string | number }>;
    if (Number(nullStatuses[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot make attendance_records.status NOT NULL while absent rows use NULL geofence status.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE `attendance_records` MODIFY COLUMN `status` varchar(32) NOT NULL',
    );

    for (const index of [...this.indexes].reverse()) {
      if (await this.indexExists(queryRunner, index.table, index.name)) {
        await queryRunner.query(
          `DROP INDEX \`${index.name}\` ON \`${index.table}\``,
        );
      }
    }
  }

  private async indexExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const rows: unknown[] = await queryRunner.query(
      'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
      [tableName, indexName],
    );
    return rows.length > 0;
  }
}
