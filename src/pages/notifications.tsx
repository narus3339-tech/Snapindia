import { useState, useEffect, useCallback } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  writeBatch, doc, setDoc, deleteDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, UserPlus, BellOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

interface Notif {
  id: string;
  toUid: string;
  fromUid: string;
  fromName: string;
  fromPhotoURL: string;
  type: "like" | "comment" | "follow";
  postId?: string;
  postThumbnail?: string;
  commentText?: string;
  read: boolean;
  createdAt: any;
}

function groupNotifs(notifs: Notif[]) {
  const today: Notif[] = [];
  const week: Notif[] = [];
  const earlier: Notif[] = [];

  notifs.forEach((n) => {
    const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
    if (isToday(date)) today.push(n);
    else if (isThisWeek(date)) week.push(n);
    else earlier.push(n);
  });

  return { today, week, earlier };
}

function NotifIcon({ type }: { type: string }) {
  if (type === "like")
    return (
      <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center">
        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
      </span>
    );
  if (type === "comment")
    return (
      <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
        <MessageCircle className="w-3 h-3 text-blue-400 fill-blue-400" />
      </span>
    );
  return (
    <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
      <UserPlus className="w-3 h-3 text-purple-400" />
    </span>
  );
}

function FollowButton({ targetUid }: { targetUid: string }) {
  const { currentUser } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const followId = currentUser ? `${currentUser.uid}_${targetUid}` : "";

  useEffect(() => {
    if (!currentUser) return;
    const ref = doc(db, "follows", followId);
    getDoc(ref).then((snap) => setFollowing(snap.exists()));
  }, [followId, currentUser]);

  const toggle = async () => {
    if (!currentUser) return;
    const ref = doc(db, "follows", followId);
    try {
      if (following) {
        await deleteDoc(ref);
        setFollowing(false);
      } else {
        await setDoc(ref, {
          followerId: currentUser.uid,
          followingId: targetUid,
          createdAt: serverTimestamp(),
        });
        setFollowing(true);
        toast.success("Following!");
      }
    } catch {
      toast.error("Could not update follow");
    }
  };

  if (following === null) return null;

  return (
    <button
      onClick={toggle}
      className={`ml-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
        following
          ? "bg-muted text-foreground border border-border"
          : "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

function NotifRow({ notif }: { notif: Notif }) {
  const timeAgo = notif.createdAt?.toDate
    ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })
    : "Just now";

  const text =
    notif.type === "like"
      ? "liked your post."
      : notif.type === "comment"
      ? notif.commentText
        ? `commented: "${notif.commentText.slice(0, 60)}${notif.commentText.length > 60 ? "…" : ""}"`
        : "commented on your post."
      : "started following you.";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        !notif.read ? "bg-primary/5 border border-primary/10" : "hover:bg-card/40"
      }`}
      data-testid={`notif-${notif.id}`}
    >
      {/* Avatar + icon badge */}
      <Link href={`/profile/${notif.fromUid}`} className="relative shrink-0">
        <Avatar className="w-11 h-11 border border-border cursor-pointer">
          <AvatarImage src={notif.fromPhotoURL} />
          <AvatarFallback className="text-sm">{notif.fromName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1">
          <NotifIcon type={notif.type} />
        </div>
      </Link>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <Link href={`/profile/${notif.fromUid}`}>
            <span className="font-semibold cursor-pointer hover:underline">{notif.fromName}</span>
          </Link>{" "}
          <span className="text-muted-foreground">{text}</span>
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo}</p>
      </div>

      {/* Right side — thumbnail for like/comment, follow button for follow */}
      {notif.type === "follow" ? (
        <FollowButton targetUid={notif.fromUid} />
      ) : notif.postThumbnail ? (
        <Link href={`/`} className="shrink-0">
          <img
            src={notif.postThumbnail}
            alt="post"
            className="w-11 h-11 rounded-lg object-cover border border-border"
          />
        </Link>
      ) : null}
    </div>
  );
}

function Section({ title, items }: { title: string; items: Notif[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((n) => (
          <NotifRow key={n.id} notif={n} />
        ))}
      </div>
    </div>
  );
}

export default function Notifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notif, "id">) }))
      );
      setLoading(false);

      // Mark all unread as read
      const unread = snapshot.docs.filter((d) => !d.data().read);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        unread.forEach((d) =>
          batch.update(doc(db, "notifications", d.id), { read: true })
        );
        batch.commit().catch(() => {});
      }
    });

    return unsubscribe;
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const { today, week, earlier } = groupNotifs(notifications);

  return (
    <div className="max-w-md mx-auto pb-20 pt-4 px-3 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white">
            {unreadCount} new
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-1">
              <Skeleton className="w-11 h-11 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
            <BellOff className="w-7 h-7 opacity-40" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No notifications yet</p>
            <p className="text-sm mt-1">When someone likes or comments on your posts, you'll see it here.</p>
          </div>
        </div>
      ) : (
        <>
          <Section title="Today" items={today} />
          <Section title="This Week" items={week} />
          <Section title="Earlier" items={earlier} />
        </>
      )}
    </div>
  );
}
