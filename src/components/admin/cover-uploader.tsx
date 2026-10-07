"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { setCourseCover } from "@/server/actions/courses";
import { ActionButton } from "@/components/common/action-button";
import { CourseCover } from "@/components/learning/course-card";
import { safeFileName } from "@/lib/upload";
import { FileUploader } from "./file-uploader";

export function CoverUploader({ courseId, coverPath, title }: { courseId: string; coverPath: string | null; title: string }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <CourseCover path={coverPath} title={title} className="aspect-[16/7] overflow-hidden rounded-md border border-line" />
      <FileUploader
        bucket="course-covers"
        accept="image/jpeg, image/png, image/webp"
        maxBytes={5 * 1024 * 1024}
        buildPath={(file) => `${courseId}/${safeFileName(file.name)}`}
        onUploaded={async (path) => {
          const res = await setCourseCover(courseId, path);
          router.refresh();
          return res;
        }}
        label="Image de couverture"
        hint="JPG, PNG ou WebP, 5 Mo maximum. Format conseillé : 1600 × 700 px. Évitez les photographies génériques."
      />
      {coverPath ? (
        <ActionButton variant="danger-ghost" action={setCourseCover.bind(null, courseId, null)}>
          <Trash2 aria-hidden /> Retirer l’image
        </ActionButton>
      ) : null}
    </div>
  );
}
