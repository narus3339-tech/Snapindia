import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

/**
 * Returns the live list of UIDs that the current user follows.
 * Includes the current user's own UID so feed queries work simply.
 */
export function useFollowing() {
  const { currentUser } = useAuth();
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setFollowingUids([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "follows"),
      where("followerId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const uids = snap.docs.map((d) => d.data().followingId as string);
      setFollowingUids([currentUser.uid, ...uids]);
      setLoading(false);
    });

    return unsub;
  }, [currentUser]);

  return { followingUids, loading };
}
