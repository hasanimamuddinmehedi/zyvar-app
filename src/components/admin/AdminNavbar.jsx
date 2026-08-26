import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaSearch, FaTimes, FaUser, FaBoxOpen, FaShoppingCart, FaChartBar, FaCog } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHABLE SECTIONS — add/remove entries to match your real admin routes
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_SECTIONS = [
  { label: "Dashboard Overview",    path: "/admin",              icon: <FaChartBar />,   keywords: ["home", "overview", "stats", "summary"] },
  { label: "Users",                 path: "/admin/users",        icon: <FaUser />,       keywords: ["user", "member", "account", "people"] },
  { label: "Orders",                path: "/admin/orders",       icon: <FaShoppingCart />, keywords: ["order", "purchase", "transaction", "sale"] },
  { label: "Products",              path: "/admin/products",     icon: <FaBoxOpen />,    keywords: ["product", "item", "inventory", "stock"] },
  { label: "Analytics",             path: "/admin/analytics",    icon: <FaChartBar />,   keywords: ["analytics", "report", "chart", "graph", "metric"] },
  { label: "Settings",              path: "/admin/settings",     icon: <FaCog />,        keywords: ["setting", "config", "preference", "option"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK NOTIFICATION HOOK — replace with real API / WebSocket / polling logic
// ─────────────────────────────────────────────────────────────────────────────
function useNotifications() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "order",
      message: "New order #1042 received",
      path: "/admin/orders",
      time: "2 min ago",
      read: false,
    },
    {
      id: 2,
      type: "user",
      message: "New user registered: john@example.com",
      path: "/admin/users",
      time: "10 min ago",
      read: false,
    },
    {
      id: 3,
      type: "product",
      message: "Product 'Headphones X' is low on stock",
      path: "/admin/products",
      time: "1 hr ago",
      read: true,
    },
  ]);

  // Simulate a new notification arriving every 30 seconds (dev preview)
  // Remove or replace this with your real data subscription
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications((prev) => [
        {
          id: Date.now(),
          type: "order",
          message: `New order #${1000 + Math.floor(Math.random() * 999)} received`,
          path: "/admin/orders",
          time: "just now",
          read: false,
        },
        ...prev,
      ]);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markOneRead = (id) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  return { notifications, unreadCount, markAllRead, markOneRead };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminNavbar() {
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState([]);
  const [searchOpen, setSearchOpen]         = useState(false);
  const [mobileSearch, setMobileSearch]     = useState(false);

  // Notification state
  const [notifOpen, setNotifOpen]           = useState(false);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  // Refs for outside-click handling
  const searchRef = useRef(null);
  const notifRef  = useRef(null);

  // ── Search logic ───────────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const filtered = ADMIN_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q))
    );
    setSearchResults(filtered);
    setSearchOpen(true);
  }, [searchQuery]);

  const handleSearchSelect = (path) => {
    navigate(path);
    setSearchQuery("");
    setSearchOpen(false);
    setMobileSearch(false);
  };

  // ── Outside-click closes dropdowns ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Keyboard: Escape closes everything ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setMobileSearch(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const notifTypeIcon = (type) => {
    const map = {
      order:   <FaShoppingCart className="text-[#C6922B]" />,
      user:    <FaUser         className="text-blue-400" />,
      product: <FaBoxOpen      className="text-red-400" />,
    };
    return map[type] ?? <FaBell className="text-gray-400" />;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <header
      className="
        hidden lg:flex
        fixed
        top-0
        left-[280px]
        right-0
        z-40
        h-24
        border-b border-white/10
        bg-[#0B0B0B]/90
        backdrop-blur-2xl
      "
    >
      <div className="h-full px-4 md:px-8 flex items-center justify-between gap-6 w-full">

        {/* ── LEFT ──────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[#C6922B] uppercase tracking-[0.3em] text-xs mb-2">
            Admin Dashboard
          </p>
          <h1 className="text-2xl md:text-3xl font-black">
            Welcome Back
          </h1>
        </div>

        {/* ── RIGHT ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">

          {/* ── SEARCH (desktop) ─────────────────────────────────────────── */}
          <div ref={searchRef} className="relative hidden md:block">
            <div className="flex items-center gap-3 px-5 h-14 rounded-2xl border border-white/10 bg-white/5 focus-within:border-[#C6922B] transition">
              <FaSearch className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setSearchOpen(true)}
                placeholder="Search..."
                aria-label="Search admin sections"
                className="bg-transparent outline-none text-sm placeholder:text-gray-500 w-44"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  className="text-gray-500 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {searchOpen && (
              <div className="absolute top-16 left-0 w-72 rounded-2xl border border-white/10 bg-[#111111] shadow-xl overflow-hidden z-50">
                {searchResults.length > 0 ? (
                  <>
                    <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-gray-500">
                      Results
                    </p>
                    {searchResults.map((result) => (
                      <button
                        key={result.path}
                        onClick={() => handleSearchSelect(result.path)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition"
                      >
                        <span className="text-[#C6922B]">{result.icon}</span>
                        <span className="text-sm text-white">{result.label}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-4 py-4 text-sm text-gray-500">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── SEARCH ICON (mobile toggle) ──────────────────────────────── */}
          <button
            className="
              md:hidden
              w-14 h-14 rounded-2xl
              border border-white/10 bg-white/5
              flex items-center justify-center
              hover:border-[#C6922B] transition
            "
            aria-label="Toggle search"
            onClick={() => setMobileSearch((v) => !v)}
          >
            {mobileSearch ? <FaTimes /> : <FaSearch />}
          </button>

          {/* ── NOTIFICATION ─────────────────────────────────────────────── */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`Notifications, ${unreadCount} unread`}
              className="
                relative
                w-14 h-14 rounded-2xl
                border border-white/10 bg-white/5
                flex items-center justify-center
                hover:border-[#C6922B] transition
              "
            >
              <FaBell />
              {unreadCount > 0 && (
                <span className="
                  absolute -top-1 -right-1
                  min-w-[20px] h-5
                  rounded-full
                  bg-[#C6922B]
                  text-black text-[10px] font-black
                  flex items-center justify-center
                  px-1
                ">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {notifOpen && (
              <div className="
                absolute top-16 right-0
                w-80
                rounded-2xl
                border border-white/10
                bg-[#111111]
                shadow-xl
                overflow-hidden
                z-50
              ">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <p className="text-sm font-black">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-[#C6922B] uppercase tracking-widest hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500 text-center">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => {
                          markOneRead(notif.id);
                          setNotifOpen(false);
                          navigate(notif.path);
                        }}
                        className={`
                          w-full flex items-start gap-3 px-4 py-3
                          hover:bg-white/5 text-left transition
                          ${!notif.read ? "bg-white/[0.03]" : ""}
                        `}
                      >
                        <span className="mt-0.5 flex-shrink-0">
                          {notifTypeIcon(notif.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${!notif.read ? "text-white" : "text-gray-400"}`}>
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{notif.time}</p>
                        </div>
                        {!notif.read && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-[#C6922B] flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-white/5 px-4 py-3">
                  <button
                    onClick={() => { setNotifOpen(false); navigate("/admin/notifications"); }}
                    className="text-xs text-[#C6922B] hover:underline"
                  >
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── PROFILE ──────────────────────────────────────────────────── */}
          <button
            onClick={() => navigate("/profile")}
            className="
              px-6 h-14 rounded-2xl
              bg-[#C6922B] text-black font-black
              hover:scale-105 transition
            "
          >
            Profile
          </button>

        </div>
      </div>

      {/* ── MOBILE SEARCH BAR (slides in below header) ───────────────────── */}
      {mobileSearch && (
        <div ref={searchRef} className="
          md:hidden
          px-4 pb-4
          border-t border-white/10
          bg-[#0B0B0B]/95
        ">
          <div className="relative mt-3">
            <div className="flex items-center gap-3 px-4 h-12 rounded-xl border border-white/10 bg-white/5 focus-within:border-[#C6922B] transition">
              <FaSearch className="text-gray-500 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setSearchOpen(true)}
                placeholder="Search..."
                aria-label="Search admin sections"
                className="bg-transparent outline-none text-sm placeholder:text-gray-500 flex-1"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  className="text-gray-500 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Mobile search results */}
            {searchOpen && (
              <div className="absolute top-14 left-0 right-0 rounded-xl border border-white/10 bg-[#111111] shadow-xl overflow-hidden z-50">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.path}
                      onClick={() => handleSearchSelect(result.path)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition"
                    >
                      <span className="text-[#C6922B]">{result.icon}</span>
                      <span className="text-sm text-white">{result.label}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-4 text-sm text-gray-500">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}