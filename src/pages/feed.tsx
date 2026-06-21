import { useState, useEffect } from "react";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, where,
} from "firebase/firestore";
import { db, getRtdb } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Share2, MapPin, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import StoriesBar from "@/components/StoriesBar";
import CommentsSheet from "@/components/CommentsSheet";
import { sendNotification } from "@/lib/notifications";
import { useFollowing } from "@/hooks/useFollowing";

/* ─── PostCard ───────────────────────────────────────────────── */
export function PostCard({ post }: { post: any }) {
  const { currentUser } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(post.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, "posts", post.id, "likes", currentUser.uid)).then((snap) =>
      setLiked(snap.exists())
    );
  }, [post.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;
    const likeRef = doc(db, "posts", post.id, "likes", currentUser.uid);
    try {
      if (liked) {
        setLiked(false);
        setLikesCount((p: number) => Math.max(0, p - 1));
        await deleteDoc(likeRef);
      } else {
        setLiked(true);
        setLikesCount((p: number) => p + 1);
        await setDoc(likeRef, { uid: currentUser.uid });
        sendNotification({
          toUid: post.authorUid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "Someone",
          fromPhotoURL: currentUser.photoURL || "",
          type: "like",
          postId: post.id,
          postThumbnail: post.mediaUrl || "",
        });
      }
    } catch {
      setLiked((v) => !v);
      setLikesCount((p: number) => liked ? p + 1 : p - 1);
    }
  };

  return (
    <div className="bg-card border-b border-border/50 pb-4 mb-1">
      {/* Header */}
      <div className="flex items-center p-3">
        <Link href={`/profile/${post.authorUid}`}>
          <Avatar className="h-10 w-10 cursor-pointer border border-primary/20">
            <AvatarImage src={post.authorPhotoURL} />
            <AvatarFallback>{post.authorName?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="ml-3 flex-1">
          <Link href={`/profile/${post.authorUid}`}>
            <span className="font-semibold text-sm cursor-pointer hover:underline">{post.authorName}</span>
          </Link>
          {post.location && (
            <div className="flex items-center text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-1" />
              {post.location}
            </div>
          )}
        </div>
      </div>

      {/* Media */}
      <div
        className="w-full bg-black overflow-hidden aspect-square cursor-pointer"
        onDoubleClick={!liked ? handleLike : undefined}
      >
        {post.mediaType === "video" ? (
          <video src={post.mediaUrl} className="w-full h-full object-cover" controls loop muted />
        ) : (
          <img src={post.mediaUrl} className="w-full h-full object-cover" alt="" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center p-3 gap-4">
        <button onClick={handleLike} className="focus:outline-none transition-transform active:scale-75" data-testid={`button-like-${post.id}`}>
          <Heart className={`w-7 h-7 transition-colors ${liked ? "fill-rose-500 text-rose-500" : "text-foreground"}`} />
        </button>
        <button onClick={() => setCommentsOpen(true)} className="focus:outline-none transition-transform active:scale-75" data-testid={`button-comments-${post.id}`}>
          <MessageCircle className="w-7 h-7 text-foreground" />
        </button>
        <button className="focus:outline-none transition-transform active:scale-75">
          <Share2 className="w-7 h-7 text-foreground" />
        </button>
      </div>

      {/* Info */}
      <div className="px-3 space-y-1">
        <p className="font-semibold text-sm">{likesCount} {likesCount === 1 ? "like" : "likes"}</p>
        {post.caption ? (
          <p className="text-sm">
            <span className="font-semibold mr-1.5">{post.authorName}</span>
            {post.caption}
          </p>
        ) : null}
        <button
          onClick={() => setCommentsOpen(true)}
          className="text-muted-foreground text-sm block text-left"
          data-testid={`button-view-comments-${post.id}`}
        >
          {commentsCount > 0
            ? `View all ${commentsCount} comment${commentsCount === 1 ? "" : "s"}`
            : "Add a comment…"}
        </button>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : "Just now"}
        </p>
      </div>

      {commentsOpen && (
        <CommentsSheet
          postId={post.id}
          postAuthorUid={post.authorUid}
          postThumbnail={post.mediaUrl || ""}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(delta) => setCommentsCount((p: number) => Math.max(0, p + delta))}
        />
      )}
    </div>
  );
}

/* ─── Feed ───────────────────────────────────────────────────── */
export default function Feed() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { followingUids, loading: followLoading } = useFollowing();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"following" | "discover">("following");
  const [unreadDMs, setUnreadDMs] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const rtdb = getRtdb();
    if (!rtdb) return;
    const r = ref(rtdb, `userChats/${currentUser.uid}`);
    const handler = onValue(r, (snap) => {
      const val = snap.val();
      if (!val) { setUnreadDMs(0); return; }
      setUnreadDMs(
        Object.values(val).reduce((s: number, c: any) => s + (c.unread || 0), 0) as number
      );
    });
    return () => off(r, "value", handler);
  }, [currentUser]);

  useEffect(() => {
    if (followLoading) return;

    // If user follows nobody yet (besides themselves), show discover mode
    const hasFollowing = followingUids.length > 1;
    if (!hasFollowing) { setMode("discover"); }

    let q;
    if (hasFollowing && mode !== "discover") {
      // Firestore "in" supports up to 30 items
      const batch = followingUids.slice(0, 30);
      q = query(
        collection(db, "posts"),
        where("authorUid", "in", batch),
        orderBy("createdAt", "desc"),
        limit(30)
      );
    } else {
      q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));
    }

    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [followingUids, followLoading, mode]);

  const hasFollowing = followingUids.length > 1;

  return (
    <div className="max-w-md mx-auto pb-20 pt-4 bg-background min-h-screen">
      {/* Header */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient-snap font-sans tracking-tight">SnapIndia</h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setLocation("/notifications")} className="relative">
            <Heart className="w-6 h-6 text-foreground" />
          </button>
          <button onClick={() => setLocation("/chat")} className="relative" data-testid="button-header-chat">
            <MessageCircle className="w-6 h-6 text-foreground" />
            {unreadDMs > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadDMs > 9 ? "9+" : unreadDMs}
              </span>
            )}
          </button>
        </div>
      </div>

      <StoriesBar />

      {/* Following / Discover toggle — only show when user follows people */}
      {hasFollowing && (
        <div className="flex mx-4 mt-3 mb-1 bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setMode("following")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "following" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Following
          </button>
          <button
            onClick={() => setMode("discover")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "discover" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Discover
          </button>
        </div>
      )}

      <div className="mt-2">
        {loading || followLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="w-full h-96 rounded-xl" />
            <Skeleton className="w-full h-96 rounded-xl" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-muted-foreground gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
              <Users className="w-7 h-7 opacity-40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {mode === "following" ? "No posts from people you follow" : "No posts yet"}
              </p>
              <p className="text-sm mt-1">
                {mode === "following"
                  ? "Follow more people, or check Discover for all posts."
                  : "Be the first to post something!"}
              </p>
            </div>
            {mode === "following" && (
              <button
                onClick={() => setMode("discover")}
                className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold"
              >
                Show All Posts
              </button>
            )}
            <button
              onClick={() => setLocation("/create")}
              className="text-xs px-4 py-2 rounded-full bg-muted text-foreground font-semibold border border-border"
            >
              Create Post
            </button>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}
