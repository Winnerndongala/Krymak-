import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Home, Search, Library, 
  MessageCircle, User, Settings, Shield, Ban, CheckCircle, 
  Send, Music, Heart, Share2, MoreHorizontal, Plus, Repeat, Share,
  Bell, History, Trash2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'artist' | 'fan';
  is_banned: number;
  has_subscription: number;
  avatar_url: string;
  bio?: string;
  phone_number?: string;
}

interface Album {
  id: number;
  title: string;
  artist_id: number;
  artist_name: string;
  cover_url: string;
  created_at: string;
}

interface Track {
  id: number;
  title: string;
  artist_id: number;
  artist_name: string;
  album_id?: number;
  album_title?: string;
  url: string;
  cover_url: string;
  duration: string;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  avatar_url: string;
  content: string;
  created_at: string;
}

interface Post {
  id: number;
  artist_id: number;
  artist_name: string;
  artist_avatar: string;
  content: string;
  created_at: string;
  comments: Comment[];
}

interface HistoryItem {
  id: number;
  user_id: number;
  track_id: number;
  played_at: string;
  title: string;
  cover_url: string;
  artist_name: string;
}

interface Notification {
  id: number;
  user_id: number;
  type: string;
  content: string;
  is_read: number;
  created_at: string;
}

// --- Components ---

