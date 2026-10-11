import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CourseLevel, LessonKind, UUID } from "@/lib/types";

export interface CatalogCourse {
  id: UUID;
  title: string;
  summary: string;
  level: CourseLevel;
  estimated_minutes: number | null;
  cover_path: string | null;
  published_at: string | null;
  category_id: UUID | null;
  category: string | null;
  module_count: number;
  lesson_count: number;
  video_count: number;
  quiz_count: number;
}

export interface Catalog {
  courses: CatalogCourse[];
  categories: Array<{ id: UUID; name: string; count: number }>;
  stats: { courses: number; minutes: number; certificates: number; institutions: number };
}

export interface PublicCourse {
  id: UUID;
  title: string;
  summary: string;
  description: string;
  objectives: string[];
  target_audience: string;
  level: CourseLevel;
  estimated_minutes: number | null;
  cover_path: string | null;
  published_at: string | null;
  updated_at: string;
  category: string | null;
  /** Trainers in charge of the course (name and job title only). */
  trainers?: Array<{ name: string | null; job_title: string | null }>;
  modules: Array<{
    id: UUID;
    title: string;
    description: string;
    lessons: Array<{
      title: string;
      kind: LessonKind;
      is_mandatory: boolean;
      estimated_minutes: number | null;
      video_duration_seconds: number | null;
      pdf_page_count: number | null;
    }>;
    quiz: { title: string; pass_threshold: number; max_attempts: number; question_count: number } | null;
  }>;
}

const EMPTY: Catalog = { courses: [], categories: [], stats: { courses: 0, minutes: 0, certificates: 0, institutions: 0 } };

/** Courses a SANADY administrator listed publicly (works signed in or not). */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_catalog");
  if (error || !data) return EMPTY;
  return data as Catalog;
});

export const getPublicCourse = cache(async (id: string): Promise<PublicCourse | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_course", { p_course: id });
  if (error || !data) return null;
  return data as PublicCourse;
});
