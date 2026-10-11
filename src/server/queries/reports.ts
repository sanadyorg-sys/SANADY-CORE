import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface WeeklyPoint {
  week: string;
  active_teachers: number;
  completions: number;
  certificates?: number;
}

export interface AdminReport {
  from: string;
  to: string;
  kpis: {
    teachers: number;
    new_teachers: number;
    active_teachers: number;
    institutions: number;
    published_courses: number;
    active_enrollments: number;
    completions: number;
    completion_rate: number | null;
    attempts: number;
    average_score: number | null;
    pass_rate: number | null;
    certificates: number;
  };
  weekly: WeeklyPoint[];
  courses: Array<{
    id: string;
    title: string;
    status: string;
    enrolled: number;
    started: number;
    completed: number;
    completion_rate: number | null;
    active_in_period: number;
    average_score: number | null;
    certificates: number;
  }>;
  institutions: Array<{
    id: string;
    name: string;
    city: string | null;
    teachers: number;
    assignments: number;
    completed: number;
    completion_rate: number | null;
    active_in_period: number;
    certificates: number;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    course_title: string;
    module_position: number;
    learners: number;
    attempts: number;
    average_score: number | null;
    pass_rate: number | null;
    first_attempt_pass_rate: number | null;
  }>;
}

export interface InstitutionReport {
  from: string;
  to: string;
  kpis: {
    teachers: number;
    assignments: number;
    completed: number;
    completion_rate: number | null;
    active_teachers: number;
    completions: number;
    attempts: number;
    average_score: number | null;
    pass_rate: number | null;
    certificates: number;
  };
  weekly: WeeklyPoint[];
  courses: Array<{
    id: string;
    title: string;
    assigned: number;
    started: number;
    completed: number;
    completion_rate: number | null;
    average_score: number | null;
    certificates: number;
  }>;
}

export async function getAdminReport(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as AdminReport;
}

export async function getInstitutionReport(institutionId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("institution_report", { p_institution: institutionId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as InstitutionReport;
}
