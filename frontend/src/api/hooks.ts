// Central react-query hooks for all server data.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api/client";
import { localDateString, localISOString } from "@/src/lib/datetime";

export type Profile = {
  name: string | null;
  weight: number | null;
  activity_level: string | null;
  wake_time: string;
  sleep_time: string;
  preferred_unit: "ml" | "l";
  target_mode: "auto" | "custom";
  daily_target: number;
  onboarded: boolean;
  quick_presets: { amount_ml: number; icon: string }[];
};

export type Intake = {
  id: string;
  amount_ml: number;
  local_date: string;
  consumed_at: string | null;
  note: string | null;
};

export type DaySummary = {
  date: string;
  total: number;
  target: number;
  remaining: number;
  progress: number;
  unit: "ml" | "l";
  records: Intake[];
};

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => api("/profile"),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Profile>) => api("/profile", { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["day"] });
      qc.invalidateQueries({ queryKey: ["weekly"] });
      qc.invalidateQueries({ queryKey: ["monthly"] });
    },
  });
}

export function useCalculateTarget() {
  return useMutation({
    mutationFn: (body: { weight?: number; activity_level?: string }) =>
      api("/profile/calculate-target", { method: "POST", body }),
  });
}

export function useDay(date: string) {
  return useQuery<DaySummary>({
    queryKey: ["day", date],
    queryFn: () => api(`/day?date=${date}`),
  });
}

export function useAddIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { amount_ml: number; note?: string }) => {
      const now = new Date();
      return api("/intakes", {
        method: "POST",
        body: {
          amount_ml: args.amount_ml,
          local_date: localDateString(now),
          consumed_at: localISOString(now),
          note: args.note || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["day"] });
      qc.invalidateQueries({ queryKey: ["weekly"] });
      qc.invalidateQueries({ queryKey: ["monthly"] });
    },
  });
}

export function useUpdateIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; amount_ml?: number; note?: string }) =>
      api(`/intakes/${args.id}`, {
        method: "PUT",
        body: { amount_ml: args.amount_ml, note: args.note },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["day"] });
      qc.invalidateQueries({ queryKey: ["weekly"] });
      qc.invalidateQueries({ queryKey: ["monthly"] });
    },
  });
}

export function useDeleteIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/intakes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["day"] });
      qc.invalidateQueries({ queryKey: ["weekly"] });
      qc.invalidateQueries({ queryKey: ["monthly"] });
    },
  });
}

export function useWeekly(endDate: string) {
  return useQuery({
    queryKey: ["weekly", endDate],
    queryFn: () => api(`/reports/weekly?end_date=${endDate}`),
  });
}

export function useMonthly(month: string) {
  return useQuery({
    queryKey: ["monthly", month],
    queryFn: () => api(`/reports/monthly?month=${month}`),
  });
}

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => api("/reminders"),
  });
}

export function useUpdateReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api("/reminders", { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });
}
