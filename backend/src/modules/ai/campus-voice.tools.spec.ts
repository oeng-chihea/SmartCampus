import { USER_ROLES } from '../../common/constants/roles.constant';
import { buildCampusVoiceInstruction } from './campus-voice.instruction';
import { buildCampusVoiceTools, pagesForRole } from './campus-voice.tools';

describe('campus voice tools', () => {
  it('lets admins navigate to Students and toggle login', () => {
    const tools = buildCampusVoiceTools(USER_ROLES.admin);
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      'navigate_campus',
      'control_page_view',
      'select_row',
      'act_on_row',
      'confirm_pending_voice_action',
      'stop_voice_conversation',
    ]);

    const navigate = tools.find((tool) => tool.name === 'navigate_campus');
    expect(navigate?.parametersJsonSchema.properties['page']).toEqual(
      expect.objectContaining({
        enum: pagesForRole(USER_ROLES.admin),
      }),
    );
    expect(pagesForRole(USER_ROLES.admin)).toContain('students');

    const act = tools.find((tool) => tool.name === 'act_on_row');
    expect(act?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: expect.arrayContaining(['toggle_login', 'open_add_student']),
      }),
    );
  });

  it('hides Students tools from teachers', () => {
    const tools = buildCampusVoiceTools(USER_ROLES.teacher);
    const navigate = tools.find((tool) => tool.name === 'navigate_campus');
    expect(pagesForRole(USER_ROLES.teacher)).not.toContain('students');
    expect(pagesForRole(USER_ROLES.teacher)).not.toContain('reports');
    expect(navigate?.parametersJsonSchema.properties['page']).toEqual(
      expect.objectContaining({
        enum: pagesForRole(USER_ROLES.teacher),
      }),
    );

    const act = tools.find((tool) => tool.name === 'act_on_row');
    expect(act?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: ['show_qr', 'edit', 'close', 'delete'],
      }),
    );
  });
});

describe('campus voice instruction', () => {
  it('is English-only for both staff roles', () => {
    const admin = buildCampusVoiceInstruction(USER_ROLES.admin);
    const teacher = buildCampusVoiceInstruction(USER_ROLES.teacher);
    expect(admin).toContain('Speak English only');
    expect(teacher).toContain('Speak English only');
    expect(admin).not.toMatch(/[\u1780-\u17FF]/);
    expect(teacher).not.toMatch(/[\u1780-\u17FF]/);
    expect(admin).toContain('including Students and Reports');
    expect(teacher).toContain('cannot open Students or Reports');
    expect(teacher).toContain('Export on Attendance or Locations');
  });
});
