import { USER_ROLES, UserRole } from '../../common/constants/roles.constant';

export type CampusVoicePage =
  | 'dashboard'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'students'
  | 'reports';

export interface CampusVoiceFunctionDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: {
    type: 'object';
    additionalProperties: false;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const ADMIN_PAGES: CampusVoicePage[] = [
  'dashboard',
  'attendance',
  'locations',
  'sessions',
  'students',
  'reports',
];

const TEACHER_PAGES: CampusVoicePage[] = [
  'dashboard',
  'attendance',
  'locations',
  'sessions',
];

export function pagesForRole(role: UserRole): CampusVoicePage[] {
  return role === USER_ROLES.admin ? ADMIN_PAGES : TEACHER_PAGES;
}

function pageListLabel(pages: CampusVoicePage[]): string {
  const labels: Record<CampusVoicePage, string> = {
    dashboard: 'Dashboard',
    attendance: 'Attendance',
    locations: 'Locations',
    sessions: 'Sessions',
    students: 'Students',
    reports: 'Reports',
  };
  const named = pages.map((page) => labels[page]);
  if (named.length <= 1) {
    return named[0] ?? '';
  }
  return `${named.slice(0, -1).join(', ')}, or ${named[named.length - 1]}`;
}

function navigateTool(pages: CampusVoicePage[]): CampusVoiceFunctionDeclaration {
  return {
    name: 'navigate_campus',
    description: `Open a Smart Campus admin page. Use this for go to, open, show, or take me to ${pageListLabel(pages)}. Do not treat navigation as search.`,
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        page: {
          type: 'string',
          description: 'The page to open.',
          enum: pages,
        },
      },
      required: ['page'],
    },
  };
}

function controlPageViewTool(): CampusVoiceFunctionDeclaration {
  return {
    name: 'control_page_view',
    description:
      'Control the current campus page. Use refresh to reload. Use search only when the user explicitly wants to find or search. Use clear_search to reset search. Use export for Excel download. Use open_create to open the create-session or add-student form. Use status to read counts on the current page. Use filter to set attendance, location, or date filters.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          description: 'The page action to run.',
          enum: [
            'refresh',
            'search',
            'clear_search',
            'export',
            'open_create',
            'status',
            'filter',
          ],
        },
        query: {
          type: 'string',
          description:
            'Spoken student name, student ID, session title, or location text when searching.',
        },
        status_filter: {
          type: 'string',
          description:
            'Optional status filter. Attendance location: inside, outside, all. Attendance check-in: Present, Absent. Location visits: Present, Outside Location. Sessions: Open, Closed.',
        },
        attendance_status: {
          type: 'string',
          description:
            'Attendance check-in filter when the user says present or absent.',
          enum: ['all', 'Present', 'Absent'],
        },
        date_filter: {
          type: 'string',
          description:
            'Attendance date filter when the user says today, yesterday, this week, or all dates.',
          enum: ['all', 'today', 'yesterday', 'week'],
        },
        building: {
          type: 'string',
          description:
            'Locations building filter, or All buildings to clear it.',
        },
      },
      required: ['action'],
    },
  };
}

function selectRowTool(): CampusVoiceFunctionDeclaration {
  return {
    name: 'select_row',
    description:
      'Select one visible row on the current page before acting on it. Accept student name, student ID, session title, session id, or a visible position like first, second, or last. If only one row matches, select it immediately. If several match, ask first or second.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        row_id: {
          type: 'string',
          description: 'Direct row id when already known.',
        },
        query: {
          type: 'string',
          description:
            'Spoken student name, student ID, session title, or other visible label.',
        },
        position: {
          type: 'integer',
          description:
            '1-based visible position such as first session or second result.',
          minimum: 1,
          maximum: 20,
        },
        last_position: {
          type: 'boolean',
          description: 'Set true when the user says last one or last row.',
        },
      },
    },
  };
}

function actOnRowTool(
  includeStudentActions: boolean,
): CampusVoiceFunctionDeclaration {
  const actions = includeStudentActions
    ? [
        'show_qr',
        'edit',
        'close',
        'delete',
        'toggle_login',
        'open_add_student',
      ]
    : ['show_qr', 'edit', 'close', 'delete'];

  return {
    name: 'act_on_row',
    description:
      'Run one row action after a row is selected or clearly referenced. show_qr opens the live session QR. edit opens the session edit form. close closes an open session. delete removes a session. toggle_login enables or disables a student login (admin only). open_add_student opens the add-student form (admin only). Show QR, edit, and open create should run immediately. Close session, delete session, and disable login need confirmation first.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          description: 'The row action to run.',
          enum: actions,
        },
        row_id: {
          type: 'string',
          description: 'Direct row id when already known.',
        },
        query: {
          type: 'string',
          description:
            'Spoken student name, student ID, session title, or other visible label.',
        },
        position: {
          type: 'integer',
          description: 'Optional 1-based visible position.',
          minimum: 1,
          maximum: 20,
        },
        last_position: {
          type: 'boolean',
          description: 'Set true when the user says last one.',
        },
      },
      required: ['action'],
    },
  };
}

function confirmPendingTool(): CampusVoiceFunctionDeclaration {
  return {
    name: 'confirm_pending_voice_action',
    description:
      'Confirm or cancel the currently pending destructive voice action such as closing a session, deleting a session, or disabling student login. Also use this when a confirmation popup is visible and the user says yes, ok, confirm, no, or cancel.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirm: {
          type: 'boolean',
          description:
            'Set true for yes, ok, confirm, or proceed. Set false for no, cancel, or stop.',
        },
        decision: {
          type: 'string',
          description:
            'Optional raw spoken yes or no when confirm is not provided.',
        },
      },
    },
  };
}

function stopVoiceTool(): CampusVoiceFunctionDeclaration {
  return {
    name: 'stop_voice_conversation',
    description:
      'End the live English voice conversation when the user clearly asks to stop, end, close, or exit the voice assistant.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  };
}

export function buildCampusVoiceTools(
  role: UserRole,
): CampusVoiceFunctionDeclaration[] {
  const pages = pagesForRole(role);
  const includeStudentActions = role === USER_ROLES.admin;
  return [
    navigateTool(pages),
    controlPageViewTool(),
    selectRowTool(),
    actOnRowTool(includeStudentActions),
    confirmPendingTool(),
    stopVoiceTool(),
  ];
}
