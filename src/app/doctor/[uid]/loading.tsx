import { ListSkeleton } from '@/components/list-skeleton';

export default function DoctorPatientLoading() {
  return <ListSkeleton variant="cards" rows={4} toolbar={false} />;
}