const GlassCard = ({ children, className, id, onClick }: { children: React.ReactNode, className?: string, id?: string, key?: React.Key, onClick?: () => void }) => (
  <div 
    id={id}
    onClick={onClick}
    className={cn(
      "bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden",
      className
    )}
  >
    {children}
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 w-full p-4 rounded-2xl transition-all duration-300",
      active ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
    )}
  >
    <Icon size={24} />
    <span className="font-medium">{label}</span>
  </button>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('krymak_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<{ [key: string]: string }>({ subscription_mode: 'free' });
  const [activeTab, setActiveTab] = useState<'home' | 'music' | 'admin' | 'profile' | 'artist-tools' | 'history' | 'search'>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ tracks: Track[], artists: User[] }>({ tracks: [], artists: [] });
  const [likedTrackIds, setLikedTrackIds] = useState<number[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newComment, setNewComment] = useState<{ [key: number]: string }>({});
  
  // Login State
  const [loginForm, setLoginForm] = useState({ 
    username: localStorage.getItem('krymak_last_username') || '', 
    password: '' 
  });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Artist Tools State
  const [newTrack, setNewTrack] = useState({ title: '', url: '', cover_url: '', duration: '3:00', album_id: '' });
  const [newAlbum, setNewAlbum] = useState({ title: '', cover_url: '' });
  const [profileEdit, setProfileEdit] = useState({ username: '', bio: '', avatar_url: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [artistStats, setArtistStats] = useState({ unique_listeners: 0, total_plays: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, tRes, pRes, aRes, sRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/tracks'),
        fetch('/api/posts'),
        fetch('/api/albums'),
        fetch('/api/settings')
      ]);

      const responses = [uRes, tRes, pRes, aRes, sRes];
      const failed = responses.find(r => !r.ok);
      if (failed) {
        console.error(`API Error: ${failed.status} on ${failed.url}`);
        return;
      }

      const [uData, tData, pData, aData, sData] = await Promise.all(responses.map(r => r.json()));
      
      setUsers(uData);
      setTracks(tData);
      setPosts(pData);
      setAlbums(aData);
      setSettings(sData);
      
      if (currentUser) {
        const updatedUser = uData.find((u: User) => u.id === currentUser.id);
        if (updatedUser) {
          setCurrentUser(updatedUser);
          localStorage.setItem('krymak_user', JSON.stringify(updatedUser));
          setProfileEdit({ 
            username: updatedUser.username, 
            bio: updatedUser.bio || '', 
            avatar_url: updatedUser.avatar_url 
          });
          fetchUserSpecificData(updatedUser.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults({ tracks: [], artists: [] });
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (error) {
      console.error("Search failed", error);
    }
  };

  const toggleLike = async (trackId: number) => {
    if (!currentUser) return;
    const isLiked = likedTrackIds.includes(trackId);
    try {
      if (isLiked) {
        await fetch(`/api/likes/${currentUser.id}/${trackId}`, { method: 'DELETE' });
        setLikedTrackIds(likedTrackIds.filter(id => id !== trackId));
      } else {
        await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id, track_id: trackId })
        });
        setLikedTrackIds([...likedTrackIds, trackId]);
      }
    } catch (error) {
      console.error("Failed to toggle like", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        localStorage.setItem('krymak_user', JSON.stringify(user));
        localStorage.setItem('krymak_last_username', user.username);
        setProfileEdit({ 
          username: user.username, 
          bio: user.bio || '', 
          avatar_url: user.avatar_url 
        });
        fetchUserSpecificData(user.id);
      } else {
        const data = await res.json();
        setLoginError(data.error || "Erreur de connexion");
      }
    } catch (error) {
      setLoginError("Erreur serveur");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('krymak_user');
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        localStorage.setItem('krymak_user', JSON.stringify(user));
        localStorage.setItem('krymak_last_username', user.username);
        setProfileEdit({ 
          username: user.username, 
          bio: user.bio || '', 
          avatar_url: user.avatar_url 
        });
        fetchUserSpecificData(user.id);
      } else {
        const data = await res.json();
        setLoginError(data.error || "Erreur lors de l'inscription");
      }
    } catch (error) {
      setLoginError("Erreur serveur");
    }
  };

  const fetchUserSpecificData = async (userId: number) => {
    try {
      const [hRes, nRes, sRes, lRes] = await Promise.all([
        fetch(`/api/history/${userId}`),
        fetch(`/api/notifications/${userId}`),
        fetch(`/api/stats/artist/${userId}`),
        fetch(`/api/likes/${userId}`)
      ]);
      if (hRes.ok) setHistory(await hRes.json());
      if (nRes.ok) setNotifications(await nRes.json());
      if (sRes.ok) setArtistStats(await sRes.json());
      if (lRes.ok) setLikedTrackIds(await lRes.json());
    } catch (error) {
      console.error("Failed to fetch user specific data", error);
    }
  };

  const recordHistory = async (trackId: number) => {
    if (!currentUser) return;
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, track_id: trackId })
      });
      fetchUserSpecificData(currentUser.id);
    } catch (error) {
      console.error("Failed to record history", error);
    }
  };

  const markNotificationAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/read/${id}`, { method: 'POST' });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const handleDeleteTrack = async (id: number) => {
    if (!confirm("Supprimer cette musique ?")) return;
    try {
      await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
      setTracks(tracks.filter(t => t.id !== id));
    } catch (error) {
      console.error("Failed to delete track", error);
    }
  };

  const handleDeleteAlbum = async (id: number) => {
    if (!confirm("Supprimer cet album ?")) return;
    try {
      await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      setAlbums(albums.filter(a => a.id !== id));
    } catch (error) {
      console.error("Failed to delete album", error);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm("Supprimer ce post ?")) return;
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      setPosts(posts.filter(p => p.id !== id));
    } catch (error) {
      console.error("Failed to delete post", error);
    }
  };

  const handleUpdateSettings = async (key: string, value: string) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update settings", error);
    }
  };

  const handleUpdateSubscription = async (userId: number, hasSub: boolean) => {
    try {
      await fetch(`/api/users/${userId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_subscription: hasSub })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update subscription", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    try {
      await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileEdit)
      });
      fetchData();
      alert("Profil mis à jour !");
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  const handleAddTrack = async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTrack, artist_id: currentUser.id })
      });
      setNewTrack({ title: '', url: '', cover_url: '', duration: '3:00', album_id: '' });
      fetchData();
      alert("Musique ajoutée !");
    } catch (error) {
      console.error("Failed to add track", error);
    }
  };

  const handleAddAlbum = async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAlbum, artist_id: currentUser.id })
      });
      setNewAlbum({ title: '', cover_url: '' });
      fetchData();
      alert("Album créé !");
    } catch (error) {
      console.error("Failed to create album", error);
    }
  };

  const handleBan = async (userId: number, isBanned: boolean) => {
    try {
      await fetch(`/api/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: isBanned })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to ban user", error);
    }
  };

  const handleCreatePost = async () => {
    if (!currentUser || !newPostContent.trim()) return;
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_id: currentUser.id, content: newPostContent })
      });
      setNewPostContent('');
      fetchData();
    } catch (error) {
      console.error("Failed to create post", error);
    }
  };

  const handleAddComment = async (postId: number) => {
    if (!currentUser || !newComment[postId]?.trim()) return;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, user_id: currentUser.id, content: newComment[postId] })
      });
      setNewComment({ ...newComment, [postId]: '' });
      fetchData();
    } catch (error) {
      console.error("Failed to add comment", error);
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    recordHistory(track.id);
    if (audioRef.current) {
      audioRef.current.src = track.url;
      audioRef.current.play();
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse delay-1000" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md z-10"
        >
          <GlassCard className="p-8 lg:p-12 space-y-8 border-white/20 shadow-2xl">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black tracking-tighter italic text-white">KRYMAK</h1>
              <p className="text-white/40 text-sm">{isRegistering ? "Créez votre compte" : "Connectez-vous pour continuer"}</p>
            </div>

            {isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-white/40 uppercase font-bold tracking-widest pl-1">Nom d'utilisateur</label>
                    <input 
                      type="text"
                      required
                      placeholder="Choisissez un nom"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 outline-none focus:border-white/30 transition-all text-white placeholder:text-white/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/40 uppercase font-bold tracking-widest pl-1">Mot de passe</label>
                    <input 
                      type="password"
                      required
                      placeholder="Choisissez un mot de passe"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 outline-none focus:border-white/30 transition-all text-white placeholder:text-white/10"
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">{loginError}</p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                >
                  S'INSCRIRE
                </button>
                
                <p className="text-center text-sm text-white/40">
                  Déjà un compte ? {" "}
                  <button type="button" onClick={() => setIsRegistering(false)} className="text-white font-bold hover:underline">Se connecter</button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-white/40 uppercase font-bold tracking-widest pl-1">Nom d'utilisateur</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input 
                        type="text"
                        required
                        placeholder="Votre nom"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-white/30 transition-all text-white placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white/40 uppercase font-bold tracking-widest pl-1">Mot de passe</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input 
                        type="password"
                        required
                        placeholder="Votre mot de passe"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-white/30 transition-all text-white placeholder:text-white/10"
                      />
                    </div>
                  </div>
                </div>

                {loginError && (
                  <p className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">{loginError}</p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                >
                  SE CONNECTER
                </button>
                
                <p className="text-center text-sm text-white/40">
                  Pas encore de compte ? {" "}
                  <button type="button" onClick={() => setIsRegistering(true)} className="text-white font-bold hover:underline">S'inscrire</button>
                </p>
              </form>
            )}
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  if (currentUser?.role !== 'admin' && settings.subscription_mode === 'paid' && !currentUser?.has_subscription) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <GlassCard className="max-w-md p-12 text-center space-y-8 border-yellow-500/50">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
            <Shield size={40} className="text-yellow-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Abonnement Requis</h1>
            <p className="text-white/60">Pour accéder à Krymak, vous devez avoir un abonnement actif.</p>
          </div>
          
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
            <p className="text-sm font-medium text-white/80">Mode de paiement mobile :</p>
            <div className="text-2xl font-mono font-bold text-yellow-500 tracking-wider">
              +243 82 00 00 000
            </div>
            <p className="text-xs text-white/40 italic">Envoyez votre ID utilisateur après le paiement pour activation.</p>
            <div className="pt-2">
              <span className="text-xs text-white/60">Votre ID : </span>
              <span className="text-xs font-bold text-white">#{currentUser?.id}</span>
            </div>
          </div>

          <p className="text-xs text-white/30">Une fois le paiement effectué, l'administrateur activera votre compte sous peu.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white/20">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex h-screen overflow-hidden p-4 gap-4">
        {/* Sidebar - Hidden on mobile */}
        <aside className="hidden lg:flex w-64 flex-col gap-4">
          <div className="p-6">
            <h1 className="text-3xl font-black tracking-tighter italic text-white">KRYMAK</h1>
          </div>
          
          <GlassCard className="flex-1 p-2 space-y-1">
            <SidebarItem icon={Home} label="Accueil" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
            <SidebarItem icon={Music} label="Musique" active={activeTab === 'music'} onClick={() => setActiveTab('music')} />
            <SidebarItem icon={History} label="Historique" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            <SidebarItem icon={User} label="Profil" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            {currentUser?.role === 'artist' && (
              <SidebarItem icon={Plus} label="Outils Artiste" active={activeTab === 'artist-tools'} onClick={() => setActiveTab('artist-tools')} />
            )}
            {currentUser?.role === 'admin' && (
              <SidebarItem icon={Shield} label="Admin" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
            )}
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <img src={currentUser?.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-white/20" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{currentUser?.username}</p>
              <p className="text-xs text-white/50 capitalize">{currentUser?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-red-400 transition-colors">
              <Trash2 size={20} />
            </button>
          </GlassCard>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-4 overflow-hidden pb-32 lg:pb-4">
          <header className="flex items-center justify-between px-2 lg:px-4 gap-4">
            <div className="lg:hidden p-2">
              <h1 className="text-2xl font-black tracking-tighter italic text-white">KRYMAK</h1>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 lg:px-6 py-2 lg:py-3 rounded-full border border-white/10 w-full max-w-md">
              <Search size={18} className="text-white/40" />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={(e) => {
                  handleSearch(e.target.value);
                  if (activeTab !== 'search') setActiveTab('search');
                }}
                onFocus={() => {
                  if (activeTab !== 'search') setActiveTab('search');
                }}
                className="bg-transparent border-none outline-none w-full text-sm placeholder:text-white/20"
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors relative"
              >
                <Bell size={20} className="text-white/60" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050505]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 z-50"
                  >
                    <GlassCard className="p-4 shadow-2xl border-white/20">
                      <h3 className="font-bold mb-4">Notifications</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-white/40 text-center py-8">Aucune notification</p>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => markNotificationAsRead(n.id)}
                              className={cn(
                                "p-3 rounded-xl transition-colors cursor-pointer",
                                n.is_read ? "opacity-50" : "bg-white/5 hover:bg-white/10"
                              )}
                            >
                              <p className="text-sm">{n.content}</p>
                              <p className="text-[10px] text-white/40 mt-1">{formatDistanceToNow(new Date(n.created_at))} ago</p>
                            </div>
                          ))
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div 
                  key="home"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {currentUser?.role === 'artist' && (
                    <GlassCard className="p-6 space-y-4">
                      <div className="flex gap-4">
                        <img src={currentUser.avatar_url} alt="Me" className="w-12 h-12 rounded-full" />
                        <textarea 
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          placeholder="Quoi de neuf ?"
                          className="bg-transparent border-none outline-none flex-1 resize-none text-lg placeholder:text-white/20"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={handleCreatePost}
                          className="bg-white text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform"
                        >
                          Publier
                        </button>
                      </div>
                    </GlassCard>
                  )}

                  <div className="space-y-4">
                    <h2 className="text-xl font-bold px-2">Dernières Sorties</h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                      {tracks.slice(0, 5).map(track => (
                        <div 
                          key={track.id} 
                          onClick={() => playTrack(track)}
                          className="min-w-[160px] group cursor-pointer"
                        >
                          <div className="aspect-square rounded-2xl overflow-hidden relative mb-2">
                            <img src={track.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play size={24} fill="white" />
                            </div>
                          </div>
                          <p className="font-bold text-sm truncate">{track.title}</p>
                          <p className="text-xs text-white/40 truncate">{track.artist_name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-xl font-bold px-2">Actualités</h2>
                    <div className="space-y-0 divide-y divide-white/10 border-y border-white/10">
                      {posts.map(post => (
                        <div key={post.id} className="p-4 hover:bg-white/5 transition-colors flex gap-4">
                          <img src={post.artist_avatar} alt="" className="w-12 h-12 rounded-full flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-white truncate">{post.artist_name}</span>
                              <CheckCircle size={14} className="text-blue-400 flex-shrink-0" />
                              <span className="text-white/40 text-sm">@{post.artist_name.toLowerCase()}</span>
                              <span className="text-white/40 text-sm">· {formatDistanceToNow(new Date(post.created_at))}</span>
                            </div>
                            <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                            <div className="flex items-center justify-between max-w-md pt-2 text-white/40">
                              <button className="flex items-center gap-2 hover:text-blue-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-blue-400/10">
                                  <MessageCircle size={18} />
                                </div>
                                <span className="text-xs">{post.comments?.length || 0}</span>
                              </button>
                              <button className="flex items-center gap-2 hover:text-green-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-green-400/10">
                                  <Repeat size={18} />
                                </div>
                                <span className="text-xs">0</span>
                              </button>
                              <button className="flex items-center gap-2 hover:text-pink-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-pink-400/10">
                                  <Heart size={18} />
                                </div>
                                <span className="text-xs">0</span>
                              </button>
                              <button className="flex items-center gap-2 hover:text-blue-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-blue-400/10">
                                  <Share size={18} />
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'search' && (
                <motion.div 
                  key="search"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold px-2">Résultats pour "{searchQuery}"</h2>
                    
                    {searchResults.artists.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white/40 px-2 uppercase tracking-widest text-xs">Artistes</h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                          {searchResults.artists.map(artist => (
                            <div key={artist.id} className="min-w-[140px] text-center space-y-2 group cursor-pointer">
                              <img src={artist.avatar_url} alt="" className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-white/5 group-hover:border-white/20 transition-all" />
                              <p className="font-bold text-sm">{artist.username}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.tracks.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white/40 px-2 uppercase tracking-widest text-xs">Titres</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {searchResults.tracks.map(track => (
                            <GlassCard 
                              key={track.id} 
                              className="p-3 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer group"
                              onClick={() => playTrack(track)}
                            >
                              <img src={track.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold truncate">{track.title}</h4>
                                <p className="text-xs text-white/40 truncate">{track.artist_name}</p>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                                className={cn("p-2 transition-colors", likedTrackIds.includes(track.id) ? "text-pink-500" : "text-white/20 hover:text-white")}
                              >
                                <Heart size={18} fill={likedTrackIds.includes(track.id) ? "currentColor" : "none"} />
                              </button>
                            </GlassCard>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-white/20 py-12">Aucun résultat trouvé.</p>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'music' && (
                <motion.div 
                  key="music"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="space-y-8"
                >
                  {likedTrackIds.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold px-2 flex items-center gap-2">
                        <Heart size={24} className="text-pink-500" fill="currentColor" /> Titres Likés
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tracks.filter(t => likedTrackIds.includes(t.id)).map(track => (
                          <GlassCard 
                            key={`liked-${track.id}`} 
                            className="p-3 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer group"
                            onClick={() => playTrack(track)}
                          >
                            <img src={track.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold truncate">{track.title}</h4>
                              <p className="text-xs text-white/40 truncate">{track.artist_name}</p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                              className="p-2 text-pink-500 transition-colors"
                            >
                              <Heart size={18} fill="currentColor" />
                            </button>
                          </GlassCard>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold px-2">Toute la Musique</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tracks.map(track => (
                        <GlassCard 
                          key={track.id} 
                          className="group cursor-pointer hover:bg-white/10 transition-all duration-500"
                          onClick={() => playTrack(track)}
                        >
                          <div className="relative aspect-square overflow-hidden">
                            <img 
                              src={track.cover_url} 
                              alt={track.title} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                                {currentTrack?.id === track.id && isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                              </div>
                            </div>
                          </div>
                          <div className="p-4 flex items-center justify-between">
                            <div className="min-w-0">
                              <h3 className="font-bold text-lg truncate">{track.title}</h3>
                              <p className="text-white/50 text-sm">{track.artist_name}</p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                              className={cn("p-2 transition-colors", likedTrackIds.includes(track.id) ? "text-pink-500" : "text-white/20 hover:text-white")}
                            >
                              <Heart size={20} fill={likedTrackIds.includes(track.id) ? "currentColor" : "none"} />
                            </button>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold px-2 flex items-center gap-3">
                    <History size={28} /> Historique d'écoute
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    {history.length === 0 ? (
                      <GlassCard className="p-12 text-center text-white/40">
                        <Clock size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Votre historique est vide. Commencez à écouter !</p>
                      </GlassCard>
                    ) : (
                      history.map((item, idx) => (
                        <div 
                          key={`${item.id}-${idx}`}
                          onClick={() => {
                            const track = tracks.find(t => t.id === item.track_id);
                            if (track) playTrack(track);
                          }}
                          className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group"
                        >
                          <img src={item.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold truncate group-hover:text-blue-400 transition-colors">{item.title}</h4>
                            <p className="text-xs text-white/40 truncate">{item.artist_name}</p>
                          </div>
                          <div className="text-xs text-white/20">
                            {formatDistanceToNow(new Date(item.played_at))} ago
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'profile' && currentUser && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-4xl mx-auto space-y-8 pb-32"
                >
                  {/* Profile Header */}
                  <GlassCard className="p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/10 to-transparent" />
                    <div className="relative flex flex-col md:flex-row items-center md:items-end gap-8 pt-8">
                      <div className="relative group">
                        <img 
                          src={currentUser.avatar_url} 
                          alt="Avatar" 
                          className="w-40 h-40 rounded-full border-4 border-white/10 shadow-2xl object-cover" 
                        />
                        {isEditingProfile && (
                          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <p className="text-xs font-bold">Changer</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <h1 className="text-4xl font-black tracking-tight">{currentUser.username}</h1>
                          {currentUser.role === 'artist' && <CheckCircle size={24} className="text-blue-400" />}
                        </div>
                        <p className="text-white/60 max-w-lg">{currentUser.bio || "Aucune bio disponible."}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                          <div className="flex items-center gap-1 text-white/40 text-sm">
                            <User size={14} />
                            <span className="capitalize">{currentUser.role}</span>
                          </div>
                          {currentUser.role === 'artist' && (
                            <>
                              <div className="flex items-center gap-1 text-white/40 text-sm">
                                <Music size={14} />
                                <span>{tracks.filter(t => t.artist_id === currentUser.id).length} titres</span>
                              </div>
                              <div className="flex items-center gap-1 text-white/40 text-sm">
                                <User size={14} />
                                <span>{artistStats.unique_listeners} auditeurs</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full text-sm font-bold transition-colors"
                      >
                        {isEditingProfile ? "Annuler" : "Modifier le profil"}
                      </button>
                      
                      <button 
                        onClick={handleLogout}
                        className="lg:hidden bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-2 rounded-full text-sm font-bold transition-colors"
                      >
                        Déconnexion
                      </button>
                    </div>
                  </GlassCard>

                  {isEditingProfile ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <GlassCard className="p-8 space-y-6">
                        <h3 className="text-xl font-bold">Paramètres du Profil</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="text-xs text-white/40 uppercase font-bold">Nom d'utilisateur</label>
                            <input 
                              type="text" 
                              value={profileEdit.username}
                              onChange={(e) => setProfileEdit({ ...profileEdit, username: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-white/40 uppercase font-bold">URL Avatar</label>
                            <input 
                              type="text" 
                              value={profileEdit.avatar_url}
                              onChange={(e) => setProfileEdit({ ...profileEdit, avatar_url: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/20"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs text-white/40 uppercase font-bold">Bio</label>
                            <textarea 
                              value={profileEdit.bio}
                              onChange={(e) => setProfileEdit({ ...profileEdit, bio: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/20 resize-none"
                              rows={3}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            await handleUpdateProfile();
                            setIsEditingProfile(false);
                          }}
                          className="w-full bg-white text-black font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform"
                        >
                          Sauvegarder les modifications
                        </button>
                      </GlassCard>
                    </motion.div>
                  ) : (
                    <div className="space-y-12">
                      {/* Artist Content Sections */}
                      {currentUser.role === 'artist' && (
                        <>
                          {/* Tracks Section */}
                          <section className="space-y-4">
                            <h2 className="text-2xl font-bold px-2">Musiques</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {tracks.filter(t => t.artist_id === currentUser.id).map(track => (
                                <div 
                                  key={track.id} 
                                  onClick={() => playTrack(track)}
                                  className="group cursor-pointer"
                                >
                                  <div className="aspect-square rounded-2xl overflow-hidden relative mb-2">
                                    <img src={track.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Play size={24} fill="white" />
                                    </div>
                                  </div>
                                  <p className="font-bold text-sm truncate">{track.title}</p>
                                  <p className="text-xs text-white/40 truncate">{track.album_title || 'Single'}</p>
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Albums Section */}
                          <section className="space-y-4">
                            <h2 className="text-2xl font-bold px-2">Albums</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {albums.filter(a => a.artist_id === currentUser.id).map(album => (
                                <div key={album.id} className="group cursor-pointer">
                                  <div className="aspect-square rounded-2xl overflow-hidden relative mb-2 border border-white/5">
                                    <img src={album.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Library size={24} className="text-white" />
                                    </div>
                                  </div>
                                  <p className="font-bold text-sm truncate">{album.title}</p>
                                  <p className="text-xs text-white/40">{tracks.filter(t => t.album_id === album.id).length} titres</p>
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Posts Section */}
                          <section className="space-y-4">
                            <h2 className="text-2xl font-bold px-2">Actualités</h2>
                            <div className="space-y-4">
                              {posts.filter(p => p.artist_id === currentUser.id).map(post => (
                                <GlassCard key={post.id} className="p-6 space-y-4">
                                  <div className="flex items-center gap-3">
                                    <img src={currentUser.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    <div>
                                      <p className="font-bold text-sm">{currentUser.username}</p>
                                      <p className="text-[10px] text-white/40">{formatDistanceToNow(new Date(post.created_at))} ago</p>
                                    </div>
                                  </div>
                                  <p className="text-white/80 leading-relaxed">{post.content}</p>
                                </GlassCard>
                              ))}
                            </div>
                          </section>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'artist-tools' && currentUser?.role === 'artist' && (
                <motion.div 
                  key="artist-tools"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 pb-24"
                >
                  {/* Dashboard Header Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <GlassCard className="p-6 border-blue-500/20 bg-blue-500/5">
                      <p className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1">Total Musiques</p>
                      <h3 className="text-4xl font-black">{tracks.filter(t => t.artist_id === currentUser.id).length}</h3>
                    </GlassCard>
                    <GlassCard className="p-6 border-purple-500/20 bg-purple-500/5">
                      <p className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1">Total Albums</p>
                      <h3 className="text-4xl font-black">{albums.filter(a => a.artist_id === currentUser.id).length}</h3>
                    </GlassCard>
                    <GlassCard className="p-6 border-green-500/20 bg-green-500/5">
                      <p className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1">Total Posts</p>
                      <h3 className="text-4xl font-black">{posts.filter(p => p.artist_id === currentUser.id).length}</h3>
                    </GlassCard>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Add Track */}
                    <GlassCard className="p-6 space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Music size={20} /> Ajouter une Musique
                      </h3>
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="Titre de la chanson"
                          value={newTrack.title}
                          onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        />
                        <input 
                          type="text" 
                          placeholder="URL du fichier audio (MP3)"
                          value={newTrack.url}
                          onChange={(e) => setNewTrack({ ...newTrack, url: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        />
                        <input 
                          type="text" 
                          placeholder="URL de la pochette (Image)"
                          value={newTrack.cover_url}
                          onChange={(e) => setNewTrack({ ...newTrack, cover_url: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        />
                        <select 
                          value={newTrack.album_id}
                          onChange={(e) => setNewTrack({ ...newTrack, album_id: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        >
                          <option value="">Single (Pas d'album)</option>
                          {albums.filter(a => a.artist_id === currentUser.id).map(album => (
                            <option key={album.id} value={album.id}>{album.title}</option>
                          ))}
                        </select>
                        <button 
                          onClick={handleAddTrack}
                          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all"
                        >
                          Publier la Musique
                        </button>
                      </div>
                    </GlassCard>

                    {/* Create Album */}
                    <GlassCard className="p-6 space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Library size={20} /> Créer un Album
                      </h3>
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="Titre de l'album"
                          value={newAlbum.title}
                          onChange={(e) => setNewAlbum({ ...newAlbum, title: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        />
                        <input 
                          type="text" 
                          placeholder="URL de la pochette de l'album"
                          value={newAlbum.cover_url}
                          onChange={(e) => setNewAlbum({ ...newAlbum, cover_url: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-white/20 transition-colors"
                        />
                        <button 
                          onClick={handleAddAlbum}
                          className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 hover:scale-[1.02] transition-all"
                        >
                          Créer l'Album
                        </button>
                      </div>
                    </GlassCard>
                  </div>

                  {/* Artist Content Management */}
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold px-2">Gestion du Contenu</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <GlassCard className="p-6 space-y-4">
                        <h4 className="font-bold text-white/60 uppercase text-xs tracking-widest">Mes Musiques</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {tracks.filter(t => t.artist_id === currentUser.id).map(track => (
                            <div key={track.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl group">
                              <img src={track.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{track.title}</p>
                                <p className="text-[10px] text-white/40">{track.album_title || 'Single'}</p>
                              </div>
                              <button 
                                onClick={() => handleDeleteTrack(track.id)}
                                className="p-2 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </GlassCard>

                      <GlassCard className="p-6 space-y-4">
                        <h4 className="font-bold text-white/60 uppercase text-xs tracking-widest">Mes Albums</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {albums.filter(a => a.artist_id === currentUser.id).map(album => (
                            <div key={album.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl group">
                              <img src={album.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{album.title}</p>
                                <p className="text-[10px] text-white/40">{tracks.filter(t => t.album_id === album.id).length} titres</p>
                              </div>
                              <button 
                                onClick={() => handleDeleteAlbum(album.id)}
                                className="p-2 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </GlassCard>

                      <GlassCard className="p-6 space-y-4">
                        <h4 className="font-bold text-white/60 uppercase text-xs tracking-widest">Mes Posts</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {posts.filter(p => p.artist_id === currentUser.id).map(post => (
                            <div key={post.id} className="p-3 hover:bg-white/5 rounded-xl group space-y-2">
                              <div className="flex justify-between items-start">
                                <p className="text-xs text-white/40">{formatDistanceToNow(new Date(post.created_at))} ago</p>
                                <button 
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <p className="text-sm line-clamp-2 text-white/80">{post.content}</p>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'admin' && currentUser?.role === 'admin' && (
                <motion.div 
                  key="admin"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GlassCard className="p-6 space-y-4 md:col-span-1">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Settings size={20} /> Paramètres App
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div>
                            <p className="font-bold">Mode Abonnement</p>
                            <p className="text-xs text-white/40">Activer/Désactiver la taxe</p>
                          </div>
                          <button 
                            onClick={() => handleUpdateSettings('subscription_mode', settings.subscription_mode === 'free' ? 'paid' : 'free')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                              settings.subscription_mode === 'paid' ? "bg-yellow-500 text-black" : "bg-white/10 text-white"
                            )}
                          >
                            {settings.subscription_mode === 'paid' ? "PAYANT" : "GRATUIT"}
                          </button>
                        </div>
                      </div>
                    </GlassCard>

                    <div className="md:col-span-2 space-y-6">
                      <h2 className="text-2xl font-bold px-2">Gestion des Utilisateurs</h2>
                      <GlassCard>
                        <table className="w-full text-left">
                      <thead>
                        <tr className="border-bottom border-white/10 text-white/40 text-xs uppercase tracking-widest">
                          <th className="p-4">Utilisateur</th>
                          <th className="p-4">Rôle</th>
                          <th className="p-4">Abonnement</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map(user => (
                          <tr key={user.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                <div>
                                  <p className="font-medium">{user.username} <span className="text-white/20 text-xs">#{user.id}</span></p>
                                  <p className="text-xs text-white/40">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full border",
                                user.role === 'admin' ? "border-purple-500 text-purple-400 bg-purple-500/10" :
                                user.role === 'artist' ? "border-blue-500 text-blue-400 bg-blue-500/10" :
                                "border-white/20 text-white/60"
                              )}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <button 
                                onClick={() => handleUpdateSubscription(user.id, !user.has_subscription)}
                                className={cn(
                                  "text-xs px-3 py-1 rounded-full border transition-all",
                                  user.has_subscription ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-white/10 text-white/20 hover:border-white/30"
                                )}
                              >
                                {user.has_subscription ? "Payé" : "Non payé"}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                {user.id !== currentUser.id && (
                                  <button 
                                    onClick={() => handleBan(user.id, !user.is_banned)}
                                    className={cn(
                                      "px-3 py-1 rounded-full text-xs font-bold transition-colors",
                                      user.is_banned ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    )}
                                  >
                                    {user.is_banned ? "Débannir" : "Bannir"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}
            </AnimatePresence>
          </div>
        </main>

        {/* Player Bar */}
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-2 lg:px-4 z-50">
          <GlassCard className="p-3 lg:p-4 flex items-center gap-4 lg:gap-6 shadow-2xl border-white/20">
            <div className="flex items-center gap-3 lg:gap-4 w-1/2 lg:w-1/3">
              {currentTrack ? (
                <>
                  <img src={currentTrack.cover_url} alt="" className="w-10 h-10 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl shadow-lg" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm lg:text-base truncate">{currentTrack.title}</h4>
                    <p className="text-[10px] lg:text-xs text-white/50 truncate">{currentTrack.artist_name}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl bg-white/5 flex items-center justify-center">
                    <Music size={20} className="text-white/20" />
                  </div>
                  <p className="text-xs lg:text-sm text-white/20">Aucune lecture</p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center gap-1 lg:gap-2">
              <div className="flex items-center gap-4 lg:gap-6">
                <button className="hidden lg:block text-white/40 hover:text-white transition-colors"><SkipBack size={24} /></button>
                <button 
                  onClick={togglePlay}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button className="text-white/40 hover:text-white transition-colors"><SkipForward size={24} /></button>
              </div>
              <div className="w-full flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-8 text-right">{formatTime(currentTime)}</span>
                <div className="flex-1 relative h-1 bg-white/10 rounded-full group">
                  <input 
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/40 w-8">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="hidden lg:flex w-1/3 justify-end items-center gap-4">
              {currentTrack && (
                <button 
                  onClick={() => toggleLike(currentTrack.id)}
                  className={cn("transition-colors", likedTrackIds.includes(currentTrack.id) ? "text-pink-500" : "text-white/40 hover:text-white")}
                >
                  <Heart size={20} fill={likedTrackIds.includes(currentTrack.id) ? "currentColor" : "none"} />
                </button>
              )}
              <div className="flex items-center gap-2 text-white/40">
                <Library size={20} />
                <span className="text-xs font-mono">{currentTrack?.duration || "0:00"}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Bottom Navigation for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
          <GlassCard className="flex items-center justify-around p-2 border-white/20 shadow-2xl">
            <button 
              id="nav-home"
              onClick={() => setActiveTab('home')}
              className={cn("p-3 rounded-2xl transition-all", activeTab === 'home' ? "bg-white/10 text-white" : "text-white/40")}
            >
              <Home size={24} />
            </button>
            <button 
              id="nav-search"
              onClick={() => setActiveTab('search')}
              className={cn("p-3 rounded-2xl transition-all", activeTab === 'search' ? "bg-white/10 text-white" : "text-white/40")}
            >
              <Search size={24} />
            </button>
            <button 
              id="nav-music"
              onClick={() => setActiveTab('music')}
              className={cn("p-3 rounded-2xl transition-all", activeTab === 'music' ? "bg-white/10 text-white" : "text-white/40")}
            >
              <Music size={24} />
            </button>
            <button 
              id="nav-history"
              onClick={() => setActiveTab('history')}
              className={cn("p-3 rounded-2xl transition-all", activeTab === 'history' ? "bg-white/10 text-white" : "text-white/40")}
            >
              <History size={24} />
            </button>
            <button 
              id="nav-profile"
              onClick={() => setActiveTab('profile')}
              className={cn("p-3 rounded-2xl transition-all", activeTab === 'profile' ? "bg-white/10 text-white" : "text-white/40")}
            >
              <User size={24} />
            </button>
            {(currentUser?.role === 'artist' || currentUser?.role === 'admin') && (
              <button 
                id="nav-tools"
                onClick={() => setActiveTab(currentUser.role === 'artist' ? 'artist-tools' : 'admin')}
                className={cn("p-3 rounded-2xl transition-all", (activeTab === 'artist-tools' || activeTab === 'admin') ? "bg-white/10 text-white" : "text-white/40")}
              >
                {currentUser.role === 'artist' ? <Plus size={24} /> : <Shield size={24} />}
              </button>
            )}
          </GlassCard>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
