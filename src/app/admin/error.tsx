"use client";

import { ErrorView } from "@/components/common/error-view";

export default function AreaError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
