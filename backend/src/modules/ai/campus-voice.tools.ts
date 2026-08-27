import { USER_ROLES, UserRole } from '../../common/constants/roles.constant';

export type CampusVoicePage =
  | 'dashboard'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'students'
  | 'scan';

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

const STAFF_PAGES: CampusVoicePage[] = [
  'dashboard',
  'attendance',
  'locations',
  'sessions',
  'students',
];

const STUDENT_PAGES: CampusVoicePage[] = ['scan'];

export function pagesForRole(role: UserRole): CampusVoicePage[] {
  return role === USER_ROLES.student ? STUDENT_PAGES : STAFF_PAGES;
}

function pageListLabel(pages: CampusVoicePage[]): string {
  const labels: Record<CampusVoicePage, string> = {
    dashboard: 'Dashboard',
    attendance: 'Attendance',
    locations: 'Locations',
    sessions: 'Sessions',
    students: 'Students',
    scan: 'Mark attendance',
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
    description: `Open a Smart Campus teacher page. Use this for go to, open, show, or take me to ${pageListLabel(pages)}. Do not treat navigation as search.`,
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

function readCampusRecordsTool(role: UserRole): CampusVoiceFunctionDeclaration {
  if (role === USER_ROLES.student) {
    return {
      name: 'read_campus_records',
      description:
        "Read this student's live open classes and their own attendance scans. Always tell which live classes are already recorded and which are not yet recorded. Call this when they ask about open sessions, due times, locations, radius, recorded versus not recorded classes, or their attendance history. Do not call this during the opening greeting. Do not read other students or teacher pages. Use scope sessions for live classes and attendance for their scans.",
      parametersJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scope: {
            type: 'string',
            description:
              'Which student records to read. Use all unless they name one area.',
            enum: ['all', 'attendance', 'sessions'],
          },
          query: {
            type: 'string',
            description:
              'Optional session title, location, or teacher name. Leave empty to read every personal record.',
          },
          session_id: {
            type: 'string',
            description: 'Optional session id when already known.',
          },
          session_query: {
            type: 'string',
            description: 'Optional session title when the student names a class.',
          },
        },
      },
    };
  }

  return {
    name: 'read_campus_records',
    description:
      'Read live campus knowledge: dashboard cards and recent scans, attendance names with present/absent, inside/outside, building, distance, and scanned-at place, location visits, campus zone catalog (building, room, radius), sessions (title, location, due, open/closed), and students (name, class, email, login). Call this whenever the user asks about campus data, a named student, session, building, distance, due time, dashboard, or a summary. Do not call this at session start or for navigation. Do not filter the on-screen table to answer. Pass query with the spoken name, student ID, session, or building. Pass filters only when the user asks to limit the data itself, for example present in one session or visits in Building A.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: {
          type: 'string',
          description:
            'Which records to read. Use all unless the user names one area.',
          enum: [
            'all',
            'dashboard',
            'attendance',
            'locations',
            'sessions',
            'students',
          ],
        },
        query: {
          type: 'string',
          description:
            'Optional student name, student ID, session title, building, or other search text. Leave empty to read every record.',
        },
        attendance_status: {
          type: 'string',
          description:
            'Optional attendance check-in filter. Leave empty or all to include present and absent.',
          enum: ['all', 'Present', 'Absent'],
        },
        location_status: {
          type: 'string',
          description:
            'Optional geofence filter. Leave empty or all to include inside and outside.',
          enum: ['all', 'inside', 'outside'],
        },
        date_filter: {
          type: 'string',
          description:
            'Optional attendance date filter. Leave empty or all for every date.',
          enum: ['all', 'today', 'yesterday', 'week'],
        },
        building: {
          type: 'string',
          description: 'Optional locations building name.',
        },
        session_id: {
          type: 'string',
          description: 'Optional session id when already known.',
        },
        session_query: {
          type: 'string',
          description: 'Optional session title when the user names a class.',
        },
      },
    },
  };
}

