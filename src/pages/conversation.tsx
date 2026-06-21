import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { getRtdb } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ref, push, set, onValue, off, runTransaction,
  serverTimestamp as rtServerTimestamp,
} from "firebase/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, WifiOff } from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

function chatId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

function msgTimestamp(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export default function Conversation() {
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const [otherUser, setOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rtdb = getRtdb();
  const cid = currentUser && otherUid ? chatId(currentUser.uid, otherUid) : "";

  // Load other user's profile
  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, "users", otherUid)).then((snap) => {
      if (snap.exists()) setOtherUser(snap.data());
    });
  }, [otherUid]);

  // Real-time messages listener
  useEffect(() => {
    if (!rtdb || !cid) { setLoading(false); return; }
    const msgsRef = ref(rtdb, `chats/${cid}/messages`);
    const handler = onValue(msgsRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: Message[] = Object.entries(val).map(([id, m]: any) => ({
          id,
          ...m,
        }));
        list.sort((a, b) => a.createdAt - b.createdAt);
        setMessages(list);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });
    return () => off(msgsRef, "value", handler);
  }, [cid, rtdb]);

  // Mark current user's unread as 0 when conversation is open
  useEffect(() => {
    if (!rtdb || !cid || !currentUser) return;
    const unreadRef = ref(rtdb, `userChats/${currentUser.uid}/${cid}/unread`);
    set(unreadRef, 0).catch(() => {});
  }, [cid, rtdb, currentUser]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUser || !otherUid || !rtdb || !cid) return;
    if (trimmed.length > 1000) { toast.error("Message too long (max 1000 chars)"); return; }

    setText("");
    setSending(true);
    try {
      const msgsRef = ref(rtdb, `chats/${cid}/messages`);
      await push(msgsRef, {
        senderId: currentUser.uid,
        text: trimmed,
        createdAt: Date.now(),
      });

      const now = Date.now();
      const senderMeta = {
        otherUid,
        otherName: otherUser?.displayName || "User",
        otherPhotoURL: otherUser?.photoURL || "",
        lastMessage: trimmed,
        updatedAt: now,
        unread: 0,
      };
      const receiverMeta = {
        otherUid: currentUser.uid,
        otherName: currentUser.displayName || "User",
        otherPhotoURL: currentUser.photoURL || "",
        lastMessage: trimmed,
        updatedAt: now,
      };

      await set(ref(rtdb, `userChats/${currentUser.uid}/${cid}`), senderMeta);
      // Increment receiver unread atomically
      await runTransaction(
        ref(rtdb, `userChats/${otherUid}/${cid}/unread`),
        (cur) => (cur || 0) + 1
      );
      await set(ref(rtdb, `userChats/${otherUid}/${cid}`), {
        ...receiverMeta,
        unread: 1,
      });
    } catch (err: any) {
      toast.error("Failed to send", { description: err.message });
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach((m) => {
    const d = new Date(m.createdAt);
    const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMMM d, yyyy");
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) last.msgs.push(m);
    else grouped.push({ date: label, msgs: [m] });
  });

  if (!rtdb) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center pb-20">
        <WifiOff className="w-12 h-12 text-muted-foreground opacity-40" />
        <p className="font-semibold text-foreground">Realtime Database not configured</p>
        <p className="text-sm text-muted-foreground">
          Add <code className="text-orange-400">VITE_FIREBASE_DATABASE_URL</code> to your secrets to enable chat.
        </p>
        <button onClick={() => setLocation("/chat")} className="text-sm text-primary underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border/50 shrink-0 bg-card/80 backdrop-blur-md">
        <button onClick={() => setLocation("/chat")} className="text-foreground shrink-0">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <Avatar className="w-9 h-9 border border-border shrink-0">
          <AvatarImage src={otherUser?.photoURL} />
          <AvatarFallback className="text-sm">{otherUser?.displayName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{otherUser?.displayName || "…"}</p>
          <p className="text-xs text-muted-foreground">@{otherUser?.username || "user"}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 min-h-0">
        {loading ? (
          <div className="space-y-3 pt-4">
            {[1,2,3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-9 rounded-2xl ${i % 2 === 0 ? "w-40" : "w-52"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Avatar className="w-16 h-16 border-2 border-border">
              <AvatarImage src={otherUser?.photoURL} />
              <AvatarFallback className="text-xl">{otherUser?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="font-semibold text-foreground">{otherUser?.displayName}</p>
            <p className="text-sm">Say hi! Start the conversation 👋</p>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground px-2">{date}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              {msgs.map((msg, idx) => {
                const isMine = msg.senderId === currentUser?.uid;
                const isFirst = idx === 0 || msgs[idx - 1].senderId !== msg.senderId;
                const isLast = idx === msgs.length - 1 || msgs[idx + 1].senderId !== msg.senderId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"} ${isFirst ? "mt-2" : "mt-0.5"}`}
                    data-testid={`msg-${msg.id}`}
                  >
                    {/* Other user avatar — only on last bubble of their group */}
                    {!isMine && (
                      <div className="w-7 mr-1.5 self-end shrink-0">
                        {isLast && (
                          <Avatar className="w-7 h-7 border border-border">
                            <AvatarImage src={otherUser?.photoURL} />
                            <AvatarFallback className="text-xs">{otherUser?.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}

                    <div className="max-w-[72%] group">
                      <div
                        className={`px-3.5 py-2 text-sm leading-snug break-words
                          ${isMine
                            ? "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 text-white rounded-2xl rounded-br-sm"
                            : "bg-card text-foreground border border-border/50 rounded-2xl rounded-bl-sm"
                          }
                          ${!isFirst && isMine ? "rounded-tr-md" : ""}
                          ${!isFirst && !isMine ? "rounded-tl-md" : ""}
                        `}
                      >
                        {msg.text}
                      </div>
                      {isLast && (
                        <p className={`text-[10px] text-muted-foreground/60 mt-0.5 ${isMine ? "text-right" : "text-left pl-1"}`}>
                          {msgTimestamp(msg.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50 bg-card shrink-0 flex items-center gap-2">
        <div className="flex-1 flex items-center bg-muted rounded-full px-4 py-2.5 gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUser?.displayName || ""}…`}
            maxLength={1000}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
            data-testid="input-message"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 flex items-center justify-center text-white disabled:opacity-40 transition-opacity active:scale-90 shrink-0"
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
