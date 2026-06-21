import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRtdb } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";
import { Link, useLocation, useSearch } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, PenSquare, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ChatMeta {
  id: string;
  otherUid: string;
  otherName: string;
  otherPhotoURL: string;
  lastMessage: string;
  updatedAt: number;
  unread: number;
}

export default function ChatList() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const rtdb = getRtdb();

  // If opened with ?uid=xxx, immediately go to that conversation
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const uid = params.get("uid");
    if (uid) setLocation(`/chat/${uid}`);
  }, [searchStr]);

  useEffect(() => {
    if (!currentUser || !rtdb) { setLoading(false); return; }
    const userChatsRef = ref(rtdb, `userChats/${currentUser.uid}`);
    const handler = onValue(userChatsRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: ChatMeta[] = Object.entries(val).map(([id, m]: any) => ({
          id,
          ...(m as Omit<ChatMeta, "id">),
        }));
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        setChats(list);
      } else {
        setChats([]);
      }
      setLoading(false);
    });
    return () => off(userChatsRef, "value", handler);
  }, [currentUser, rtdb]);

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <div className="max-w-md mx-auto pb-20 pt-4 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Messages
          {totalUnread > 0 && (
            <span className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white">
              {totalUnread}
            </span>
          )}
        </h1>
        <button
          onClick={() => setLocation("/explore")}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="New message"
          data-testid="button-new-message"
        >
          <PenSquare className="w-5 h-5" />
        </button>
      </div>

      {!rtdb ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-4 px-6 text-center">
          <WifiOff className="w-10 h-10 opacity-30" />
          <div>
            <p className="font-semibold text-foreground">Chat not available</p>
            <p className="text-sm mt-1">
              Add <code className="text-orange-400 text-xs">VITE_FIREBASE_DATABASE_URL</code> to enable real-time messaging.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-1 px-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-14 h-14 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-muted-foreground gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
            <MessageCircle className="w-7 h-7 opacity-40" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No messages yet</p>
            <p className="text-sm mt-1">Visit someone's profile and tap Message to start chatting.</p>
          </div>
          <button
            onClick={() => setLocation("/explore")}
            className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold"
          >
            Find People
          </button>
        </div>
      ) : (
        <div className="space-y-0.5 px-2">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chat/${chat.otherUid}`}>
              <div
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-card/60 active:bg-card/80 transition-colors cursor-pointer"
                data-testid={`chat-item-${chat.otherUid}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar className="w-14 h-14 border border-border">
                    <AvatarImage src={chat.otherPhotoURL} />
                    <AvatarFallback className="text-lg">{chat.otherName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {chat.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                      {chat.unread > 9 ? "9+" : chat.unread}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm leading-tight truncate ${chat.unread > 0 ? "font-bold text-foreground" : "font-semibold"}`}>
                      {chat.otherName}
                    </p>
                    {chat.updatedAt && (
                      <p className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(chat.updatedAt, { addSuffix: false })}
                      </p>
                    )}
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${chat.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {chat.lastMessage}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
