import { getAppointments, AdminAppointment } from '@/lib/get-appointments';

export interface AppointmentStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  byType: { type: string; count: number }[];
  byDoctor: { doctor: string; count: number }[];
  trend: { date: string; count: number }[];
}

export async function getAppointmentStats(): Promise<{
  appointments: AdminAppointment[];
  stats: AppointmentStats;
}> {
  const appointments = await getAppointments();

  const upcoming = appointments.filter((a) => a.status === 'upcoming').length;
  const completed = appointments.filter((a) => a.status === 'completed').length;
  const cancelled = appointments.filter((a) => a.status === 'cancelled').length;

  const typeCounts = new Map<string, number>();
  const doctorCounts = new Map<string, number>();
  for (const a of appointments) {
    if (a.type) typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1);
    if (a.doctor) doctorCounts.set(a.doctor, (doctorCounts.get(a.doctor) ?? 0) + 1);
  }

  const byType = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const byDoctor = Array.from(doctorCounts.entries())
    .map(([doctor, count]) => ({ doctor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Trend: real appointment volume by scheduled date, last 14 days.
  const trendMap = new Map<string, number>();
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of appointments) {
    if (trendMap.has(a.date)) {
      trendMap.set(a.date, (trendMap.get(a.date) ?? 0) + 1);
    }
  }
  const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  return {
    appointments,
    stats: { total: appointments.length, upcoming, completed, cancelled, byType, byDoctor, trend },
  };
}