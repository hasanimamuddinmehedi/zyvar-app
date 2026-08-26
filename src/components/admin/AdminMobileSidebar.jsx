import {
  useState,
  useEffect,
  useRef,
} from "react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  FaChartPie,
  FaBoxOpen,
  FaShoppingBag,
  FaCog,
  FaPlus,
  FaClipboardList,
  FaHandshake,
  FaTicketAlt,
  FaUsers,
  FaSignOutAlt,
  FaBell,
  FaSearch,
  FaTimes,
  FaUser,
  FaShoppingCart,
  FaChartBar,
} from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHABLE SECTIONS — same set used in AdminNavbar, kept in sync
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
// MOCK NOTIFICATION HOOK — mirrors AdminNavbar's hook; replace with real data
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

export default function AdminMobileSidebar() {

  const [open,
    setOpen] =
    useState(false);

  const navigate =
    useNavigate();

  // ── Search / notification state (mirrors AdminNavbar) ─────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [mobileSearch, setMobileSearch]   = useState(false);
  const [notifOpen, setNotifOpen]         = useState(false);

  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  const searchRef = useRef(null);
  const notifRef  = useRef(null);

  const navClass =
    ({ isActive }) =>

      `flex items-center gap-4 w-full px-5 py-4 rounded-2xl transition duration-300 ${
        isActive
          ? "bg-[#C6922B] text-black font-black"
          : "border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B]"
      }`;

  const goHome = () => {
    setOpen(false);
    navigate("/");
  };

  const handleLogout = () => {
    // Adjust this to match your actual auth/session logic
    localStorage.removeItem("token");
    setOpen(false);
    navigate("/login");
  };

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

  return (

    <>

      {/* TOPBAR */}
      <div
        className="
          lg:hidden
          fixed
          top-0
          left-0
          right-0
          z-50
          h-20
          border-b
          border-white/10
          bg-[#0B0B0B]/95
          backdrop-blur-2xl
          flex
          items-center
          justify-between
          px-5
        "
      >

        {/* MENU BUTTON */}
        <button
          onClick={() =>
            setOpen(true)
          }
          className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-xl hover:border-[#C6922B] transition duration-300"
        >
          ☰
        </button>

        {/* LOGO (links to home) */}
        <div
          onClick={goHome}
          role="button"
          tabIndex={0}
          className="flex items-center gap-3 cursor-pointer"
        >

          <img
            src="https://res.cloudinary.com/dhppdatrl/image/upload/v1778734083/w3ehnytbwrugrxptj9py.png"
            alt="ZYVAR Logo"
            className="w-9 h-9 rounded-xl object-contain"
          />

          <div className="text-center">

            <h1 className="text-2xl font-black tracking-[0.25em] text-[#C6922B] leading-none">
              ZYVAR
            </h1>

          </div>

        </div>

        {/* BACK BUTTON */}
        <button
          onClick={() =>
            navigate("/profile")
          }
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#C6922B] hover:border-[#C6922B] transition duration-300"
        >
          Back
        </button>

      </div>

      {/* ── UTILITY ROW: SEARCH / NOTIFICATIONS / PROFILE (mobile) ─────────── */}
      <div
        className="
          lg:hidden
          fixed
          top-20
          left-0
          right-0
          z-40
          h-16
          border-b
          border-white/10
          bg-[#0B0B0B]/95
          backdrop-blur-2xl
          flex
          items-center
          justify-end
          gap-3
          px-5
        "
      >

        {/* SEARCH TOGGLE */}
        <div ref={searchRef} className="relative">
          <button
            onClick={() => setMobileSearch((v) => !v)}
            aria-label="Toggle search"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] transition duration-300"
          >
            {mobileSearch ? <FaTimes /> : <FaSearch />}
          </button>
        </div>

        {/* NOTIFICATION */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={`Notifications, ${unreadCount} unread`}
            className="relative w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] transition duration-300"
          >
            <FaBell />
            {unreadCount > 0 && (
              <span className="
                absolute -top-1 -right-1
                min-w-[18px] h-[18px]
                rounded-full
                bg-[#C6922B]
                text-black text-[9px] font-black
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
              absolute top-12 right-0
              w-72
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

        {/* PROFILE */}
        <button
          onClick={() => navigate("/profile")}
          aria-label="Profile"
          className="w-10 h-10 rounded-xl bg-[#C6922B] text-black flex items-center justify-center hover:scale-105 transition duration-300"
        >
          <FaUser />
        </button>

      </div>

      {/* MOBILE SEARCH BAR (slides in below utility row) */}
      {mobileSearch && (
        <div
          ref={searchRef}
          className="
            lg:hidden
            fixed
            top-36
            left-0
            right-0
            z-40
            px-5 pb-4 pt-3
            border-b border-white/10
            bg-[#0B0B0B]/95
            backdrop-blur-2xl
          "
        >
          <div className="relative">
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

      {/* DRAWER */}
      <div
        className={`lg:hidden fixed inset-0 z-[60] transition-all duration-300 ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0"
        }`}
      >

        {/* OVERLAY */}
        <div
          onClick={() =>
            setOpen(false)
          }
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* SIDEBAR */}
        <div
          className={`mobile-sidebar-inner absolute left-0 top-0 h-full w-72 bg-[#111111]/95 backdrop-blur-2xl border-r border-white/10 p-6 transition-transform duration-300 flex flex-col justify-between overflow-y-auto scrollbar-none ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >

          {/* Hides scrollbar in WebKit (Chrome, Safari) */}
          <style>{`
            .mobile-sidebar-inner::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* TOP */}
          <div>

            {/* HEADER (logo + text link to home) */}
            <div className="flex justify-between items-center mb-12">

              <div
                onClick={goHome}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 cursor-pointer"
              >

                <img
                  src="https://res.cloudinary.com/dhppdatrl/image/upload/v1778734083/w3ehnytbwrugrxptj9py.png"
                  alt="ZYVAR Logo"
                  className="w-12 h-12 rounded-2xl object-contain"
                />

                <div>

                  <h2 className="text-3xl font-black tracking-[0.25em] text-[#C6922B]">
                    ZYVAR
                  </h2>

                  <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] mt-2">
                    Mobile Admin
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setOpen(false)
                }
                className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 text-2xl hover:border-[#C6922B] transition duration-300"
              >
                ✕
              </button>

            </div>

            {/* NAVIGATION */}
            <div className="space-y-4">

              {/* 1. Dashboard */}
              <NavLink
                to="/admin/dashboard"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaChartPie />
                Dashboard
              </NavLink>

              {/* 2. Upload Product */}
              <NavLink
                to="/admin/upload"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaPlus />
                Upload Product
              </NavLink>

              {/* 3. Products */}
              <NavLink
                to="/admin/products"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaBoxOpen />
                Products
              </NavLink>

              {/* 4. Orders */}
              <NavLink
                to="/admin/orders"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaShoppingBag />
                Orders
              </NavLink>

              {/* 5. Product Requests */}
              <NavLink
                to="/admin/product-requests"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaClipboardList />
                Product Requests
              </NavLink>

              {/* 6. Partner Applications */}
              <NavLink
                to="/admin/partner-applications"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaHandshake />
                Partner Applications
              </NavLink>

              {/* 7. Partner Coupons */}
              <NavLink
                to="/admin/partner-coupons"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaTicketAlt />
                Partner Coupons
              </NavLink>

              {/* 8. Users */}
              <NavLink
                to="/admin/users"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaUsers />
                Users
              </NavLink>

              {/* 9. Settings */}
              <NavLink
                to="/admin/settings"
                onClick={() =>
                  setOpen(false)
                }
                className={navClass}
              >
                <FaCog />
                Settings
              </NavLink>

            </div>

          </div>

          {/* FOOTER: LOG OUT */}
          <div className="mt-10">

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 text-red-400 font-black hover:border-red-400 hover:bg-red-400/10 transition duration-300"
            >
              <FaSignOutAlt />
              Log Out
            </button>

          </div>

        </div>

      </div>

    </>
  );
}