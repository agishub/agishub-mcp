/**
 * Assembles the time operations: each is a { schema, handler } pair, keyed by
 * its short name. The Service Registry namespaces these as `time.<name>`.
 * Phase 3: Consolidated timezone namespace to 'time' with renamed operations.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  now: defineOperation(S.nowIn, H.nowIn),
  convert: defineOperation(S.convertTimezone, H.convertTimezone), // Supports both single & batch
  offset: defineOperation(S.tzOffset, H.tzOffset),
  timezones: defineOperation(S.listTimezones, H.listTimezones), // Unified timezone search
  calculate: defineOperation(S.dateMath, H.dateMath),
  meeting_slots: defineOperation(S.findMeetingSlots, H.findMeetingSlots),
  holiday: defineOperation(S.isHoliday, H.isHoliday),
};
