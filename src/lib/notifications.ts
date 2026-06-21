import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

interface NotificationPayload {
  toUid: string;
  fromUid: string;
  fromName: string;
  fromPhotoURL: string;
  type: "like" | "comment" | "follow";
  postId?: string;
  postThumbnail?: string;
  commentText?: string;
}

export async function sendNotification(payload: NotificationPayload) {
  if (payload.toUid === payload.fromUid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      toUid: payload.toUid,
      fromUid: payload.fromUid,
      fromName: payload.fromName,
      fromPhotoURL: payload.fromPhotoURL || "",
      type: payload.type,
      postId: payload.postId ?? null,
      postThumbnail: payload.postThumbnail ?? null,
      commentText: payload.commentText ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Notification failures are non-critical; swallow silently
  }
}
