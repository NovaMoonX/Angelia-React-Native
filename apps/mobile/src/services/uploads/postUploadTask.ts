import * as TaskManager from 'expo-task-manager';

export const POST_UPLOAD_RESUME_TASK = 'angelia.post-upload-resume';

let resumeHandler: (() => Promise<void>) | null = null;
let didDefineTask = false;

export function setPostUploadResumeHandler(handler: (() => Promise<void>) | null): void {
  resumeHandler = handler;
}

export function ensurePostUploadTaskDefined(): void {
  if (didDefineTask) {
    return;
  }

  try {
    TaskManager.defineTask(POST_UPLOAD_RESUME_TASK, async () => {
      if (!resumeHandler) {
        return;
      }
      try {
        await resumeHandler();
      } catch {
        // Best-effort queue resume.
      }
    });
    didDefineTask = true;
  } catch {
    // defineTask can throw if Fast Refresh re-defines the same task.
    didDefineTask = true;
  }
}
