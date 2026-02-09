// plugins/date.ts
import dayjs from "dayjs"
import advancedFormat from "dayjs/plugin/advancedFormat"
import calendar from "dayjs/plugin/calendar"
import duration from "dayjs/plugin/duration"
import relativeTime from "dayjs/plugin/relativeTime"
import timezone from "dayjs/plugin/timezone"
import updateLocale from "dayjs/plugin/updateLocale"
import utc from "dayjs/plugin/utc"

// Import locales
import "dayjs/locale/en"

// Extend dayjs with plugins
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(calendar)
dayjs.extend(relativeTime)
dayjs.extend(duration)
dayjs.extend(updateLocale)
dayjs.extend(advancedFormat)

dayjs.locale("en")

export default dayjs;
