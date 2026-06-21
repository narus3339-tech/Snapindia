import { useState, useEffect, useRef } from "react";
import {
  collection, query, orderBy, limit, getDocs,
  where, doc, setDoc, deleteDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Search, Play, X, Heart, MessageCircle, UserPlus, Flame, Clapperboard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { sendNotification } from "@/lib/notifications";
import { toast } from "sonner";

type Tab = "trending" | "reels" | "people";

/* ─── Inline Follow Button ───────────────────────────────────── */
function FollowBtn({ targetUid, targetName, targetPhotoURL }: { targetUid: string; targetName: string; targetPhotoURL: string }) {
  const { currentUser } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const followId = currentUser ? `${currentUser.uid}_${targetUid}` : "";

  useEffect(() => {
    if (!currentUser || currentUser.uid === targetUid) return;
    getDoc(doc(db, "follows", followId)).then((s) => setFollowing(s.exists()));
  }, [followId]);

  if (!currentUser || currentUser.uid === targetUid || following === null) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (following) {
        await deleteDoc(doc(db, "follows", followId));
        setFollowing(false);
      } else {
        await setDoc(doc(db, "follows", followId), {
          followerId: currentUser.uid,
          followingId: targetUid,
          createdAt: serverTimestamp(),
        });
        setFollowing(true);
        sendNotification({
          toUid: targetUid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "Someone",
          fromPhotoURL: currentUser.photoURL || "",
          type: "follow",
        });
      }
    } catch {
      toast.error("Could not update follow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shrink-0 ${
        following
          ? "bg-muted text-foreground border border-border"
          : "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white"
      }`}
      data-testid={`button-follow-${targetUid}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

/* ─── Post Modal ─────────────────────────────────────────────── */
function PostModal({ post, onClose }: { post: any; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const close = () => { setVisible(false); setTimeout(onClose, 220); };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-220 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <div
        className={`fixed inset-x-3 top-1/2 z-50 -translate-y-1/2 max-w-sm mx-auto bg-card rounded-2xl overflow-hidden transition-all duration-220 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        data-testid="post-modal"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
          <Link href={`/profile/${post.authorUid}`} onClick={close}>
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">{post.authorName?.charAt(0)}</AvatarFallback>
                <AvatarImage src={post.authorPhotoURL} />
              </Avatar>
              <span className="text-sm font-semibold">{post.authorName}</span>
            </div>
          </Link>
          <button onClick={close} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="aspect-square bg-black overflow-hidden">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="w-full h-full object-cover" controls autoPlay muted loop />
          ) : (
            <img src={post.mediaUrl} className="w-full h-full object-cover" alt="" />
          )}
        </div>

        <div className="p-3 space-y-1.5">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" /> {post.likesCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" /> {post.commentsCount || 0}
            </span>
          </div>
          {post.caption && (
            <p className="text-sm">
              <span className="font-semibold mr-1">{post.authorName}</span>
              {post.caption}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main Explore Page ──────────────────────────────────────── */
export default function Explore() {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("trending");
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Load trending posts */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "posts"),
          orderBy("createdAt", "desc"),
          limit(30)
        );
        const snap = await getDocs(q);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
        setPosts(all.filter((p) => p.mediaType !== "video"));
        setReels(all.filter((p) => p.mediaType === "video"));
      } catch {/* ignore */}
      setLoading(false);
    };
    load();
  }, []);

  /* Load suggested users — just recent users, not already following */
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(30)));
        const all = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u: any) => u.id !== currentUser.uid) as any[];
        setSuggestedUsers(all.slice(0, 15));
      } catch {/* ignore */}
    };
    load();
  }, [currentUser]);

  /* Debounced search — name AND username prefix match */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchUsers([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const term = searchQuery.trim();
        const [byName, byUsername] = await Promise.all([
          getDocs(query(
            collection(db, "users"),
            where("displayName", ">=", term),
            where("displayName", "<=", term + "\uf8ff"),
            limit(10)
          )),
          getDocs(query(
            collection(db, "users"),
            where("username", ">=", term.toLowerCase()),
            where("username", "<=", term.toLowerCase() + "\uf8ff"),
            limit(10)
          )),
        ]);
        const seen = new Set<string>();
        const results: any[] = [];
        [...byName.docs, ...byUsername.docs].forEach((d) => {
          if (!seen.has(d.id)) { seen.add(d.id); results.push({ id: d.id, ...d.data() }); }
        });
        setSearchUsers(results);
      } catch {/* ignore */}
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const tabs: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: "trending", label: "Trending", icon: Flame },
    { id: "reels", label: "Reels", icon: Clapperboard },
    { id: "people", label: "People", icon: UserPlus },
  ];

  return (
    <div className="max-w-md mx-auto pb-20 pt-4 bg-background min-h-screen">
      {/* Search bar */}
      <div className="relative mx-4 mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 bg-muted rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          data-testid="input-explore-search"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="px-3">
          {searchLoading ? (
            <div className="space-y-3 px-1">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                </div>
              ))}
            </div>
          ) : searchUsers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">No results for "{searchQuery}"</p>
              <p className="text-xs mt-1">Try a different name or username</p>
            </div>
          ) : (
            <div className="space-y-1">
              {searchUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                  <Link href={`/profile/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-11 h-11 border border-border shrink-0">
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback className="text-sm">{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                      {user.followersCount > 0 && (
                        <p className="text-xs text-muted-foreground/60">{user.followersCount} followers</p>
                      )}
                    </div>
                  </Link>
                  <FollowBtn targetUid={user.id} targetName={user.displayName} targetPhotoURL={user.photoURL} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 px-4 mb-4 overflow-x-auto scrollbar-hide">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === id
                    ? "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Trending posts grid */}
          {activeTab === "trending" && (
            loading ? (
              <div className="grid grid-cols-3 gap-0.5">
                {[1,2,3,4,5,6,7,8,9].map(i => <Skeleton key={i} className="aspect-square w-full" />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
                <Flame className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium text-foreground">No posts yet</p>
                <p className="text-xs">Be the first to post something!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="aspect-square bg-muted relative overflow-hidden group"
                    data-testid={`post-thumb-${post.id}`}
                  >
                    <img
                      src={post.mediaUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {/* Hover overlay with likes */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 fill-white" />{post.likesCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />{post.commentsCount || 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Reels grid — 2 columns, 9:16 */}
          {activeTab === "reels" && (
            loading ? (
              <div className="grid grid-cols-2 gap-1 px-0.5">
                {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
              </div>
            ) : reels.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
                <Clapperboard className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium text-foreground">No reels yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 px-0.5">
                {reels.map((reel) => (
                  <button
                    key={reel.id}
                    onClick={() => setSelectedPost(reel)}
                    className="aspect-[9/16] bg-muted relative overflow-hidden rounded-xl group"
                    data-testid={`reel-thumb-${reel.id}`}
                  >
                    <video src={reel.mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
                      <Avatar className="w-6 h-6 border border-white/40 shrink-0">
                        <AvatarImage src={reel.authorPhotoURL} />
                        <AvatarFallback className="text-xs">{reel.authorName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-white text-xs font-semibold truncate">{reel.authorName}</span>
                    </div>
                    <div className="absolute bottom-8 right-2.5 text-white text-xs flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-white" />{reel.likesCount || 0}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* People — suggested users */}
          {activeTab === "people" && (
            <div className="px-3 space-y-1">
              {suggestedUsers.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
                  <UserPlus className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium text-foreground">No users yet</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1 mb-3">Suggested for you</p>
                  {suggestedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                      <Link href={`/profile/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="w-12 h-12 border border-border shrink-0">
                          <AvatarImage src={user.photoURL} />
                          <AvatarFallback className="text-base">{user.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                          {user.bio && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{user.bio}</p>}
                        </div>
                      </Link>
                      <FollowBtn targetUid={user.id} targetName={user.displayName} targetPhotoURL={user.photoURL} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Post / Reel modal */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
