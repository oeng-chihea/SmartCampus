import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentDirectoryIndexes1790136000000
  implements MigrationInterface
{
  name = 'AddStudentDirectoryIndexes1790136000000';

  private readonly indexes = [
    { name: 'IDX_students_name', columns: '`name`' },
    { name: 'IDX_students_email', columns: '`email`' },
    { name: 'IDX_students_status', columns: '`status`' },
    { name: 'IDX_students_course_status', columns: '`course`, `status`' },
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const index of this.indexes) {
      if (!(await this.indexExists(queryRunner, index.name))) {
        await queryRunner.query(
          `CREATE INDEX \`${index.name}\` ON \`students\` (${index.columns})`,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of [...this.indexes].reverse()) {
      if (await this.indexExists(queryRunner, index.name)) {
        await queryRunner.query(
          `DROP INDEX \`${index.name}\` ON \`students\``,
        );
      }
    }
  }

  private async indexExists(
    queryRunner: QueryRunner,
    indexName: string,
  ): Promise<boolean> {
    const rows: unknown[] = await queryRunner.query(
      'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
      ['students', indexName],
    );
    return rows.length > 0;
  }
}
