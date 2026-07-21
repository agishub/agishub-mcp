/**
 * Assembles the timezone operations: each is a { schema, handler } pair, keyed by
 * its short name. The Service Registry namespaces these as `timezone.<name>`.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  now_in: defineOperation(S.nowIn, H.nowIn),
  convert_timezone: defineOperation(S.convertTimezone, H.convertTimezone),
  convert_batch: defineOperation(S.convertBatch, H.convertBatch),
  tz_offset: defineOperation(S.tzOffset, H.tzOffset),
  list_timezones: defineOperation(S.listTimezones, H.listTimezones),
  lookup_timezone: defineOperation(S.lookupTimezone, H.lookupTimezone),
  date_math: defineOperation(S.dateMath, H.dateMath),
  find_meeting_slots: defineOperation(S.findMeetingSlots, H.findMeetingSlots),
  is_holiday: defineOperation(S.isHoliday, H.isHoliday),
};