function controlPageViewTool(role: UserRole): CampusVoiceFunctionDeclaration {
  if (role === USER_ROLES.student) {
    return {
      name: 'control_page_view',
      description:
        'Control the student Mark attendance page. Use refresh to reload live classes. Use status to describe the open classes and My attendance currently on screen.',
      parametersJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            description: 'The page action to run.',
            enum: ['refresh', 'status'],
          },
        },
        required: ['action'],
      },
    };
  }

  return {
    name: 'control_page_view',
    description:
      'Control the current campus page. Use refresh to reload. Use search only when the user explicitly wants to find or search. Use clear_search to reset search. Use clear_filters to reset table filters to all records. Use export for Excel download. Use open_create to open the create-session or add-student form. Use status only for the rows currently visible on the page. Use filter only when the user explicitly asks to show, display, or filter the on-screen table.',
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
            'clear_filters',
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

function selectRowTool(role: UserRole): CampusVoiceFunctionDeclaration {
  return {
    name: 'select_row',
    description:
      role === USER_ROLES.student
        ? 'Select one live class on the scan page before marking present. Accept session title, session id, teacher name, or a visible position like first or last. If only one live class matches, select it immediately. If several match, ask first or second.'
        : 'Select one visible row on the current page before acting on it. Accept student name, student ID, session title, session id, or a visible position like first, second, or last. If only one row matches, select it immediately. If several match, ask first or second.',
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
            role === USER_ROLES.student
              ? 'Spoken session title, teacher name, or other visible label.'
              : 'Spoken student name, student ID, session title, or other visible label.',
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

function actOnRowTool(role: UserRole): CampusVoiceFunctionDeclaration {
  if (role === USER_ROLES.student) {
    return {
      name: 'act_on_row',
      description:
        'Record attendance for live classes. mark_present with all false or omitted marks one named class. mark_present with all true marks every live class that is not yet recorded and not past due — use this when they say mark all, mark them all, every class, all sessions, or the rest. Call this once. Do not call once per class. Skip already recorded and due-passed classes. Location permission is still required; if GPS is blocked the page will ask them to allow it.',
      parametersJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            description: 'The row action to run.',
            enum: ['mark_present'],
          },
          all: {
            type: 'boolean',
            description:
              'Set true to mark present for every eligible live class in one call. Use when they say mark all, every class, all sessions, all ten, or the rest. Leave false or omit when they name one class.',
          },
          row_id: {
            type: 'string',
            description: 'Direct session id when already known. Ignore when all is true.',
          },
          query: {
            type: 'string',
            description: 'Spoken session title or teacher name. Ignore when all is true.',
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

  return {
    name: 'act_on_row',
    description:
      'Run one row action after a row is selected or clearly referenced. show_qr opens the live session QR. edit opens the session edit form. close closes an open session. delete removes a session. toggle_login enables or disables a student login. open_add_student opens the add-student form. Show QR, edit, and open create should run immediately. Close session, delete session, and disable login need confirmation first.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          description: 'The row action to run.',
          enum: [
            'show_qr',
            'edit',
            'close',
            'delete',
            'toggle_login',
            'open_add_student',
          ],
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

function confirmPendingTool(role: UserRole): CampusVoiceFunctionDeclaration {
  return {
    name: 'confirm_pending_voice_action',
    description:
      role === USER_ROLES.student
        ? 'Confirm or cancel the currently visible student dialog, such as Try again for location, or close the due-time blocked dialog. Use this when they say yes, ok, try again, no, or cancel.'
        : 'Confirm or cancel the currently pending destructive voice action such as closing a session, deleting a session, or disabling student login. Also use this when a confirmation popup is visible and the user says yes, ok, confirm, no, or cancel.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirm: {
          type: 'boolean',
          description:
            'Set true for yes, ok, confirm, try again, or proceed. Set false for no, cancel, or stop.',
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
      'End the live English voice conversation when the user clearly asks to stop, end, close, terminate, or exit the voice assistant.',
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
  if (role === USER_ROLES.student) {
    return [
      readCampusRecordsTool(role),
      controlPageViewTool(role),
      selectRowTool(role),
      actOnRowTool(role),
      confirmPendingTool(role),
      stopVoiceTool(),
    ];
  }

  const pages = pagesForRole(role);
  return [
    navigateTool(pages),
    readCampusRecordsTool(role),
    controlPageViewTool(role),
    selectRowTool(role),
    actOnRowTool(role),
    confirmPendingTool(role),
    stopVoiceTool(),
  ];
}
