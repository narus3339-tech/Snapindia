import { useEffect, useRef, useState } from "react";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
  increment, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { sendNotification } from "@/lib/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string;
  text: string;
  createdAt: any;
}

interface CommentsSheetProps {
  postId: string;
  postAuthorUid: string;
  postThumbnail?: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}

export default function CommentsSheet({
  postId,
  postAuthorUid,
  postThumbnail,
  onClose,
  onCountChange,
}: CommentsSheetProps) {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Real-time comments listener
  useEffect(() => {
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) }))
      );
    });
    return unsub;
  }, [postId]);

  // Scroll to bottom on new comments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Focus input when sheet opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  async function handleSend() {
    if (!text.trim() || !currentUser) return;
    if (text.trim().length > 500) {
      toast.error("Comment too long (max 500 characters)");
      return;
    }
    const trimmed = text.trim();
    setText("");
    setLoading(true);
    try {
      await addDoc(collection(db, "posts", postId, "comments"), {
        authorUid: currentUser.uid,
        authorName: currentUser.displayName || "User",
        authorPhotoURL: currentUser.photoURL || "",
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      // Increment commentsCount on the post
      await updateDoc(doc(db, "posts", postId), {
        commentsCount: increment(1),
      });
      onCountChange(1);
      sendNotification({
        toUid: postAuthorUid,
        fromUid: currentUser.uid,
        fromName: currentUser.displayName || "Someone",
        fromPhotoURL: currentUser.photoURL || "",
        type: "comment",
        postId,
        postThumbnail: postThumbnail || "",
        commentText: trimmed,
      });
    } catch (err: any) {
      toast.error("Failed to post comment", { description: err.message });
      setText(trimmed);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(comment: Comment) {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "posts", postId, "comments", comment.id));
      await updateDoc(doc(db, "posts", postId), {
        commentsCount: increment(-1),
      });
      onCountChange(-1);
    } catch (err: any) {
      toast.error("Could not delete comment");
    }
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        data-testid="comments-backdrop"
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-2xl flex flex-col transition-transform duration-250 ease-out
          ${visible ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "80vh" }}
        data-testid="comments-sheet"
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
          <h3 className="font-semibold text-sm mx-auto">Comments</h3>
          <button
            onClick={handleClose}
            className="absolute right-4 top-3 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-comments-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <MessageCircle className="w-10 h-10 opacity-30" />
              <p className="text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5" data-testid={`comment-${comment.id}`}>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={comment.authorPhotoURL} />
                  <AvatarFallback className="text-xs">{comment.authorName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold leading-tight">{comment.authorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {comment.createdAt?.toDate
                        ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true })
                        : "Just now"}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 break-words leading-snug">{comment.text}</p>
                </div>
                {(currentUser?.uid === comment.authorUid ||
                  currentUser?.uid === postAuthorUid) && (
                  <button
                    onClick={() => handleDelete(comment)}
                    className="shrink-0 self-start mt-0.5 text-muted-foreground/50 hover:text-destructive transition-colors"
                    data-testid={`button-delete-comment-${comment.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-border/50 shrink-0 flex items-center gap-2 bg-card">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={currentUser?.photoURL || ""} />
            <AvatarFallback className="text-xs">{currentUser?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 flex items-center bg-muted rounded-full px-3.5 py-2 gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment…"
              maxLength={500}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              data-testid="input-comment"
            />
            <span className={`text-xs transition-colors shrink-0 ${text.length > 450 ? "text-orange-400" : "text-muted-foreground/40"}`}>
              {text.length > 400 ? `${500 - text.length}` : ""}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || loading}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 flex items-center justify-center text-white disabled:opacity-40 transition-opacity active:scale-90"
            data-testid="button-send-comment"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
