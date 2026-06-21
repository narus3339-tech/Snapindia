import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, onSnapshot, setDoc, deleteDoc,
  collection, query, where, orderBy, getDocs,
  updateDoc, increment, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { useParams, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid, Clapperboard, Settings, X, Check, ArrowLeft, UserX } from "lucide-react";
import { toast } from "sonner";
import { sendNotification } from "@/lib/notifications";
import { Link } from "wouter";

/* ─── Types ─────────────────────────────────────────────────── */
interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

interface PostThumb {
  id: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  type: "post" | "reel";
}

interface FollowUser {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
}

/* ─── Edit Profile Sheet ─────────────────────────────────────── */
function EditProfileSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSaved: (updated: Partial<UserProfile>) => void;
}) {
  const { currentUser } = useAuth();
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 260); };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: displayName.trim().slice(0, 50),
        bio: bio.trim().slice(0, 150),
      });
      onSaved({ displayName: displayName.trim(), bio: bio.trim() });
      toast.success("Profile updated!");
      handleClose();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-2xl transition-transform duration-250 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
          <button onClick={handleClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          <h3 className="font-semibold text-sm">Edit Profile</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold text-primary disabled:opacity-40"
            data-testid="button-save-profile"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="p-4 space-y-4 pb-10">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="Your name"
              className="mt-1 w-full bg-muted rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-edit-name"
            />
            <p className="text-xs text-muted-foreground/50 text-right mt-0.5">{displayName.length}/50</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              rows={3}
              placeholder="Tell people about yourself…"
              className="mt-1 w-full bg-muted rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
              data-testid="input-edit-bio"
            />
            <p className="text-xs text-muted-foreground/50 text-right mt-0.5">{bio.length}/150</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Followers / Following Sheet ───────────────────────────── */
function FollowListSheet({
  title,
  uids,
  fieldKey,
  onClose,
}: {
  title: string;
  uids: string[];
  fieldKey: "followerId" | "followingId";
  onClose: () => void;
}) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 260); };

  useEffect(() => {
    if (uids.length === 0) { setLoading(false); return; }
    Promise.all(
      uids.map((uid) => getDoc(doc(db, "users", uid)).then((s) => s.exists() ? ({ uid, ...s.data() } as FollowUser) : null))
    ).then((results) => {
      setUsers(results.filter(Boolean) as FollowUser[]);
      setLoading(false);
    });
  }, [uids]);

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`} onClick={handleClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-2xl transition-transform duration-250 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`} style={{ maxHeight: "70vh" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50 shrink-0">
          <div className="w-5" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={handleClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><Skeleton className="h-4 w-32" /></div>)}</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <UserX className="w-8 h-8 opacity-30" />
              <p className="text-sm">No users yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {users.map((u) => (
                <Link key={u.uid} href={`/profile/${u.uid}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors cursor-pointer" onClick={handleClose}>
                    <Avatar className="w-10 h-10 border border-border">
                      <AvatarImage src={u.photoURL} />
                      <AvatarFallback className="text-sm">{u.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main Profile Page ──────────────────────────────────────── */
export default function Profile() {
  const { uid } = useParams();
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "reels">("posts");

  // Follow state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Sheets
  const [editOpen, setEditOpen] = useState(false);
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  const [followerUids, setFollowerUids] = useState<string[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);

  const isOwnProfile = currentUser?.uid === uid;
  const followId = currentUser && uid ? `${currentUser.uid}_${uid}` : "";

  /* Load profile doc with live counts */
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as UserProfile;
        setProfileUser({ ...d, uid });
        setFollowersCount(d.followersCount || 0);
        setFollowingCount(d.followingCount || 0);
      }
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  /* Check current follow state */
  useEffect(() => {
    if (!followId) { setFollowLoading(false); return; }
    getDoc(doc(db, "follows", followId)).then((snap) => {
      setFollowing(snap.exists());
      setFollowLoading(false);
    });
  }, [followId]);

  /* Load posts for grid */
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "posts"),
      where("authorUid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostThumb, "id">) })));
      setPostsLoading(false);
    });
    return unsub;
  }, [uid]);

  /* Follow / Unfollow */
  const handleFollow = async () => {
    if (!currentUser || !uid || !profileUser || followLoading) return;
    setFollowLoading(true);
    const followRef = doc(db, "follows", followId);
    const batch = writeBatch(db);

    try {
      if (following) {
        // Unfollow
        batch.delete(followRef);
        batch.update(doc(db, "users", uid), { followersCount: increment(-1) });
        batch.update(doc(db, "users", currentUser.uid), { followingCount: increment(-1) });
        await batch.commit();
        setFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        // Follow
        batch.set(followRef, {
          followerId: currentUser.uid,
          followingId: uid,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, "users", uid), { followersCount: increment(1) });
        batch.update(doc(db, "users", currentUser.uid), { followingCount: increment(1) });
        await batch.commit();
        setFollowing(true);
        setFollowersCount((c) => c + 1);
        sendNotification({
          toUid: uid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "Someone",
          fromPhotoURL: currentUser.photoURL || "",
          type: "follow",
        });
      }
    } catch {
      toast.error("Could not update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  /* Load follower/following UID lists for sheet */
  const openFollowSheet = async (sheet: "followers" | "following") => {
    if (!uid) return;
    setFollowSheet(sheet);
    if (sheet === "followers") {
      const snap = await getDocs(query(collection(db, "follows"), where("followingId", "==", uid)));
      setFollowerUids(snap.docs.map((d) => d.data().followerId as string));
    } else {
      const snap = await getDocs(query(collection(db, "follows"), where("followerId", "==", uid)));
      setFollowingUids(snap.docs.map((d) => d.data().followingId as string));
    }
  };

  const filteredPosts = posts.filter((p) =>
    activeTab === "reels" ? p.type === "reel" || p.mediaType === "video" : p.type !== "reel" && p.mediaType !== "video"
  );

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-6 min-h-screen pt-8">
        <div className="flex items-center space-x-6">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="aspect-square w-full" />)}
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return <div className="p-10 text-center text-muted-foreground">User not found</div>;
  }

  return (
    <div className="max-w-md mx-auto pb-20 bg-background min-h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-5">
          {!isOwnProfile ? (
            <button onClick={() => setLocation("/")} className="text-foreground">
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : <div className="w-6" />}
          <h1 className="text-lg font-bold">
            {profileUser.username || profileUser.displayName}
          </h1>
          {isOwnProfile ? (
            <button onClick={() => setEditOpen(true)} data-testid="button-edit-profile">
              <Settings className="w-6 h-6 text-foreground" />
            </button>
          ) : <div className="w-6" />}
        </div>

        {/* Avatar + stats */}
        <div className="flex items-center gap-6 mb-5">
          <div className={`rounded-full p-[2.5px] shrink-0 ${following ? "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600" : "bg-border"}`}>
            <Avatar className="w-20 h-20 border-2 border-background">
              <AvatarImage src={profileUser.photoURL} className="object-cover" />
              <AvatarFallback className="text-2xl">{profileUser.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 flex justify-around text-center">
            <div>
              <p className="font-bold text-lg leading-tight">{posts.filter(p => p.type !== "reel" && p.mediaType !== "video").length || profileUser.postsCount || 0}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <button onClick={() => openFollowSheet("followers")} className="text-center hover:opacity-70 transition-opacity" data-testid="button-followers">
              <p className="font-bold text-lg leading-tight">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button onClick={() => openFollowSheet("following")} className="text-center hover:opacity-70 transition-opacity" data-testid="button-following">
              <p className="font-bold text-lg leading-tight">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-4">
          <p className="font-semibold text-sm">{profileUser.displayName}</p>
          {profileUser.bio ? (
            <p className="text-sm mt-0.5 whitespace-pre-wrap text-muted-foreground">{profileUser.bio}</p>
          ) : isOwnProfile ? (
            <p className="text-sm mt-0.5 text-muted-foreground/50 italic">Add a bio…</p>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isOwnProfile ? (
            <button
              onClick={() => setEditOpen(true)}
              className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors border border-border"
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleFollow}
                disabled={followLoading}
                data-testid="button-follow"
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  following
                    ? "bg-muted text-foreground border border-border hover:bg-muted/80"
                    : "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20 hover:opacity-90"
                }`}
              >
                {followLoading ? "…" : following ? "Following" : "Follow"}
              </button>
              <button
                onClick={() => setLocation(`/chat?uid=${uid}`)}
                className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold border border-border hover:bg-muted/80 transition-colors"
                data-testid="button-message"
              >
                Message
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === "posts" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("posts")}
        >
          <Grid className="w-5 h-5" />
        </button>
        <button
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === "reels" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("reels")}
        >
          <Clapperboard className="w-5 h-5" />
        </button>
      </div>

      {/* Posts grid */}
      {postsLoading ? (
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="aspect-square w-full" />)}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
          <Grid className="w-10 h-10 opacity-20" />
          <p className="text-sm font-medium">No {activeTab} yet</p>
          {isOwnProfile && (
            <button
              onClick={() => setLocation("/create")}
              className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold mt-1"
            >
              Create your first {activeTab === "reels" ? "reel" : "post"}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          {filteredPosts.map((post) => (
            <div key={post.id} className="aspect-square bg-muted relative overflow-hidden">
              {post.mediaType === "video" ? (
                <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={post.mediaUrl} alt="Post" className="w-full h-full object-cover" />
              )}
              {(post.type === "reel" || post.mediaType === "video") && (
                <div className="absolute top-1.5 right-1.5">
                  <Clapperboard className="w-4 h-4 text-white drop-shadow" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sheets */}
      {editOpen && (
        <EditProfileSheet
          profile={profileUser}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setProfileUser((p) => p ? { ...p, ...updated } : p)}
        />
      )}
      {followSheet === "followers" && (
        <FollowListSheet
          title="Followers"
          uids={followerUids}
          fieldKey="followerId"
          onClose={() => setFollowSheet(null)}
        />
      )}
      {followSheet === "following" && (
        <FollowListSheet
          title="Following"
          uids={followingUids}
          fieldKey="followingId"
          onClose={() => setFollowSheet(null)}
        />
      )}
    </div>
  );
}
