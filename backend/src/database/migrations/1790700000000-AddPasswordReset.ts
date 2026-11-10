import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordReset1790700000000 implements MigrationInterface {
  name = 'AddPasswordReset1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `password_changed_at` datetime(3) NULL',
      );
    }

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(64) NOT NULL,
        \`token_hash\` char(64) NOT NULL,
        \`expires_at\` datetime(3) NOT NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_password_reset_tokens_hash\` (\`token_hash\`),
        INDEX \`IDX_password_reset_tokens_user\` (\`user_id\`)
      ) ENGINE=InnoDB`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `password_reset_tokens`');

    if (await this.columnExists(queryRunner)) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `password_changed_at`',
      );
    }
  }

  private async columnExists(queryRunner: QueryRunner): Promise<boolean> {
    const columns: unknown[] = await queryRunner.query(
      'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
      ['users', 'password_changed_at'],
    );
    return columns.length > 0;
  }
}
