import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useState } from "react";
import { CheckCircle, Circle, ChevronRight, Globe, Key, Shield, Lock } from "lucide-react";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Feed from "@/pages/feed";
import Create from "@/pages/create";
import Explore from "@/pages/explore";
import Notifications from "@/pages/notifications";
import ChatList from "@/pages/chat";
import Conversation from "@/pages/conversation";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

const REQUIRED_SECRETS = [
  { key: "VITE_FIREBASE_API_KEY", label: "Firebase API Key", hint: "Project Settings → General → Your apps → Web app" },
  { key: "VITE_FIREBASE_AUTH_DOMAIN", label: "Auth Domain", hint: "your-project.firebaseapp.com" },
  { key: "VITE_FIREBASE_PROJECT_ID", label: "Project ID", hint: "Project Settings → General" },
  { key: "VITE_FIREBASE_STORAGE_BUCKET", label: "Storage Bucket", hint: "your-project.appspot.com" },
  { key: "VITE_FIREBASE_MESSAGING_SENDER_ID", label: "Messaging Sender ID", hint: "Project Settings → Cloud Messaging" },
  { key: "VITE_FIREBASE_APP_ID", label: "App ID", hint: "Project Settings → Your apps" },
  { key: "VITE_FIREBASE_DATABASE_URL", label: "Database URL", hint: "Realtime Database → Data tab URL" },
  { key: "VITE_CLOUDINARY_CLOUD_NAME", label: "Cloudinary Cloud Name", hint: "cloudinary.com → Dashboard" },
  { key: "VITE_CLOUDINARY_UPLOAD_PRESET", label: "Cloudinary Upload Preset", hint: "Settings → Upload → Presets (unsigned)" },
];

const DOMAIN_STEPS = [
  { step: "1", text: "Open Firebase Console", sub: "console.firebase.google.com" },
  { step: "2", text: "Select your SnapIndia project" },
  { step: "3", text: "Go to Authentication", sub: "Left sidebar → Build → Authentication" },
  { step: "4", text: "Click Settings tab", sub: "At the top of the Authentication page" },
  { step: "5", text: "Scroll to Authorized domains" },
  { step: "6", text: "Click Add domain and add these:", sub: null, domains: true },
];

