import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import StoryViewer from "@/components/StoryViewer";

interface Story {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  createdAt: any;
  expiresAt: any;
  viewedBy: string[];
}

interface StoryGroup {
  authorUid: string;
  authorName: string;
  authorPhotoURL: string;
  stories: Story[];
}

export default function StoriesBar() {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!currentUser) return;

    const now = Timestamp.now();
    const q = query(
      collection(db, "stories"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "asc"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allStories: Story[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Story, "id">),
      }));

      // Group by author, current user's stories first
      const map = new Map<string, StoryGroup>();
      allStories.forEach((story) => {
        if (!map.has(story.authorUid)) {
          map.set(story.authorUid, {
            authorUid: story.authorUid,
            authorName: story.authorName,
            authorPhotoURL: story.authorPhotoURL,
            stories: [],
          });
        }
        map.get(story.authorUid)!.stories.push(story);
      });

      // Sort: own story first, then unseen first
      const sorted = Array.from(map.values()).sort((a, b) => {
        if (a.authorUid === currentUser.uid) return -1;
        if (b.authorUid === currentUser.uid) return 1;
        const aUnseen = a.stories.some((s) => !s.viewedBy?.includes(currentUser.uid));
        const bUnseen = b.stories.some((s) => !s.viewedBy?.includes(currentUser.uid));
        if (aUnseen && !bUnseen) return -1;
        if (!aUnseen && bUnseen) return 1;
        return 0;
      });

      setGroups(sorted);
    });

    return unsub;
  }, [currentUser]);

  function hasUnseen(group: StoryGroup) {
    return group.stories.some((s) => !s.viewedBy?.includes(currentUser!.uid));
  }

  function openViewer(index: number) {
    setActiveGroupIndex(index);
    setViewerOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-4 px-3 py-3 overflow-x-auto scrollbar-hide border-b border-border/40">
        {/* "Your Story" button */}
        <div className="flex flex-col items-center gap-1 min-w-[58px]" data-testid="story-add-btn">
          {groups.find((g) => g.authorUid === currentUser?.uid) ? (
            // Has own story — clicking opens viewer
            <button
              onClick={() => openViewer(groups.findIndex((g) => g.authorUid === currentUser?.uid))}
              className="relative"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600">
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={currentUser?.photoURL || ""} />
                    <AvatarFallback className="text-xs">{currentUser?.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center border-2 border-background">
                <Plus className="w-3 h-3 text-white" />
              </div>
            </button>
          ) : (
            // No own story — clicking goes to create story
            <button
              onClick={() => setLocation("/create?type=story")}
              className="relative"
              data-testid="button-add-story"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted hover:border-primary/50 transition-colors">
                <Avatar className="w-full h-full">
                  <AvatarImage src={currentUser?.photoURL || ""} />
                  <AvatarFallback className="text-xs">{currentUser?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center border-2 border-background">
                <Plus className="w-3 h-3 text-white" />
              </div>
            </button>
          )}
          <span className="text-xs text-muted-foreground truncate w-14 text-center leading-tight">
            Your story
          </span>
        </div>

        {/* Other users' stories */}
        {groups
          .filter((g) => g.authorUid !== currentUser?.uid)
          .map((group, i) => {
            const realIndex = groups.indexOf(group);
            const unseen = hasUnseen(group);
            return (
              <button
                key={group.authorUid}
                onClick={() => openViewer(realIndex)}
                className="flex flex-col items-center gap-1 min-w-[58px]"
                data-testid={`story-group-${i}`}
              >
                <div
                  className={`w-14 h-14 rounded-full p-[2px] ${
                    unseen
                      ? "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600"
                      : "bg-muted"
                  }`}
                >
                  <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={group.authorPhotoURL} />
                      <AvatarFallback className="text-xs">{group.authorName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground truncate w-14 text-center leading-tight">
                  {group.authorName?.split(" ")[0]}
                </span>
              </button>
            );
          })}

        {/* Empty state */}
        {groups.filter((g) => g.authorUid !== currentUser?.uid).length === 0 && (
          <p className="text-xs text-muted-foreground self-center">No stories yet — follow people to see theirs</p>
        )}
      </div>

      {/* Fullscreen Story Viewer */}
      {viewerOpen && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={activeGroupIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
