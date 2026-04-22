// ============================================================
// WeCreator V3.7 埋点事件常量（PRD §10）
// 前后端共用，单一事实来源。
// ============================================================

export const ANALYTICS_EVENTS = {
  MILESTONE_CREATE:    'milestone_create',
  MILESTONE_COMPLETE:  'milestone_complete',
  CHECKPOINT_CREATE:   'checkpoint_create',
  CHECKPOINT_SUBMIT:   'checkpoint_submit',
  CHECKPOINT_REVIEW:   'checkpoint_review',
  TASK_COMMENT_POST:   'task_comment_post',
  ISSUE_REPORT:        'issue_report',
  ISSUE_RESOLVE:       'issue_resolve',
  NOTIFICATION_CLICK:  'notification_click',
  PROJECT_BOARD_VIEW:  'project_board_view',
  RISK_LEVEL_CHANGE:   'risk_level_change',
} as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

/** 事件 actor 类型 */
export type AnalyticsActorType = 'company_user' | 'worker' | 'system';

/** 上报 payload（前端 → POST /analytics/events） */
export interface AnalyticsEventPayload {
  event:    AnalyticsEventName;
  refType?: string;       // e.g. 'task' / 'project' / 'milestone' / 'notification'
  refId?:   number;
  props?:   Record<string, unknown>;  // 自由扩展字段
}
