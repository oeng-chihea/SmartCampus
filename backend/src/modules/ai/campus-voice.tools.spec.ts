import { USER_ROLES } from '../../common/constants/roles.constant';
import { buildCampusVoiceInstruction } from './campus-voice.instruction';
import { buildCampusVoiceTools, pagesForRole } from './campus-voice.tools';

describe('campus voice tools', () => {
  it('lets teachers navigate to Students and toggle login', () => {
    const tools = buildCampusVoiceTools(USER_ROLES.teacher);
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      'navigate_campus',
      'read_campus_records',
      'control_page_view',
      'select_row',
      'act_on_row',
      'confirm_pending_voice_action',
      'stop_voice_conversation',
    ]);

    const navigate = tools.find((tool) => tool.name === 'navigate_campus');
    expect(navigate?.parametersJsonSchema.properties['page']).toEqual(
      expect.objectContaining({
        enum: pagesForRole(USER_ROLES.teacher),
      }),
    );
    expect(pagesForRole(USER_ROLES.teacher)).toContain('students');
    expect(pagesForRole(USER_ROLES.teacher)).not.toContain('reports');

    const act = tools.find((tool) => tool.name === 'act_on_row');
    expect(act?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: expect.arrayContaining(['toggle_login', 'open_add_student']),
      }),
    );
    expect(
      (act?.parametersJsonSchema.properties['action'] as { enum: string[] }).enum,
    ).toContain('show_qr');

    const readRecords = tools.find((tool) => tool.name === 'read_campus_records');
    expect(readRecords?.parametersJsonSchema.required).toBeUndefined();
    expect(
      (readRecords?.parametersJsonSchema.properties['scope'] as { enum: string[] })
        .enum,
    ).toEqual([
      'all',
      'dashboard',
      'attendance',
      'locations',
      'sessions',
      'students',
    ]);

    const control = tools.find((tool) => tool.name === 'control_page_view');
    expect(control?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: expect.arrayContaining(['status', 'filter', 'clear_filters']),
      }),
    );
  });

  it('gives students scan tools only, including mark present and stop', () => {
    const tools = buildCampusVoiceTools(USER_ROLES.student);
    expect(tools.map((tool) => tool.name)).toEqual([
      'read_campus_records',
      'control_page_view',
      'select_row',
      'act_on_row',
      'confirm_pending_voice_action',
      'stop_voice_conversation',
    ]);
    expect(pagesForRole(USER_ROLES.student)).toEqual(['scan']);

    const readRecords = tools.find((tool) => tool.name === 'read_campus_records');
    expect(readRecords?.description).toContain('already recorded');
    expect(readRecords?.description).toContain('not yet recorded');
    expect(
      (readRecords?.parametersJsonSchema.properties['scope'] as { enum: string[] })
        .enum,
    ).toEqual(['all', 'attendance', 'sessions']);

    const act = tools.find((tool) => tool.name === 'act_on_row');
    expect(act?.description).toContain('all true');
    expect(act?.parametersJsonSchema.properties['all']).toEqual(
      expect.objectContaining({ type: 'boolean' }),
    );
    expect(act?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: ['mark_present'],
      }),
    );

    const control = tools.find((tool) => tool.name === 'control_page_view');
    expect(control?.parametersJsonSchema.properties['action']).toEqual(
      expect.objectContaining({
        enum: ['refresh', 'status'],
      }),
    );
  });
});

describe('campus voice instruction', () => {
  it('is English-only for the teacher staff role', () => {
    const teacher = buildCampusVoiceInstruction(USER_ROLES.teacher);
    expect(teacher).toContain('Speak English only');
    expect(teacher).not.toMatch(/[\u1780-\u17FF]/);
    expect(teacher).toContain('including Students');
    expect(teacher).not.toContain('including Students and Reports');
    expect(teacher).toContain('There is no Reports page');
    expect(teacher).toContain('create student email and password accounts');
    expect(teacher).toContain('Call read_campus_records for any campus data question');
    expect(teacher).toContain('Do not call it at session start');
    expect(teacher).toContain('Do not call filter to answer data questions');
    expect(teacher).toContain('Product workflow');
    expect(teacher).toContain('show QR');
    expect(teacher).toContain('Read names, student IDs, buildings, rooms, distances');
    expect(teacher).toContain(
      'Do not speak, greet, or call tools until the user talks',
    );
    expect(teacher).not.toContain('using the campus counts');
    expect(
      buildCampusVoiceInstruction(USER_ROLES.teacher, 'students'),
    ).toContain('currently on the Students page');
  });

  it('greets students with time of day and keeps the campus loop for later turns', () => {
    const student = buildCampusVoiceInstruction(USER_ROLES.student, 'scan', {
      greetingPeriod: 'afternoon',
      studentName: 'Chihea',
    });
    expect(student).toContain('Speak English only');
    expect(student).toContain('Good afternoon');
    expect(student).toContain('Chihea');
    expect(student).toContain('do not wait for the student to speak first');
    expect(student).toContain('Opening greeting is one short line only');
    expect(student).toContain('Do not tutorial how to tap buttons');
    expect(student).toContain('full campus loop');
    expect(student).toContain('GPS is a hard gate');
    expect(student).toContain('Mark me present');
    expect(student).toContain('Outside Location');
    expect(student).toContain('Due passed');
    expect(student).toContain('already recorded');
    expect(student).toContain('not yet recorded');
    expect(student).toContain('mark them all');
    expect(student).toContain('all true');
    expect(student).toContain('Do not call the tool once per class');
    expect(student).toContain('stop_voice_conversation');
    expect(student).toContain('currently on the Mark attendance page');
    expect(student).not.toContain('scan the teacher QR');
    expect(student).not.toContain('two short warm sentences');
    expect(student).not.toContain(
      'Do not speak, greet, or call tools until the user talks',
    );
    expect(student).not.toContain('navigate_campus');
  });
});
