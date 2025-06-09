import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Utility functions for Grumpy Tracker

/**
 * Determine the correct work time (normal or custom) for a given date, based on user's work periods.
 * @param {Date} date - The date of the time entry.
 * @param {object} settings - The user's settings object from DB.
 * @param {string} userId - The user's id.
 * @returns {Promise<number>} - Work time in minutes for the given date.
 */
export async function getWorkTimeForDate(date, settings, userId) {
  if (!settings) return 480;
  const normal = settings.normal_work_time || 480;
  if (!userId) return normal;
  const periods = await prisma.workPeriod.findMany({
    where: {
      user_id: userId,
      start: { lte: date },
      end: { gte: date },
    },
    // Use most recent matching period in case of overlaps
    orderBy: { start: 'desc' },
  });
  if (periods.length > 0) {
    return periods[0].work_time_minutes;
  }
  return normal;
}
