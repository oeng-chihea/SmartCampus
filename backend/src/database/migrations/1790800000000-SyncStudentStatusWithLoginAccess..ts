import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncStudentStatusWithLoginAccess1790800000000
  implements MigrationInterface
{
  name = 'SyncStudentStatusWithLoginAccess1790800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE students
       SET status = CASE WHEN login_enabled = 1 THEN 'Active' ELSE 'Inactive' END`,
    );
  }

  async down(): Promise<void> {

  }
}