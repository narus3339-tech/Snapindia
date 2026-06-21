import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

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

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 5000;

export default function StoryViewer({ groups, initialGroupIndex, onClose }: StoryViewerProps) {
  const { currentUser } = useAuth();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Mark story as viewed
  useEffect(() => {
    if (!currentStory || !currentUser) return;
    if (currentStory.viewedBy?.includes(currentUser.uid)) return;
    const storyRef = doc(db, "stories", currentStory.id);
    updateDoc(storyRef, { viewedBy: arrayUnion(currentUser.uid) }).catch(() => {});
  }, [currentStory?.id, currentUser]);

  // Timer for auto-advance
  useEffect(() => {
    if (paused) return;
    if (!currentStory) return;

    const isVideo = currentStory.mediaType === "video";
    const duration = isVideo && videoRef.current ? (videoRef.current.duration * 1000 || STORY_DURATION) : STORY_DURATION;

    startTimeRef.current = Date.now() - elapsedRef.current;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);

      if (elapsed >= duration) {
        elapsedRef.current = 0;
        goNext();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [groupIndex, storyIndex, paused]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [groupIndex, storyIndex]);

  function goNext() {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setStoryIndex(0);
    }
  }

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.35) {
      goPrev();
    } else if (x > rect.width * 0.65) {
      goNext();
    }
  }

  function handlePointerDown() {
    setPaused(true);
    elapsedRef.current = Date.now() - startTimeRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (videoRef.current) videoRef.current.pause();
  }

  function handlePointerUp() {
    setPaused(false);
    if (videoRef.current && currentStory?.mediaType === "video") {
      videoRef.current.play().catch(() => {});
    }
  }

  if (!currentStory) return null;

  const timeAgo = currentStory.createdAt?.toDate
    ? formatDistanceToNow(currentStory.createdAt.toDate(), { addSuffix: true })
    : "Just now";

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      data-testid="story-viewer"
    >
      <div className="relative w-full max-w-sm h-screen mx-auto overflow-hidden">
        {/* Media */}
        <div
          className="absolute inset-0 select-none"
          onClick={handleTap}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {currentStory.mediaType === "video" ? (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop={false}
              muted={muted}
              playsInline
              data-testid="story-video"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
              draggable={false}
              data-testid="story-image"
            />
          )}
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Progress bars */}
        <div className="absolute top-3 inset-x-2 flex gap-1 z-10">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width:
                    i < storyIndex
                      ? "100%"
                      : i === storyIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 inset-x-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600">
              <Avatar className="w-full h-full border-2 border-black">
                <AvatarImage src={currentGroup.authorPhotoURL} />
                <AvatarFallback className="text-xs">{currentGroup.authorName?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-white text-xs font-semibold leading-tight">{currentGroup.authorName}</p>
              <p className="text-white/60 text-xs leading-tight">{timeAgo}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {currentStory.mediaType === "video" && (
              <button
                data-testid="button-story-mute"
                className="text-white"
                onClick={() => setMuted((m) => !m)}
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
            <button
              data-testid="button-story-close"
              className="text-white"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Left / Right tap zones — visual hint arrows on sides */}
        <button
          className="absolute left-0 top-1/2 -translate-y-1/2 p-3 text-white/20 hover:text-white/50 z-10 transition-colors"
          onClick={goPrev}
          data-testid="button-story-prev"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 p-3 text-white/20 hover:text-white/50 z-10 transition-colors"
          onClick={goNext}
          data-testid="button-story-next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
