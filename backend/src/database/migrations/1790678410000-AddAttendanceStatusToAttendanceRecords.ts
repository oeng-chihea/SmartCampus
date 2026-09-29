import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendanceStatusToAttendanceRecords1790678410000
  implements MigrationInterface
{
  name = 'AddAttendanceStatusToAttendanceRecords1790678410000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner))) {
      await queryRunner.query(
        'ALTER TABLE `attendance_records` ADD `attendance_status` varchar(16) NULL',
      );
    }

    // Preserve the legacy status interpretation for records created before
    // attendance status was stored separately from the geofence status.
    await queryRunner.query(
      `UPDATE `attendance_records`
       SET `attendance_status` = CASE
         WHEN `status` = 'Absent' OR `status` IS NULL THEN 'Absent'
         ELSE 'Present'
       END
       WHERE `attendance_status` IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner)) {
      await queryRunner.query(
        'ALTER TABLE `attendance_records` DROP COLUMN `attendance_status`',
      );
    }
  }

  private async columnExists(queryRunner: QueryRunner): Promise<boolean> {
    const columns: unknown[] = await queryRunner.query(
      'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
      ['attendance_records', 'attendance_status'],
    );
    return columns.length > 0;
  }
}
