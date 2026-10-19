import { ListSkeleton } from '@/components/list-skeleton';

export default function PatientsLoading() {
  return <ListSkeleton variant="cards" rows={6} />;
}
