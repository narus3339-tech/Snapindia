import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  AuthError,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "auth/unauthorized-domain":
      return `Domain not authorized. Add "${window.location.hostname}" to Firebase Console → Authentication → Settings → Authorized domains.`;
    case "auth/popup-blocked":
      return "Popup was blocked by the browser. Please allow popups for this site.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed. Please try again.";
    case "auth/cancelled-popup-request":
      return "Another sign-in is already in progress.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Invalid email address.";
    default:
      return error.message ?? "Authentication failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: user.displayName || "User",
              username: user.email?.split("@")[0] || `user_${user.uid.slice(0, 5)}`,
              photoURL: user.photoURL || "",
              bio: "",
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // Non-fatal: user profile creation failed, still log them in
        }
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      const msg = getAuthErrorMessage(err as AuthError);
      toast.error(msg, {
        duration: 8000,
        description:
          (err as AuthError).code === "auth/unauthorized-domain"
            ? `Go to Firebase Console → Authentication → Settings → Authorized domains → Add "${window.location.hostname}"`
            : undefined,
      });
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      toast.error("Sign out failed. Please try again.");
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, signInWithGoogle, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
