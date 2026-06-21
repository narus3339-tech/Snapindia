import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection, addDoc, serverTimestamp, increment,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Image as ImageIcon, Video, MapPin, Zap } from "lucide-react";

type PostType = "post" | "reel" | "story";

export default function Create() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [type, setType] = useState<PostType>("post");
  const [loading, setLoading] = useState(false);

  // Pre-select type from query param (?type=story)
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const t = params.get("type") as PostType | null;
    if (t === "story" || t === "reel" || t === "post") setType(t);
  }, [searchStr]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    if (selected.type.startsWith("video/") && type === "post") setType("reel");
    if (selected.type.startsWith("image/") && type === "reel") setType("post");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentUser) return;

    setLoading(true);
    try {
      const mediaUrl = await uploadToCloudinary(file);
      const mediaType = file.type.startsWith("video/") ? "video" : "photo";
      const now = serverTimestamp();

      if (type === "story") {
        // Stories expire in 24 hours
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
        await addDoc(collection(db, "stories"), {
          authorUid: currentUser.uid,
          authorName: currentUser.displayName || "User",
          authorPhotoURL: currentUser.photoURL || "",
          mediaUrl,
          mediaType,
          createdAt: now,
          expiresAt,
          viewedBy: [],
        });
        toast.success("Story posted! It will disappear in 24 hours.");
      } else {
        await addDoc(collection(db, "posts"), {
          authorUid: currentUser.uid,
          authorName: currentUser.displayName || "User",
          authorPhotoURL: currentUser.photoURL || "",
          mediaUrl,
          mediaType,
          caption,
          location: locationName,
          likesCount: 0,
          commentsCount: 0,
          type,
          createdAt: now,
        });
        await updateDoc(doc(db, "users", currentUser.uid), {
          postsCount: increment(1),
        });
        toast.success(type === "reel" ? "Reel shared!" : "Post shared!");
      }

      setLocation("/");
    } catch (error: any) {
      toast.error("Failed to share", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const typeButtons: { id: PostType; label: string; icon: typeof ImageIcon; disabled?: boolean }[] = [
    { id: "post", label: "Post", icon: ImageIcon, disabled: file?.type.startsWith("video/") },
    { id: "reel", label: "Reel", icon: Video, disabled: file?.type.startsWith("image/") },
    { id: "story", label: "Story", icon: Zap },
  ];

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      <Card className="bg-card/50 backdrop-blur-xl border-border mt-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {type === "story" ? "Add Story" : type === "reel" ? "Create Reel" : "Create Post"}
          </CardTitle>
          {type === "story" && (
            <p className="text-xs text-muted-foreground -mt-1">Disappears after 24 hours</p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type selector */}
            <div className="flex gap-2">
              {typeButtons.map(({ id, label, icon: Icon, disabled }) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setType(id)}
                  data-testid={`button-type-${id}`}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all
                    ${type === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* File picker */}
            <div className="flex justify-center border-2 border-dashed border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
              {!preview ? (
                <label className="flex flex-col items-center justify-center w-full h-48 cursor-pointer">
                  <div className="flex space-x-4 mb-4">
                    <div className="p-3 bg-primary/20 rounded-full text-primary">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <div className="p-3 bg-accent/20 rounded-full text-accent">
                      <Video className="w-8 h-8" />
                    </div>
                  </div>
                  <span className="text-muted-foreground font-medium text-sm">
                    Select {type === "reel" ? "Video" : type === "story" ? "Photo or Video" : "Photo"}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {type === "story" ? "Appears at the top of feeds for 24h" : ""}
                  </span>
                  <input
                    type="file"
                    accept={type === "reel" ? "video/*" : type === "post" ? "image/*" : "image/*,video/*"}
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-file"
                  />
                </label>
              ) : (
                <div
                  className={`relative w-full overflow-hidden rounded-lg bg-black/50 ${
                    type === "story" ? "aspect-[9/16]" : "aspect-square"
                  }`}
                >
                  {file?.type.startsWith("video/") ? (
                    <video src={preview} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 rounded-full text-xs"
                    onClick={() => { setFile(null); setPreview(""); }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* Caption / location — not needed for stories */}
            {preview && type !== "story" && (
              <>
                <Textarea
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="resize-none bg-background/50 border-none focus-visible:ring-1"
                  rows={3}
                  data-testid="input-create-caption"
                />
                <div className="flex items-center space-x-2 bg-background/50 p-2 rounded-md">
                  <MapPin className="text-muted-foreground w-5 h-5 ml-2" />
                  <Input
                    type="text"
                    placeholder="Add location"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="border-none bg-transparent focus-visible:ring-0 shadow-none"
                    data-testid="input-create-location"
                  />
                </div>
              </>
            )}

            {preview && (
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-base font-semibold py-5 rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95"
                disabled={loading || !file}
                data-testid="button-create-submit"
              >
                {loading
                  ? "Uploading..."
                  : type === "story"
                  ? "Share Story"
                  : type === "reel"
                  ? "Share Reel"
                  : "Share Post"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
