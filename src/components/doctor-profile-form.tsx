'use client';

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { toast } from 'sonner';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { showFriendlyError } from '@/lib/error-messages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { Camera, Loader2, Radio, Stethoscope, AtSign, Mail, Clock, CalendarDays } from 'lucide-react';
import type { DoctorRecord } from '@/lib/get-doctors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
}

export function DoctorProfileForm({ initial }: { initial: DoctorRecord }) {
  const [doctor, setDoctor] = useState(initial);
  const [titleDraft, setTitleDraft] = useState(initial.title ?? 'Dr.');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `doctors/${initial.id}`),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setDoctor((prev) => ({
          ...prev,
          name: data.name,
          specialty: data.specialty,
          workingDays: data.workingDays ?? [],
          startTime: data.startTime,
          endTime: data.endTime,
          slotMinutes: data.slotMinutes,
          username: data.username ?? null,
          loginEmail: data.loginEmail ?? null,
          photoUrl: data.photoUrl ?? null,
          title: data.title ?? null,
        }));
      },
      (error) => showFriendlyError(error, 'live profile sync')
    );
    return () => unsub();
  }, [initial.id]);

  // Keep the title input in sync with live updates (e.g. if edited in
  // another tab), without clobbering what the person is mid-typing.
  // Computed during render (React's documented alternative to an
  // effect for "reset local state when an external value changes")
  // rather than via setState inside a useEffect.
  const [prevLiveTitle, setPrevLiveTitle] = useState(doctor.title);
  if (doctor.title !== prevLiveTitle) {
    setPrevLiveTitle(doctor.title);
    setTitleDraft(doctor.title ?? 'Dr.');
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      const { secure_url } = await uploadToCloudinary(file);
      await updateDoc(doc(db, `doctors/${initial.id}`), { photoUrl: secure_url });
      toast.success('Profile picture updated.');
    } catch (err) {
      showFriendlyError(err, 'upload profile photo');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toast.error('Title cannot be empty.');
      return;
    }
    setIsSavingTitle(true);
    try {
      await updateDoc(doc(db, `doctors/${initial.id}`), { title: trimmed });
      toast.success('Title updated.');
    } catch (err) {
      showFriendlyError(err, 'update doctor title');
    } finally {
      setIsSavingTitle(false);
    }
  }

  const avatarStyle = getAvatarStyle(doctor.id);
  const titleChanged = titleDraft.trim() !== (doctor.title ?? 'Dr.');

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-soft">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div className="relative shrink-0">
            {doctor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doctor.photoUrl}
                alt={doctor.name}
                className="h-24 w-24 rounded-2xl object-cover"
              />
            ) : (
              <span
                className={`flex h-24 w-24 items-center justify-center rounded-2xl text-2xl font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
              >
                {getInitials(doctor.name)}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
              aria-label="Change profile picture"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{doctor.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{doctor.specialty}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Edit Profile</CardTitle>
          <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse" style={{ color: 'var(--status-approved)' }} />
            Live
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Professional Title</label>
            <div className="flex gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="e.g. Dr."
                maxLength={20}
                className="rounded-xl"
              />
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={!titleChanged || isSavingTitle}
                onClick={handleSaveTitle}
              >
                {isSavingTitle ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored separately from your name — used wherever the dashboard needs your title on its own.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              Specialty
            </span>
            <span className="font-medium">{doctor.specialty}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Working Days
            </span>
            <span className="font-medium">{formatDays(doctor.workingDays) || '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Hours
            </span>
            <span className="font-medium">
              {doctor.startTime && doctor.endTime
                ? `${to12Hour(doctor.startTime)} – ${to12Hour(doctor.endTime)}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <AtSign className="h-4 w-4" />
              Username
            </span>
            <span className="font-medium">{doctor.username ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email
            </span>
            <span className="font-medium">{doctor.loginEmail ?? '—'}</span>
          </div>
          <p className="pt-3 text-xs text-muted-foreground">
            These details are managed by your clinic administrator. Contact them if anything
            here needs to change.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}