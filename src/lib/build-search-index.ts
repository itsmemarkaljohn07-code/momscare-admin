import { getUsers } from '@/lib/get-users';
import { getDoctors } from '@/lib/get-doctors';
import { getAdmins } from '@/lib/get-admins';
import { getAppointmentStats } from '@/lib/get-appointment-stats';

export type SearchItemType = 'patient' | 'doctor' | 'admin' | 'appointment';

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string;
  url: string;
}

export async function buildSearchIndex(): Promise<SearchItem[]> {
  const [users, doctors, admins, { appointments }] = await Promise.all([
    getUsers(),
    getDoctors(),
    getAdmins(),
    getAppointmentStats(),
  ]);

  const items: SearchItem[] = [];

  for (const u of users) {
    items.push({
      id: u.uid,
      type: 'patient',
      title: u.fullName,
      subtitle: u.email || u.username || '',
      url: `/admin/users/${u.uid}`,
    });
  }

  for (const d of doctors) {
    items.push({
      id: d.id,
      type: 'doctor',
      title: d.name,
      subtitle: d.specialty,
      url: `/admin/doctors/${d.id}`,
    });
  }

  for (const a of admins) {
    items.push({
      id: a.uid,
      type: 'admin',
      title: a.email || '(no email on file)',
      subtitle: 'Admin',
      url: `/admin/admins/${a.uid}`,
    });
  }

  for (const appt of appointments) {
    items.push({
      id: `${appt.patientUid}/${appt.id}`,
      type: 'appointment',
      title: `${appt.label} — ${appt.patientName}`,
      subtitle: `${appt.doctor} · ${appt.date} ${appt.time}`,
      // No dedicated single-appointment page exists, so this links to
      // the patient's own page, where their appointments are visible.
      url: `/admin/users/${appt.patientUid}`,
    });
  }

  return items;
}

export function filterSearchIndex(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items.filter(
    (i) => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q)
  );
}