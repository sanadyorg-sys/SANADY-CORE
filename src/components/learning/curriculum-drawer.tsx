"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import type { OutlineModule } from "@/server/queries/learning";
import { Curriculum } from "./curriculum";

/** Curriculum in a drawer for tablet and mobile layouts. */
export function CurriculumDrawer(props: {
  courseId: string;
  modules: OutlineModule[];
  currentLessonId?: string;
  currentQuizId?: string;
  basePath?: string;
  summary?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title="Programme de la formation"
      trigger={
        <Button variant="secondary" size="sm" className="xl:hidden">
          <ListTree aria-hidden /> Programme
        </Button>
      }
    >
      <div className="space-y-4 p-4" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
        {props.summary}
        <Curriculum
          courseId={props.courseId}
          modules={props.modules}
          currentLessonId={props.currentLessonId}
          currentQuizId={props.currentQuizId}
          basePath={props.basePath}
        />
      </div>
    </Drawer>
  );
}
