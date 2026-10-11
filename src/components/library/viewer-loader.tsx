"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";

/** Loads the PDF engine only when a document is displayed (client only). */
export const LibraryDocumentViewer = dynamic(() => import("./document-viewer"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[1/1.2] w-full rounded-lg" />,
});
