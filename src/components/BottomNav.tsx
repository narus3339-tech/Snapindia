import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Search, PlusSquare, Bell, User, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, getRtdb } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";

export default function BottomNav() {
  const [location] = useLocation();
  const { currentUser } = useAuth();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);

  // Firestore: unread notifications count
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", currentUser.uid),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => setUnreadNotifs(snap.size));
    return unsub;
  }, [currentUser]);

  // RTDB: unread DM count
  useEffect(() => {
    if (!currentUser) return;
    const rtdb = getRtdb();
    if (!rtdb) return;
    const userChatsRef = ref(rtdb, `userChats/${currentUser.uid}`);
    const handler = onValue(userChatsRef, (snap) => {
      const val = snap.val();
      if (!val) { setUnreadDMs(0); return; }
      const total = Object.values(val).reduce(
        (sum: number, chat: any) => sum + (chat.unread || 0),
        0
      );
      setUnreadDMs(total as number);
    });
    return () => off(userChatsRef, "value", handler);
  }, [currentUser]);

  if (!currentUser) return null;

  const links = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "/create", icon: PlusSquare, label: "Create" },
    { href: "/chat", icon: MessageCircle, label: "Messages", badge: unreadDMs },
    { href: "/notifications", icon: Bell, label: "Notifications", badge: unreadNotifs },
    { href: `/profile/${currentUser.uid}`, icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-card/80 backdrop-blur-md border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {links.map(({ href, icon: Icon, label, badge }) => {
          const active =
            href === "/"
              ? location === "/"
              : location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`relative p-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-6 h-6" />
              {badge != null && badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
