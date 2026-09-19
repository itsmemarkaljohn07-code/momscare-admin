'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import {
  LayoutDashboard, Users, Camera, CalendarDays, UserCircle, type LucideIcon,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { getInitials } from '@/lib/avatar-color';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ title: 'Overview', url: '/doctor', icon: LayoutDashboard }],
  },
  {
    label: 'Patient Care',
    items: [
      { title: 'My Patients', url: '/doctor/patients', icon: Users },
      { title: 'Snapshots', url: '/doctor/snapshots', icon: Camera },
      { title: 'My Appointments', url: '/doctor/appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Account',
    items: [{ title: 'My Profile', url: '/doctor/profile', icon: UserCircle }],
  },
];

export function DoctorSidebar({
  doctorId,
  doctorName,
  pendingCount,
}: {
  doctorId: string;
  doctorName: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState({ name: doctorName, photoUrl: null as string | null });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `doctors/${doctorId}`), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setIdentity({
        name: data.name ?? doctorName,
        photoUrl: data.photoUrl ?? null,
      });
    });
    return () => unsub();
  }, [doctorId, doctorName]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        <Link href="/doctor/profile" className="flex items-center gap-2.5">
          {identity.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.photoUrl}
              alt={identity.name}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}
            >
              {getInitials(identity.name)}
            </div>
          )}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">
              {identity.name}
            </p>
            <p className="truncate text-[0.7rem] text-sidebar-foreground/50">Healthcare Provider</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.url === '/doctor' ? pathname === '/doctor' : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.url} />}
                        className="group relative h-9 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary"
                      >
                        <span
                          className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-data-[active=true]:opacity-100"
                          aria-hidden="true"
                        />
                        <item.icon className="h-[17px] w-[17px]" />
                        <span>{item.title}</span>
                        {item.url === '/doctor/appointments' && pendingCount > 0 && (
                          <span
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold group-data-[collapsible=icon]:hidden"
                            style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}
                          >
                            {pendingCount}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}