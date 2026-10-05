import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorPatients } from '@/lib/get-doctor-patients';
import { getDoctorAppointments } from '@/lib/get-doctor-appointments';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import {
  DoctorPatientsBrowser,
  type PatientCardData,
} from '@/components/doctor-patients-browser';
import {
  formatClinicDate,
  formatDateKey,
  getPregnancyInfo,
  todayInClinic,
} from '@/lib/pregnancy-display';
import { Users } from 'lucide-react';

// "9:30 AM" -> minutes since midnight, so two appointments on the same
// day can be ordered.
function timeToMinutes(time: string): number {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  const hour = (parseInt(m[1], 10) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + parseInt(m[2], 10);
}

export default async function DoctorPatientsPage() {
  const session = await getDoctorSession();
  if (!session) return null;

  const [patients, appointments] = await Promise.all([
    getDoctorPatients(session.doctorName),
    getDoctorAppointments(session.doctorName),
  ]);

  const today = todayInClinic();
  const nextByPatient = new Map<string, (typeof appointments)[number]>();
  const pendingByPatient = new Map<string, number>();

  for (const a of appointments) {
    // Only appointments that are still ahead and haven't been declined.
    if (a.status !== 'upcoming' || a.date < today || a.doctorApproval === 'rejected') continue;

    const current = nextByPatient.get(a.patientUid);
    if (
      !current ||
      a.date < current.date ||
      (a.date === current.date && timeToMinutes(a.time) < timeToMinutes(current.time))
    ) {
      nextByPatient.set(a.patientUid, a);
    }
    if (a.doctorApproval === 'pending') {
      pendingByPatient.set(a.patientUid, (pendingByPatient.get(a.patientUid) ?? 0) + 1);
    }
  }

  const cards: PatientCardData[] = patients.map((p) => {
    const { week, trimester, progress } = getPregnancyInfo(p.dueDate);
    const next = nextByPatient.get(p.uid);
    return {
      uid: p.uid,
      fullName: p.fullName,
      email: p.email,
      week,
      trimester,
      progress,
      dueLabel: p.dueDate ? formatClinicDate(p.dueDate) : null,
      dueSortKey: p.dueDate,
      photoCount: p.photoCount,
      lastUploadLabel: p.lastUploadAt
        ? formatClinicDate(p.lastUploadAt, { month: 'short', day: 'numeric' })
        : null,
      lastUploadAt: p.lastUploadAt,
      nextAppointment: next
        ? { label: next.label, dateLabel: formatDateKey(next.date), time: next.time }
        : null,
      pendingCount: pendingByPatient.get(p.uid) ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Patients"
        description={`${cards.length} patient${cards.length === 1 ? '' : 's'} assigned to you`}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No patients yet"
          description="Patients appear here once they have an appointment booked with you."
        />
      ) : (
        <DoctorPatientsBrowser patients={cards} />
      )}
    </div>
  );
}