function SetupScreen() {
  const [activeTab, setActiveTab] = useState<"credentials" | "domains" | "google" | "rules">("credentials");
  const currentHost = typeof window !== "undefined" ? window.location.hostname : "your-repl.replit.dev";

  const tabs = [
    { id: "credentials" as const, label: "Credentials", icon: Key },
    { id: "domains" as const, label: "Authorized Domains", icon: Globe },
    { id: "google" as const, label: "Google Sign-In", icon: Shield },
    { id: "rules" as const, label: "Security Rules", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start p-4 pt-10 pb-16">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 bg-clip-text text-transparent">
            SnapIndia
          </h1>
          <p className="text-muted-foreground text-sm">Complete setup to launch your app</p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {tabs.map((tab, i) => (
            <div key={tab.id} className="flex items-center gap-2">
              <button
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
              {i < tabs.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Tab: Credentials */}
        {activeTab === "credentials" && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base mb-1">Add Secrets in Replit</h2>
              <p className="text-xs text-muted-foreground">
                Open the <strong className="text-foreground">Secrets</strong> tab (lock icon in sidebar) and add each key below.
              </p>
            </div>
            <div className="space-y-2">
              {REQUIRED_SECRETS.map(({ key, label, hint }) => (
                <div key={key} className="bg-muted rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Circle className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-foreground">{key}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label} — {hint}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              After adding all secrets, <strong className="text-foreground">refresh this page</strong>.
              Then continue to the next tabs to enable Google Sign-In.
            </p>
            <button
              data-testid="btn-next-domains"
              onClick={() => setActiveTab("domains")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold"
            >
              Next: Authorized Domains
            </button>
          </div>
        )}

        {/* Tab: Authorized Domains */}
        {activeTab === "domains" && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base mb-1">Whitelist Your Domains</h2>
              <p className="text-xs text-muted-foreground">
                Firebase blocks Google Sign-In on unlisted domains. Add your Replit domains to the allowlist.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {DOMAIN_STEPS.map(({ step, text, sub, domains }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{text}</p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    {domains && (
                      <div className="mt-2 space-y-2">
                        {[
                          { label: "Development (this preview)", value: currentHost },
                          { label: "All Replit previews", value: "*.replit.dev" },
                          { label: "Published app", value: "*.replit.app" },
                          { label: "localhost (local testing)", value: "localhost" },
                        ].map(({ label, value }) => (
                          <div key={value} className="bg-muted rounded-lg p-2.5 flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            <div>
                              <p className="font-mono text-xs text-foreground font-semibold">{value}</p>
                              <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-400">
              <strong>Your current domain:</strong>{" "}
              <span className="font-mono">{currentHost}</span>
              <br />
              This must be added to Firebase or Google Sign-In will fail with an "unauthorized-domain" error.
            </div>

            <button
              data-testid="btn-next-google"
              onClick={() => setActiveTab("google")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold"
            >
              Next: Enable Google Sign-In
            </button>
          </div>
        )}

        {/* Tab: Google Sign-In */}
        {activeTab === "google" && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base mb-1">Enable Google Sign-In</h2>
              <p className="text-xs text-muted-foreground">
                Turn on Google as a sign-in provider in Firebase Authentication.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { step: "1", text: "Firebase Console → Authentication → Sign-in method tab" },
                { step: "2", text: "Find Google in the provider list" },
                { step: "3", text: "Click the pencil (edit) icon next to Google" },
                { step: "4", text: "Toggle Enable on", sub: "Top of the modal" },
                { step: "5", text: "Set Project support email", sub: "Your Google account email" },
                { step: "6", text: "Click Save" },
                { step: "7", text: "Also enable Email/Password", sub: "Click Email/Password → Enable → Save" },
              ].map(({ step, text, sub }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{text}</p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400 space-y-1">
              <p className="font-semibold">Checklist before going live:</p>
              {[
                "Secrets added in Replit",
                "Authorized domains added in Firebase",
                "Email/Password sign-in enabled",
                "Google sign-in enabled with support email",
                "Firestore created in test mode",
                "Realtime Database created",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              data-testid="btn-next-rules"
              onClick={() => setActiveTab("rules")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold"
            >
              Next: Security Rules
            </button>
          </div>
        )}

        {/* Tab: Security Rules */}
        {activeTab === "rules" && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base mb-1">Deploy Security Rules</h2>
              <p className="text-xs text-muted-foreground">
                Protect your Firestore and Realtime Database so only the right users can read/write data.
                Rules files are already created in your project.
              </p>
            </div>

            {/* What the rules do */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">What is protected</p>
              {[
                { icon: "FS", label: "Users", desc: "Only you can edit your own profile" },
                { icon: "FS", label: "Posts", desc: "Only the author can delete. Likes/comments by any logged-in user" },
                { icon: "FS", label: "Likes", desc: "You can only add/remove your own like" },
                { icon: "FS", label: "Comments", desc: "Max 500 chars. Only author can delete" },
                { icon: "FS", label: "Notifications", desc: "Only recipient can read. Only sender can create" },
                { icon: "FS", label: "Follows", desc: "Only you can create/delete your own follows" },
                { icon: "DB", label: "Chat messages", desc: "Only chat participants can read/write. Max 1000 chars" },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2.5 bg-muted rounded-lg p-2.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${icon === "FS" ? "bg-orange-500/20 text-orange-400" : "bg-purple-500/20 text-purple-400"}`}>
                    {icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                <span className="text-orange-400 font-semibold">FS</span> = Firestore &nbsp;
                <span className="text-purple-400 font-semibold">DB</span> = Realtime Database
              </p>
            </div>

            {/* Deploy steps */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">How to deploy</p>
              <div className="space-y-2">
                {[
                  {
                    step: "1",
                    text: "Install Firebase CLI",
                    code: "npm install -g firebase-tools",
                  },
                  {
                    step: "2",
                    text: "Login to Firebase",
                    code: "firebase login",
                  },
                  {
                    step: "3",
                    text: "Go to the snapindia folder",
                    code: "cd artifacts/snapindia",
                  },
                  {
                    step: "4",
                    text: "Deploy Firestore rules",
                    code: "firebase deploy --only firestore:rules --project YOUR_PROJECT_ID",
                  },
                  {
                    step: "5",
                    text: "Deploy Realtime DB rules",
                    code: "firebase deploy --only database --project YOUR_PROJECT_ID",
                  },
                ].map(({ step, text, code }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium mb-1">{text}</p>
                      <code className="block bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-green-400 font-mono break-all">
                        {code}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternative: Firebase Console */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-blue-400">Alternative: Firebase Console (no CLI needed)</p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Firestore:</strong> Firebase Console → Firestore Database → Rules tab → paste the contents of <code className="text-orange-400">firestore.rules</code> → Publish
              </p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Realtime DB:</strong> Firebase Console → Realtime Database → Rules tab → paste contents of <code className="text-purple-400">database.rules.json</code> → Publish
              </p>
            </div>

            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400 space-y-1">
              <p className="font-semibold">Final checklist — everything needed for launch:</p>
              {[
                "Secrets added in Replit",
                "Authorized domains added in Firebase",
                "Email/Password sign-in enabled",
                "Google sign-in enabled with support email",
                "Firestore created (test mode → then deploy rules)",
                "Realtime Database created (then deploy rules)",
                "Cloudinary upload preset created (unsigned)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              data-testid="btn-refresh"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold"
            >
              Refresh &amp; Launch SnapIndia
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Redirect to="/login" />;
  return <Component {...rest} />;
}

function PublicRoute({ component: Component, ...rest }: any) {
  const { currentUser } = useAuth();
  if (currentUser) return <Redirect to="/" />;
  return <Component {...rest} />;
}

function AppContent() {
  const { currentUser } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <Switch>
        <Route path="/login"><PublicRoute component={Login} /></Route>
        <Route path="/signup"><PublicRoute component={Signup} /></Route>
        <Route path="/"><ProtectedRoute component={Feed} /></Route>
        <Route path="/explore"><ProtectedRoute component={Explore} /></Route>
        <Route path="/create"><ProtectedRoute component={Create} /></Route>
        <Route path="/notifications"><ProtectedRoute component={Notifications} /></Route>
        <Route path="/chat"><ProtectedRoute component={ChatList} /></Route>
        <Route path="/chat/:uid"><ProtectedRoute component={Conversation} /></Route>
        <Route path="/profile/:uid"><ProtectedRoute component={Profile} /></Route>
        <Route path="/terms"><Terms /></Route>
            <Route component={NotFound} />
      </Switch>
      {currentUser && <BottomNav />}
    </div>
  );
}

const queryClient = new QueryClient();

function App() {
  if (!isFirebaseConfigured) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SetupScreen />
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </WouterRouter>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
