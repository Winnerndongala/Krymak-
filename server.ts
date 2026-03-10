import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("krymak.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'fan',
    is_banned INTEGER DEFAULT 0,
    has_subscription INTEGER DEFAULT 0,
    avatar_url TEXT,
    bio TEXT,
    phone_number TEXT
  );

  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist_id INTEGER,
    cover_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(artist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist_id INTEGER,
    album_id INTEGER,
    url TEXT,
    cover_url TEXT,
    duration TEXT,
    FOREIGN KEY(artist_id) REFERENCES users(id),
    FOREIGN KEY(album_id) REFERENCES albums(id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(artist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('subscription_mode', 'free');

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    track_id INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(track_id) REFERENCES tracks(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    content TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    track_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, track_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(track_id) REFERENCES tracks(id)
  );
`);

// Migration: Add password to users if it doesn't exist
const userInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
const hasPassword = userInfo.some(col => col.name === 'password');
if (!hasPassword) {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT");
}

// Migration: Add album_id to tracks if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(tracks)").all() as any[];
const hasAlbumId = tableInfo.some(col => col.name === 'album_id');
if (!hasAlbumId) {
  db.exec("ALTER TABLE tracks ADD COLUMN album_id INTEGER REFERENCES albums(id)");
}

// Seed data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)").run(
    "Admin", "admin@krymak.com", "admin123", "admin", "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
  );
  db.prepare("INSERT INTO users (username, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)").run(
    "ArtistOne", "artist1@krymak.com", "artist123", "artist", "https://api.dicebear.com/7.x/avataaars/svg?seed=artist1"
  );
  db.prepare("INSERT INTO users (username, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)").run(
    "FanOne", "fan1@krymak.com", "fan123", "fan", "https://api.dicebear.com/7.x/avataaars/svg?seed=fan1"
  );

  // Seed some tracks
  db.prepare("INSERT INTO tracks (title, artist_id, url, cover_url, duration) VALUES (?, ?, ?, ?, ?)").run(
    "Midnight Echoes", 2, "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "https://picsum.photos/seed/music1/400/400", "3:45"
  );
  db.prepare("INSERT INTO tracks (title, artist_id, url, cover_url, duration) VALUES (?, ?, ?, ?, ?)").run(
    "Neon Dreams", 2, "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "https://picsum.photos/seed/music2/400/400", "4:12"
  );

  // Seed some posts
  db.prepare("INSERT INTO posts (artist_id, content) VALUES (?, ?)").run(
    2, "Just dropped my new single 'Midnight Echoes'! Hope you guys love it. 🎵✨"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  app.post("/api/users/:id/ban", (req, res) => {
    const { id } = req.params;
    const { is_banned } = req.body;
    db.prepare("UPDATE users SET is_banned = ? WHERE id = ?").run(is_banned ? 1 : 0, id);
    res.json({ success: true });
  });

  app.post("/api/users/:id/subscription", (req, res) => {
    const { id } = req.params;
    const { has_subscription } = req.body;
    db.prepare("UPDATE users SET has_subscription = ? WHERE id = ?").run(has_subscription ? 1 : 0, id);
    res.json({ success: true });
  });

  app.post("/api/users/:id/profile", (req, res) => {
    const { id } = req.params;
    const { bio, avatar_url, username } = req.body;
    db.prepare("UPDATE users SET bio = ?, avatar_url = ?, username = ? WHERE id = ?").run(bio, avatar_url, username, id);
    res.json({ success: true });
  });

  app.get("/api/albums", (req, res) => {
    const albums = db.prepare(`
      SELECT albums.*, users.username as artist_name 
      FROM albums 
      JOIN users ON albums.artist_id = users.id
    `).all();
    res.json(albums);
  });

  app.post("/api/albums", (req, res) => {
    const { artist_id, title, cover_url } = req.body;
    const result = db.prepare("INSERT INTO albums (artist_id, title, cover_url) VALUES (?, ?, ?)").run(artist_id, title, cover_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/tracks", (req, res) => {
    const { artist_id, title, url, cover_url, duration, album_id } = req.body;
    const result = db.prepare("INSERT INTO tracks (artist_id, title, url, cover_url, duration, album_id) VALUES (?, ?, ?, ?, ?, ?)").run(artist_id, title, url, cover_url, duration, album_id || null);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/tracks", (req, res) => {
    const tracks = db.prepare(`
      SELECT tracks.*, users.username as artist_name, albums.title as album_title
      FROM tracks 
      JOIN users ON tracks.artist_id = users.id
      LEFT JOIN albums ON tracks.album_id = albums.id
    `).all();
    res.json(tracks);
  });

  app.get("/api/posts", (req, res) => {
    const posts = db.prepare(`
      SELECT posts.*, users.username as artist_name, users.avatar_url as artist_avatar
      FROM posts 
      JOIN users ON posts.artist_id = users.id
      ORDER BY created_at DESC
    `).all();
    
    const postsWithComments = posts.map((post: any) => {
      const comments = db.prepare(`
        SELECT comments.*, users.username, users.avatar_url
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE post_id = ?
        ORDER BY created_at ASC
      `).all(post.id);
      return { ...post, comments };
    });

    res.json(postsWithComments);
  });

  app.post("/api/posts", (req, res) => {
    const { artist_id, content } = req.body;
    const result = db.prepare("INSERT INTO posts (artist_id, content) VALUES (?, ?)").run(artist_id, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/comments", (req, res) => {
    const { post_id, user_id, content } = req.body;
    const result = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?)").run(post_id, user_id, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/history/:userId", (req, res) => {
    const { userId } = req.params;
    const history = db.prepare(`
      SELECT history.*, tracks.title, tracks.cover_url, users.username as artist_name
      FROM history
      JOIN tracks ON history.track_id = tracks.id
      JOIN users ON tracks.artist_id = users.id
      WHERE history.user_id = ?
      ORDER BY played_at DESC
      LIMIT 50
    `).all(userId);
    res.json(history);
  });

  app.post("/api/history", (req, res) => {
    const { user_id, track_id } = req.body;
    db.prepare("INSERT INTO history (user_id, track_id) VALUES (?, ?)").run(user_id, track_id);
    res.json({ success: true });
  });

  app.get("/api/notifications/:userId", (req, res) => {
    const { userId } = req.params;
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(notifications);
  });

  app.post("/api/notifications/read/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.delete("/api/tracks/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tracks WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.delete("/api/albums/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM albums WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/stats/artist/:artistId", (req, res) => {
    const { artistId } = req.params;
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT history.user_id) as unique_listeners,
        COUNT(history.id) as total_plays
      FROM history
      JOIN tracks ON history.track_id = tracks.id
      WHERE tracks.artist_id = ?
    `).get(artistId);
    res.json(stats);
  });

  app.delete("/api/posts/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/register", (req, res) => {
    const { username, email, password, role } = req.body;
    try {
      const avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
      const result = db.prepare("INSERT INTO users (username, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)").run(
        username, email || `${username}@krymak.local`, password, role || 'fan', avatar_url
      );
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      res.json(user);
    } catch (error: any) {
      if (error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Nom d'utilisateur ou email déjà utilisé" });
      } else {
        res.status(500).json({ error: "Erreur lors de l'inscription" });
      }
    }
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    }
  });

  app.post("/api/likes", (req, res) => {
    const { user_id, track_id } = req.body;
    try {
      db.prepare("INSERT INTO likes (user_id, track_id) VALUES (?, ?)").run(user_id, track_id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Already liked" });
    }
  });

  app.delete("/api/likes/:userId/:trackId", (req, res) => {
    const { userId, trackId } = req.params;
    db.prepare("DELETE FROM likes WHERE user_id = ? AND track_id = ?").run(userId, trackId);
    res.json({ success: true });
  });

  app.get("/api/likes/:userId", (req, res) => {
    const { userId } = req.params;
    const likes = db.prepare("SELECT track_id FROM likes WHERE user_id = ?").all(userId);
    res.json(likes.map((l: any) => l.track_id));
  });

  app.get("/api/search", (req, res) => {
    const { q } = req.query;
    const query = `%${q}%`;
    const tracks = db.prepare(`
      SELECT tracks.*, users.username as artist_name, albums.title as album_title
      FROM tracks 
      JOIN users ON tracks.artist_id = users.id
      LEFT JOIN albums ON tracks.album_id = albums.id
      WHERE tracks.title LIKE ? OR users.username LIKE ?
    `).all(query, query);
    
    const artists = db.prepare(`
      SELECT id, username, avatar_url, bio FROM users 
      WHERE role = 'artist' AND username LIKE ?
    `).all(query);

    res.json({ tracks, artists });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from dist
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
