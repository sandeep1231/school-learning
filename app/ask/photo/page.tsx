import { getUserContext } from "@/lib/auth/context";
import { formatBoardClassLabel } from "@/lib/curriculum/boards";
import SnapClient from "./SnapClient";

export const dynamic = "force-dynamic";

/**
 * Snap-a-question entry point.
 *
 * Reads the student's board/class context server-side so the snap API
 * scopes RAG to the right textbooks. The rest of the flow is in
 * SnapClient (camera/file picker, upload, result rendering).
 */
export default async function SnapPhotoPage() {
  const ctx = await getUserContext();
  const contextLabel = formatBoardClassLabel(ctx.boardCode, ctx.classLevel);
  return <SnapClient contextLabel={contextLabel} />;
}
