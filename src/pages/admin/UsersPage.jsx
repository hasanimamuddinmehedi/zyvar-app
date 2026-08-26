import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiChevronRight,
  FiMoreVertical,
  FiEdit2,
  FiEye,
  FiLock,
  FiUserCheck,
  FiUserX,
  FiTrash2,
  FiUsers,
  FiShield,
  FiAlertTriangle,
  FiX,
  FiCheck,
  FiCheckCircle,
  FiXCircle,
  FiLoader,
  FiLink,
  FiUpload,
  FiEyeOff,
  FiRefreshCw,
  FiSlash,
  FiMail,
  FiPhone,
  FiCalendar,
  FiCopy,
  FiUser,
  FiGitMerge,
  FiInbox,
} from "react-icons/fi";

// Adjust this import path if your project's Firebase config file lives elsewhere.
// It must export an initialized `auth` (Firebase Auth) and `db` (Firestore) instance.
import { auth, db } from "../../firebase/firebase";
import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

// Admin status is defined by an email allowlist, mirrored exactly by
// isAdminEmail() in firestore.rules. This is the SAME list the security
// rules use to decide who isAdmin() — the two must stay in sync. Adjust
// this import path if adminCheck.js lives elsewhere in your project.
// NOTE: users/{uid}.role in Firestore is NOT the source of truth for
// admin access — it only distinguishes "partner" vs "user" for everyone
// else. Do not resolve admin status from that field.
import { ADMIN_EMAILS } from "../../utils/adminCheck";

/* ------------------------------------------------------------------------ */
/* Design tokens                                                            */
/* ------------------------------------------------------------------------ */

const COLORS = {
  bg: "#0B0B0B",
  card: "#151515",
  border: "#292929",
  gold: "#D4AF37",
  white: "#FFFFFF",
  muted: "#9CA3AF",
  danger: "#B91C1C",
  dangerText: "#F87171",
};

const ROLES = ["admin", "partner", "user"];
const STATUSES = ["active", "disabled", "suspended"];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "admins", label: "Admins" },
  { id: "partners", label: "Partners" },
  { id: "users", label: "Users" },
  { id: "active", label: "Active" },
  { id: "disabled", label: "Disabled" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
  { id: "duplicates", label: "Duplicate Emails" },
];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "nameAsc", label: "Name A-Z" },
  { id: "nameDesc", label: "Name Z-A" },
  { id: "emailAsc", label: "Email A-Z" },
  { id: "emailDesc", label: "Email Z-A" },
];

const EDITABLE_FIELDS = [
  "name",
  "email",
  "phone",
  "dateOfBirth",
  "gender",
  "address",
  "city",
  "country",
  "postalCode",
  "photoURL",
  "bio",
];

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatDate(value) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function getInitials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function getPasswordStrength(pwd) {
  if (!pwd) return { label: "", score: 0 };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  return { label: labels[Math.min(score, 5)], score: Math.min(score, 5) };
}

/** Groups raw Firestore user docs by normalized email so duplicate accounts
 *  render as a single row. Documents already marked `merged: true` (folded
 *  into another primary account by a previous merge) are excluded from the
 *  active list — they're kept in Firestore for audit history only. */
function groupUsersByEmail(users) {
  const map = new Map();
  const noEmail = [];

  users.forEach((u) => {
    if (u.merged) return;
    const email = normalizeEmail(u.email);
    if (!email) {
      noEmail.push(u);
      return;
    }
    if (!map.has(email)) map.set(email, []);
    map.get(email).push(u);
  });

  const groups = [];
  map.forEach((accounts, email) => {
    const sorted = [...accounts].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    groups.push({
      key: email,
      email,
      accounts: sorted,
      primary: sorted[0],
      isDuplicate: sorted.length > 1,
    });
  });
  noEmail.forEach((u) => {
    groups.push({ key: u.uid, email: null, accounts: [u], primary: u, isDuplicate: false });
  });

  return groups;
}

function matchesSearch(group, term) {
  if (!term) return true;
  const q = term.trim().toLowerCase();
  return group.accounts.some((a) => {
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q) ||
      (a.uid || "").toLowerCase().includes(q) ||
      (a.role || "").toLowerCase().includes(q)
    );
  });
}

function matchesFilter(group, filter) {
  const p = group.primary;
  switch (filter) {
    case "admins":
      return p.role === "admin";
    case "partners":
      return p.role === "partner";
    case "users":
      return !p.role || p.role === "user";
    case "active":
      return !p.status || p.status === "active";
    case "disabled":
      return p.status === "disabled" || p.status === "suspended";
    case "verified":
      return !!p.emailVerified;
    case "unverified":
      return !p.emailVerified;
    case "duplicates":
      return group.isDuplicate;
    default:
      return true;
  }
}

function sortGroups(groups, sortId) {
  const list = [...groups];
  switch (sortId) {
    case "oldest":
      return list.sort((a, b) => toMillis(a.primary.createdAt) - toMillis(b.primary.createdAt));
    case "nameAsc":
      return list.sort((a, b) => (a.primary.name || "").localeCompare(b.primary.name || ""));
    case "nameDesc":
      return list.sort((a, b) => (b.primary.name || "").localeCompare(a.primary.name || ""));
    case "emailAsc":
      return list.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    case "emailDesc":
      return list.sort((a, b) => (b.email || "").localeCompare(a.email || ""));
    case "newest":
    default:
      return list.sort((a, b) => toMillis(b.primary.createdAt) - toMillis(a.primary.createdAt));
  }
}

/* ------------------------------------------------------------------------ */
/* Small reusable UI primitives                                             */
/* ------------------------------------------------------------------------ */

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -16, x: "-50%" }}
          className="fixed top-5 left-1/2 z-[80] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl max-w-[90vw]"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${toast.type === "error" ? COLORS.danger : COLORS.gold}` }}
        >
          {toast.type === "error" ? <FiXCircle color={COLORS.dangerText} size={18} /> : <FiCheckCircle color={COLORS.gold} size={18} />}
          <span className="text-sm" style={{ color: COLORS.white }}>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RoleBadge({ role }) {
  const map = {
    admin: { bg: "rgba(212,175,55,0.15)", color: COLORS.gold, label: "Admin" },
    partner: { bg: "rgba(96,165,250,0.15)", color: "#60A5FA", label: "Partner" },
    user: { bg: "rgba(156,163,175,0.15)", color: COLORS.muted, label: "User" },
  };
  const cfg = map[role] || map.user;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { bg: "rgba(74,222,128,0.15)", color: "#4ADE80", label: "Active" },
    disabled: { bg: "rgba(185,28,28,0.15)", color: COLORS.dangerText, label: "Disabled" },
    suspended: { bg: "rgba(251,191,36,0.15)", color: "#FBBF24", label: "Suspended" },
  };
  const cfg = map[status] || map.active;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#4ADE80" }}>
      <FiCheckCircle size={12} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: COLORS.muted }}>
      <FiXCircle size={12} /> Unverified
    </span>
  );
}

function Avatar({ name, email, photoURL, size = 36 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.gold, fontSize: size * 0.36 }}
    >
      {photoURL ? <img src={photoURL} alt={name || email} className="w-full h-full object-cover" /> : getInitials(name, email)}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-4 sm:p-5"
      style={{ backgroundColor: "rgba(21,21,21,0.85)", border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: COLORS.muted }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent ? "rgba(212,175,55,0.12)" : "#0F0F0F" }}>
          <Icon size={15} color={accent ? COLORS.gold : COLORS.muted} />
        </div>
      </div>
      <span className="text-2xl font-semibold" style={{ color: COLORS.white }}>{value}</span>
    </motion.div>
  );
}

function EmptyState({ loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {loading ? (
        <>
          <FiLoader className="animate-spin mb-3" size={26} color={COLORS.gold} />
          <p className="text-sm" style={{ color: COLORS.muted }}>Loading users…</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}` }}>
            <FiInbox size={22} color={COLORS.muted} />
          </div>
          <p className="text-sm font-medium" style={{ color: COLORS.white }}>No users found</p>
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>Try adjusting your search or filters.</p>
        </>
      )}
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ backgroundColor: "#1D1D1D" }} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl" style={{ border: `1px solid ${COLORS.border}` }}>
          <SkeletonBlock className="h-8 col-span-2" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="block text-sm font-medium mb-1.5" style={{ color: COLORS.muted }}>{children}</label>;
}

function TextInput({ label, value, onChange, type = "text", placeholder = "", isPassword = false }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
          style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
          onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
          onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }}>
            {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
        style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
        onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
        onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
        style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: COLORS.card }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: COLORS.white }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ backgroundColor: checked ? COLORS.gold : "#2E2E2E" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full"
          style={{ backgroundColor: checked ? "#0B0B0B" : COLORS.white, transform: checked ? "translateX(20px)" : "translateX(0px)" }}
        />
      </button>
    </div>
  );
}

/* Generic modal shell used by every dialog in this file */
function ModalShell({ open, onClose, title, subtitle, icon: Icon, iconTone = "gold", maxWidth = "max-w-lg", children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${maxWidth} rounded-2xl flex flex-col max-h-[88vh]`}
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 p-5 sm:p-6" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {Icon && (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: iconTone === "danger" ? "rgba(185,28,28,0.15)" : "rgba(212,175,55,0.15)" }}
                >
                  <Icon size={17} color={iconTone === "danger" ? COLORS.dangerText : COLORS.gold} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold" style={{ color: COLORS.white }}>{title}</h4>
                {subtitle && <p className="text-sm mt-1" style={{ color: COLORS.muted }}>{subtitle}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="shrink-0" style={{ color: COLORS.muted }}>
                <FiX size={18} />
              </button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
            {footer && <div className="p-5 sm:p-6 pt-0 flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
      style={{ color: COLORS.muted, border: `1px solid ${COLORS.border}` }}
    >
      {children}
    </button>
  );
}

function GoldButton({ children, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-opacity"
      style={{ backgroundColor: COLORS.gold, color: "#0B0B0B" }}
    >
      {loading && <FiLoader className="animate-spin" size={14} />}
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-opacity"
      style={{ backgroundColor: COLORS.danger, color: COLORS.white }}
    >
      {loading && <FiLoader className="animate-spin" size={14} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Actions dropdown menu                                                    */
/* ------------------------------------------------------------------------ */
/*
 * This menu is rendered through a React Portal directly into document.body
 * and positioned with `position: fixed` coordinates computed from the
 * trigger button's bounding rect. This fixes two problems with the previous
 * implementation:
 *
 *   1. The desktop table container clips overflow (needed for its rounded
 *      corners), so any absolutely-positioned dropdown living *inside* the
 *      table got visually cut off — most noticeably for rows near the
 *      bottom of the table, where the menu would render "under" the table
 *      and become invisible/unclickable.
 *   2. Rows near the bottom of the viewport (desktop or mobile) would try
 *      to open the menu downward and it would spill off-screen.
 *
 * By portaling to <body> and measuring available space above/below the
 * button, the menu always opens in the direction with more room, stays
 * clamped horizontally within the viewport, and is never clipped by any
 * ancestor's overflow rule.
 */
const MENU_WIDTH = 208; // matches w-52
const MENU_EST_HEIGHT = 300; // rough max height for up to 6 items, used for flip decision
const VIEWPORT_MARGIN = 8;

function ActionsMenu({ group, currentUid, onView, onEdit, onRole, onPassword, onMerge, onToggleStatus, onDelete }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isSelf = group.primary.uid === currentUid;

  const computePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < MENU_EST_HEIGHT && spaceAbove > spaceBelow;

    let left = rect.right - MENU_WIDTH;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));

    if (openUp) {
      setMenuStyle({
        left,
        bottom: Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.top + 8),
        top: undefined,
        maxHeight: Math.max(160, rect.top - VIEWPORT_MARGIN * 2),
        openUp: true,
      });
    } else {
      setMenuStyle({
        left,
        top: rect.bottom + 8,
        bottom: undefined,
        maxHeight: Math.max(160, window.innerHeight - rect.bottom - VIEWPORT_MARGIN * 2),
        openUp: false,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();

    function handleClickOutside(e) {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleReposition() {
      computePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, computePosition]);

  const item = (label, Icon, onClick, tone) => (
    <button
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left rounded-lg transition-colors"
      style={{ color: tone === "danger" ? COLORS.dangerText : COLORS.white }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <Icon size={15} />
      {label}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg"
        style={{ border: `1px solid ${COLORS.border}` }}
        aria-label="Open actions menu"
      >
        <FiMoreVertical size={15} color={COLORS.muted} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && menuStyle && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: menuStyle.openUp ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: menuStyle.openUp ? 6 : -6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="fixed w-52 rounded-xl p-1.5 overflow-y-auto"
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                bottom: menuStyle.bottom,
                maxHeight: menuStyle.maxHeight,
                backgroundColor: "#101010",
                border: `1px solid ${COLORS.border}`,
                boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
                zIndex: 1000,
              }}
            >
              {item("View", FiEye, onView)}
              {item("Edit", FiEdit2, onEdit)}
              {item("Change Role", FiShield, onRole)}
              {item("Set New Password", FiLock, onPassword)}
              {group.isDuplicate && item("Merge Duplicate", FiGitMerge, onMerge)}
              {item(
                group.primary.status === "disabled" ? "Enable Account" : "Disable Account",
                group.primary.status === "disabled" ? FiUserCheck : FiUserX,
                onToggleStatus,
                isSelf ? undefined : group.primary.status === "disabled" ? undefined : "danger"
              )}
              {item("Delete", FiTrash2, onDelete, "danger")}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Main component                                                           */
/* ------------------------------------------------------------------------ */

export default function UsersPage() {
  const [authUser, setAuthUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [rawUsers, setRawUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [viewGroup, setViewGroup] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // { group, account }
  const [passwordTarget, setPasswordTarget] = useState(null); // account
  const [roleTarget, setRoleTarget] = useState(null); // { account, newRole }
  const [statusTarget, setStatusTarget] = useState(null); // { account, newStatus }
  const [deleteTarget, setDeleteTarget] = useState(null); // account
  const [mergeGroup, setMergeGroup] = useState(null); // group

  const showToast = useCallback((type, message) => setToast({ type, message }), []);

  /* --------------------------- Auth + role gate ------------------------- */
  /* Admin status is resolved from the ADMIN_EMAILS allowlist FIRST, since
     that's what firestore.rules' isAdminEmail()/isAdmin() actually checks.
     Only when the signed-in user is NOT on that allowlist do we fall back
     to reading users/{uid}.role from Firestore, which is used solely to
     distinguish "partner" from ordinary "user" accounts — it has never
     been the source of truth for admin access, so it must never gate the
     admin dashboard on its own. This keeps the client's gating logic in
     lockstep with what the backend rules will actually allow, so a real
     admin (per the rules) is never shown "Access Denied" here. */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setCurrentRole(null);
        setAuthLoading(false);
        return;
      }
      setAuthUser(user);

      if (ADMIN_EMAILS.includes(user.email)) {
        setCurrentRole("admin");
        setAuthLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setCurrentRole(snap.exists() ? snap.data().role || "user" : "user");
      } catch (err) {
        console.error("Failed to resolve current user role:", err);
        setCurrentRole("user");
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  /* ------------------------------ Live users list ----------------------- */

  useEffect(() => {
    if (currentRole !== "admin") return;
    setLoadingUsers(true);
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setRawUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        console.error("Failed to load users:", err);
        showToast("error", "Couldn't load users. Check your connection or permissions.");
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, [currentRole, showToast]);

  /* --------------------------------- Derived ----------------------------- */

  const groups = useMemo(() => groupUsersByEmail(rawUsers), [rawUsers]);

  const stats = useMemo(() => {
    const total = groups.length;
    const admins = groups.filter((g) => g.primary.role === "admin").length;
    const partners = groups.filter((g) => g.primary.role === "partner").length;
    const users = groups.filter((g) => !g.primary.role || g.primary.role === "user").length;
    const duplicates = groups.filter((g) => g.isDuplicate).length;
    const disabled = groups.filter((g) => g.primary.status === "disabled" || g.primary.status === "suspended").length;
    return { total, admins, partners, users, duplicates, disabled };
  }, [groups]);

  const visibleGroups = useMemo(() => {
    let list = groups.filter((g) => matchesFilter(g, filter) && matchesSearch(g, searchTerm));
    return sortGroups(list, sortBy);
  }, [groups, filter, searchTerm, sortBy]);

  /* --------------------------------- Actions ------------------------------ */

  const isSelfUid = (uid) => authUser && uid === authUser.uid;

  async function writeUser(uid, data) {
    await setDoc(
      doc(db, "users", uid),
      { ...data, updatedAt: serverTimestamp(), updatedBy: authUser.uid },
      { merge: true }
    );
  }

  const requestRoleChange = (account, newRole) => {
    if (isSelfUid(account.uid) && newRole !== "admin") {
      showToast("error", "You cannot perform this action on your own account.");
      return;
    }
    setRoleTarget({ account, newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleTarget) return;
    setBusy(true);
    try {
      await writeUser(roleTarget.account.uid, { role: roleTarget.newRole });
      showToast("success", "Role changed successfully.");
      setRoleTarget(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't change the role. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const requestStatusToggle = (account) => {
    const newStatus = account.status === "disabled" ? "active" : "disabled";
    if (isSelfUid(account.uid) && newStatus === "disabled") {
      showToast("error", "You cannot perform this action on your own account.");
      return;
    }
    setStatusTarget({ account, newStatus });
  };

  const confirmStatusToggle = async () => {
    if (!statusTarget) return;
    setBusy(true);
    try {
      await writeUser(statusTarget.account.uid, { status: statusTarget.newStatus });
      showToast("success", `Account ${statusTarget.newStatus === "disabled" ? "disabled" : "enabled"} successfully.`);
      setStatusTarget(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't update the account status.");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (account) => {
    if (isSelfUid(account.uid)) {
      showToast("error", "You cannot perform this action on your own account.");
      return;
    }
    setDeleteTarget(account);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "users", deleteTarget.uid));
      showToast("success", "Account deleted successfully.");
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't delete the account.");
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async (account) => {
    if (!account.email) {
      showToast("error", "This account has no email on file.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, account.email);
      showToast("success", "Password reset email sent successfully.");
      setPasswordTarget(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't send the reset email. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveEditedUser = async (fullFormData) => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await writeUser(editTarget.account.uid, fullFormData);
      showToast("success", "User updated successfully.");
      setEditTarget(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't save the changes.");
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async (group, primaryUid) => {
    setBusy(true);
    try {
      const primary = group.accounts.find((a) => a.uid === primaryUid);
      const others = group.accounts.filter((a) => a.uid !== primaryUid);

      const merged = { ...primary };
      const fieldKeys = [
        "name",
        "phone",
        "address",
        "city",
        "country",
        "postalCode",
        "photoURL",
        "bio",
        "dateOfBirth",
        "gender",
      ];
      fieldKeys.forEach((key) => {
        if (!merged[key]) {
          const donor = others.find((o) => o[key]);
          if (donor) merged[key] = donor[key];
        }
      });
      if (!merged.emailVerified) {
        const donor = others.find((o) => o.emailVerified);
        if (donor) merged.emailVerified = true;
      }

      const { uid: _uid, ...mergedFields } = merged;

      await setDoc(
        doc(db, "users", primaryUid),
        {
          ...mergedFields,
          mergedAccountIds: arrayUnion(...others.map((o) => o.uid)),
          updatedAt: serverTimestamp(),
          updatedBy: authUser.uid,
        },
        { merge: true }
      );

      await Promise.all(
        others.map((o) =>
          setDoc(
            doc(db, "users", o.uid),
            { merged: true, mergedInto: primaryUid, updatedAt: serverTimestamp(), updatedBy: authUser.uid },
            { merge: true }
          )
        )
      );

      showToast("success", "Accounts merged successfully.");
      setMergeGroup(null);
    } catch (err) {
      console.error(err);
      showToast("error", "Couldn't merge these accounts.");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------------- */
  /* Guarded states                                                        */
  /* ------------------------------------------------------------------- */

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <FiLoader className="animate-spin" size={26} color={COLORS.gold} />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.muted }}>Please sign in to continue.</p>
      </div>
    );
  }

  if (currentRole !== "admin") {
    // UI-level gating only. This does not replace Firestore Security Rules —
    // the `users` collection must also enforce admin-only access server-side.
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.bg }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(185,28,28,0.12)" }}>
            <FiAlertTriangle size={22} color={COLORS.dangerText} />
          </div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: COLORS.white }}>Access Denied</h2>
          <p className="text-sm" style={{ color: COLORS.muted }}>You do not have permission to manage users.</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- */
  /* Render                                                                */
  /* ------------------------------------------------------------------- */

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.bg }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="px-4 sm:px-8 pt-8 pb-6"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: COLORS.white }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.muted }}>Manage admins, partners and customers</p>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} color={COLORS.muted} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, UID or role…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
                onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
                onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
              />
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setFilterOpen((o) => !o);
                  setSortOpen(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium w-full sm:w-auto justify-center"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.white }}
              >
                <FiFilter size={15} />
                {FILTERS.find((f) => f.id === filter)?.label}
                <FiChevronDown size={14} />
              </button>
              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 sm:left-0 mt-2 w-48 rounded-xl p-1.5 z-30"
                    style={{ backgroundColor: "#101010", border: `1px solid ${COLORS.border}`, boxShadow: "0 15px 40px rgba(0,0,0,0.5)" }}
                  >
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setFilter(f.id);
                          setFilterOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm rounded-lg"
                        style={{ color: filter === f.id ? COLORS.gold : COLORS.white, backgroundColor: filter === f.id ? "rgba(212,175,55,0.08)" : "transparent" }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setSortOpen((o) => !o);
                  setFilterOpen(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium w-full sm:w-auto justify-center"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.white }}
              >
                Sort: {SORTS.find((s) => s.id === sortBy)?.label}
                <FiChevronDown size={14} />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 mt-2 w-44 rounded-xl p-1.5 z-30"
                    style={{ backgroundColor: "#101010", border: `1px solid ${COLORS.border}`, boxShadow: "0 15px 40px rgba(0,0,0,0.5)" }}
                  >
                    {SORTS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSortBy(s.id);
                          setSortOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm rounded-lg"
                        style={{ color: sortBy === s.id ? COLORS.gold : COLORS.white, backgroundColor: sortBy === s.id ? "rgba(212,175,55,0.08)" : "transparent" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Accounts" value={stats.total} icon={FiUsers} accent />
          <StatCard label="Admins" value={stats.admins} icon={FiShield} />
          <StatCard label="Partners" value={stats.partners} icon={FiUserCheck} />
          <StatCard label="Users" value={stats.users} icon={FiUser} />
          <StatCard label="Duplicate Accounts" value={stats.duplicates} icon={FiGitMerge} />
          <StatCard label="Disabled Accounts" value={stats.disabled} icon={FiSlash} />
        </div>

        {/* Content */}
        {loadingUsers ? (
          <TableSkeleton />
        ) : visibleGroups.length === 0 ? (
          <EmptyState loading={false} />
        ) : (
          <>
            {/* Desktop table */}
            {/* `overflow-x-auto` (instead of the previous `overflow-hidden`) lets the
                table scroll horizontally whenever content — long emails, many linked
                accounts, etc. — pushes past the available width, instead of silently
                clipping the Linked Accounts / Actions columns off the right edge. The
                table itself gets a min-width so columns keep a sane, readable size
                rather than getting squeezed. The Actions column is pinned with
                `sticky right-0` so it stays reachable without having to scroll all
                the way over. */}
            <div className="hidden lg:block rounded-2xl overflow-x-auto" style={{ border: `1px solid ${COLORS.border}` }}>
              <table className="w-full text-sm" style={{ minWidth: 960 }}>
                <thead>
                  <tr style={{ backgroundColor: "#101010" }}>
                    {["User", "Email", "Role", "Status", "Linked Accounts", "Created", ""].map((h, i, arr) => {
                      const isLast = i === arr.length - 1;
                      return (
                        <th
                          key={h || "actions"}
                          className={`text-left px-4 py-3 font-medium whitespace-nowrap ${isLast ? "sticky right-0 z-20" : ""}`}
                          style={{ color: COLORS.muted, backgroundColor: isLast ? "#101010" : undefined }}
                        >
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((group, idx) => (
                    <motion.tr
                      key={group.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      style={{ borderTop: `1px solid ${COLORS.border}` }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewGroup(group)}>
                          <Avatar name={group.primary.name} email={group.primary.email} photoURL={group.primary.photoURL} />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[220px]" style={{ color: COLORS.white }}>{group.primary.name || "Unnamed"}</p>
                            <p className="text-xs truncate max-w-[220px]" style={{ color: COLORS.muted }}>{group.primary.uid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.muted }}>{group.email || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={group.primary.role} /></td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={group.primary.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {group.isDuplicate ? (
                          <button
                            onClick={() => setViewGroup(group)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#FBBF24" }}
                          >
                            <FiAlertTriangle size={12} />
                            {group.accounts.length} linked accounts
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: COLORS.muted }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.muted }}>{formatDate(group.primary.createdAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap sticky right-0 z-10" style={{ backgroundColor: COLORS.bg }}>
                        <ActionsMenu
                          group={group}
                          currentUid={authUser.uid}
                          onView={() => setViewGroup(group)}
                          onEdit={() => setEditTarget({ group, account: group.primary })}
                          onRole={() => setRoleTarget({ account: group.primary, newRole: group.primary.role || "user" })}
                          onPassword={() => setPasswordTarget(group.primary)}
                          onMerge={() => setMergeGroup(group)}
                          onToggleStatus={() => requestStatusToggle(group.primary)}
                          onDelete={() => requestDelete(group.primary)}
                        />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {visibleGroups.map((group, idx) => (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "rgba(21,21,21,0.85)", border: `1px solid ${COLORS.border}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0" onClick={() => setViewGroup(group)}>
                      <Avatar name={group.primary.name} email={group.primary.email} photoURL={group.primary.photoURL} />
                      <div className="min-w-0">
                        <p className="font-medium truncate" style={{ color: COLORS.white }}>{group.primary.name || "Unnamed"}</p>
                        <p className="text-xs truncate" style={{ color: COLORS.muted }}>{group.email || "No email"}</p>
                      </div>
                    </div>
                    <ActionsMenu
                      group={group}
                      currentUid={authUser.uid}
                      onView={() => setViewGroup(group)}
                      onEdit={() => setEditTarget({ group, account: group.primary })}
                      onRole={() => setRoleTarget({ account: group.primary, newRole: group.primary.role || "user" })}
                      onPassword={() => setPasswordTarget(group.primary)}
                      onMerge={() => setMergeGroup(group)}
                      onToggleStatus={() => requestStatusToggle(group.primary)}
                      onDelete={() => requestDelete(group.primary)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <RoleBadge role={group.primary.role} />
                    <StatusBadge status={group.primary.status} />
                    {group.isDuplicate && (
                      <button
                        onClick={() => setViewGroup(group)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#FBBF24" }}
                      >
                        <FiAlertTriangle size={12} />
                        {group.accounts.length} linked
                      </button>
                    )}
                  </div>
                  <p className="text-xs mt-2" style={{ color: COLORS.muted }}>Created {formatDate(group.primary.createdAt)}</p>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------------------------- View / details modal --------------------------- */}
      <ModalShell
        open={!!viewGroup}
        onClose={() => setViewGroup(null)}
        title={viewGroup?.primary.name || "User details"}
        subtitle={viewGroup?.email}
        icon={FiUser}
        maxWidth="max-w-2xl"
      >
        {viewGroup && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow label="Role"><RoleBadge role={viewGroup.primary.role} /></DetailRow>
              <DetailRow label="Status"><StatusBadge status={viewGroup.primary.status} /></DetailRow>
              <DetailRow label="Email"><span style={{ color: COLORS.white }}>{viewGroup.primary.email || "—"}</span></DetailRow>
              <DetailRow label="Phone"><span style={{ color: COLORS.white }}>{viewGroup.primary.phone || "—"}</span></DetailRow>
              <DetailRow label="Verification"><VerifiedBadge verified={!!viewGroup.primary.emailVerified} /></DetailRow>
              <DetailRow label="UID"><CopyableText value={viewGroup.primary.uid} /></DetailRow>
              <DetailRow label="Address">
                <span style={{ color: COLORS.white }}>
                  {[viewGroup.primary.address, viewGroup.primary.city, viewGroup.primary.country].filter(Boolean).join(", ") || "—"}
                </span>
              </DetailRow>
              <DetailRow label="Created"><span style={{ color: COLORS.white }}>{formatDateTime(viewGroup.primary.createdAt)}</span></DetailRow>
              <DetailRow label="Last Updated"><span style={{ color: COLORS.white }}>{formatDateTime(viewGroup.primary.updatedAt)}</span></DetailRow>
              {viewGroup.primary.updatedBy && <DetailRow label="Updated By"><CopyableText value={viewGroup.primary.updatedBy} /></DetailRow>}
            </div>

            <div>
              <FieldLabel>Linked Accounts ({viewGroup.accounts.length})</FieldLabel>
              <div className="space-y-2">
                {viewGroup.accounts.map((a) => (
                  <div key={a.uid} className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ border: `1px solid ${COLORS.border}` }}>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: COLORS.white }}>
                        {a.uid === viewGroup.primary.uid ? "Primary Account" : "Duplicate Account"}
                      </p>
                      <p className="text-xs truncate" style={{ color: COLORS.muted }}>{a.uid} · {formatDate(a.createdAt)}</p>
                    </div>
                    <RoleBadge role={a.role} />
                  </div>
                ))}
              </div>
              {viewGroup.isDuplicate && (
                <button
                  onClick={() => {
                    setMergeGroup(viewGroup);
                    setViewGroup(null);
                  }}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: COLORS.gold, color: "#0B0B0B" }}
                >
                  <FiGitMerge size={15} />
                  Merge Accounts
                </button>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      {/* ------------------------------ Edit user modal ------------------------------ */}
      <EditUserModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={saveEditedUser}
        busy={busy}
      />

      {/* --------------------------- Set new password modal --------------------------- */}
      <PasswordResetModal
        account={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onSend={sendPasswordReset}
        busy={busy}
      />

      {/* ------------------------------ Role change modal ----------------------------- */}
      <RoleChangeModal
        target={roleTarget}
        onClose={() => setRoleTarget(null)}
        onSetRole={(r) => setRoleTarget((t) => (t ? { ...t, newRole: r } : t))}
        onConfirm={confirmRoleChange}
        busy={busy}
      />

      {/* ------------------------------ Status toggle modal --------------------------- */}
      <ModalShell
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.newStatus === "disabled" ? "Disable account?" : "Enable account?"}
        subtitle={
          statusTarget?.newStatus === "disabled" && statusTarget?.account.role === "admin"
            ? "This account has administrative access. Disabling it will immediately prevent sign-in."
            : "This changes whether the account can sign in and use the platform."
        }
        icon={FiAlertTriangle}
        iconTone={statusTarget?.newStatus === "disabled" ? "danger" : "gold"}
        footer={
          <>
            <GhostButton onClick={() => setStatusTarget(null)}>Cancel</GhostButton>
            {statusTarget?.newStatus === "disabled" ? (
              <DangerButton onClick={confirmStatusToggle} loading={busy}>Disable Account</DangerButton>
            ) : (
              <GoldButton onClick={confirmStatusToggle} loading={busy}>Enable Account</GoldButton>
            )}
          </>
        }
      >
        {statusTarget && (
          <p className="text-sm" style={{ color: COLORS.muted }}>
            {statusTarget.account.name || statusTarget.account.email || statusTarget.account.uid} will be{" "}
            {statusTarget.newStatus === "disabled" ? "disabled" : "reactivated"} immediately.
          </p>
        )}
      </ModalShell>

      {/* --------------------------------- Delete modal -------------------------------- */}
      <DeleteAccountModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} busy={busy} />

      {/* ------------------------------ Merge duplicates modal ------------------------- */}
      <MergeAccountsModal group={mergeGroup} onClose={() => setMergeGroup(null)} onConfirm={confirmMerge} busy={busy} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Detail helpers                                                           */
/* ------------------------------------------------------------------------ */

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: COLORS.muted }}>{label}</p>
      {children}
    </div>
  );
}

function CopyableText({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 text-sm font-mono"
      style={{ color: COLORS.white }}
      title="Copy"
    >
      <span className="truncate max-w-[220px]">{value}</span>
      {copied ? <FiCheck size={13} color={COLORS.gold} /> : <FiCopy size={13} color={COLORS.muted} />}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Edit user modal                                                          */
/* ------------------------------------------------------------------------ */

function EditUserModal({ target, onClose, onSave, busy }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (target) setForm({ ...target.account });
  }, [target]);

  if (!target || !form) {
    return <ModalShell open={false} onClose={onClose} title="" />;
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <ModalShell
      open={!!target}
      onClose={onClose}
      title={`Edit ${target.account.name || "user"}`}
      subtitle="Changes are merged into the existing Firestore document — unrelated fields are preserved."
      icon={FiEdit2}
      maxWidth="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GoldButton onClick={() => onSave(form)} loading={busy}>Save Changes</GoldButton>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label="Full Name" value={form.name} onChange={(v) => setField("name", v)} />

        <div>
          <TextInput label="Email" value={form.email} onChange={(v) => setField("email", v)} type="email" />
          <p className="text-xs mt-1.5" style={{ color: COLORS.muted }}>
            This updates the profile email stored in Firestore only. It does not change the account's Firebase
            Authentication sign-in email — that requires the user to update it themselves while signed in.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} />
          <TextInput label="Date of Birth" value={form.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} type="date" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Gender"
            value={form.gender || ""}
            onChange={(v) => setField("gender", v)}
            options={[
              { value: "", label: "Not specified" },
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other", label: "Other" },
            ]}
          />
          <SelectInput
            label="Account Status"
            value={form.status || "active"}
            onChange={(v) => setField("status", v)}
            options={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          />
        </div>

        <TextArea label="Address" value={form.address} onChange={(v) => setField("address", v)} rows={2} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextInput label="City" value={form.city} onChange={(v) => setField("city", v)} />
          <TextInput label="Country" value={form.country} onChange={(v) => setField("country", v)} />
          <TextInput label="Postal Code" value={form.postalCode} onChange={(v) => setField("postalCode", v)} />
        </div>

        <TextInput label="Profile Photo URL" value={form.photoURL} onChange={(v) => setField("photoURL", v)} placeholder="https://…" />
        <TextArea label="Bio" value={form.bio} onChange={(v) => setField("bio", v)} rows={3} />

        <SelectInput
          label="Role"
          value={form.role || "user"}
          onChange={(v) => setField("role", v)}
          options={ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))}
        />

        <div className="rounded-xl p-4 space-y-1" style={{ border: `1px solid ${COLORS.border}` }}>
          <ToggleRow label="Email Verified" checked={!!form.emailVerified} onChange={(v) => setField("emailVerified", v)} />
          <ToggleRow label="Phone Verified" checked={!!form.phoneVerified} onChange={(v) => setField("phoneVerified", v)} />
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Password reset modal                                                     */
/* ------------------------------------------------------------------------ */

function PasswordResetModal({ account, onClose, onSend, busy }) {
  const [suggested, setSuggested] = useState("");
  const [confirmValue, setConfirmValue] = useState("");

  useEffect(() => {
    setSuggested("");
    setConfirmValue("");
  }, [account]);

  if (!account) return <ModalShell open={false} onClose={onClose} title="" />;

  const strength = getPasswordStrength(suggested);
  const strengthColors = ["#B91C1C", "#EF4444", "#FBBF24", "#A3E635", "#4ADE80", COLORS.gold];

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let out = "";
    for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setSuggested(out);
    setConfirmValue(out);
  }

  return (
    <ModalShell
      open={!!account}
      onClose={onClose}
      title="Set New Password"
      subtitle={account.email}
      icon={FiLock}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GoldButton onClick={() => onSend(account)} loading={busy}>Send Reset Email</GoldButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl p-3.5 text-xs leading-relaxed" style={{ backgroundColor: "rgba(212,175,55,0.08)", border: `1px solid rgba(212,175,55,0.25)`, color: COLORS.muted }}>
          Firebase Authentication doesn't allow this app to directly assign another account's password from the
          browser, and this page never retrieves or displays a user's existing password. The safe, supported way
          to set a new one is to send the user a secure password reset link.
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel>Suggested password (optional, share manually)</FieldLabel>
            <button onClick={generate} className="text-xs font-medium inline-flex items-center gap-1" style={{ color: COLORS.gold }}>
              <FiRefreshCw size={12} /> Generate
            </button>
          </div>
          <TextInput value={suggested} onChange={setSuggested} isPassword placeholder="Not saved automatically" />
          {suggested && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#0F0F0F" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(strength.score / 5) * 100}%`, backgroundColor: strengthColors[strength.score] }} />
              </div>
              <span className="text-xs shrink-0" style={{ color: COLORS.muted }}>{strength.label}</span>
            </div>
          )}
        </div>

        <TextInput label="Confirm suggested password" value={confirmValue} onChange={setConfirmValue} isPassword />
        {suggested && confirmValue && suggested !== confirmValue && (
          <p className="text-xs" style={{ color: COLORS.dangerText }}>Passwords don't match.</p>
        )}

        <p className="text-xs" style={{ color: COLORS.muted }}>
          Clicking "Send Reset Email" emails {account.email || "the user"} a link to choose their own new password —
          it does not use the value typed above.
        </p>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Role change modal                                                        */
/* ------------------------------------------------------------------------ */

function RoleChangeModal({ target, onClose, onSetRole, onConfirm, busy }) {
  const [ack, setAck] = useState(false);

  useEffect(() => setAck(false), [target]);

  if (!target) return <ModalShell open={false} onClose={onClose} title="" />;

  const isPromotionToAdmin = target.newRole === "admin" && target.account.role !== "admin";
  const canConfirm = !isPromotionToAdmin || ack;

  return (
    <ModalShell
      open={!!target}
      onClose={onClose}
      title="Change account role"
      subtitle={target.account.name || target.account.email}
      icon={FiShield}
      iconTone={isPromotionToAdmin ? "danger" : "gold"}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GoldButton onClick={onConfirm} disabled={!canConfirm} loading={busy}>Confirm Change</GoldButton>
        </>
      }
    >
      <div className="space-y-4">
        <SelectInput
          label="New role"
          value={target.newRole}
          onChange={onSetRole}
          options={ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))}
        />

        {isPromotionToAdmin && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(185,28,28,0.1)", border: `1px solid ${COLORS.danger}` }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.dangerText }}>
              You are about to give this account full administrative access.
            </p>
            <label className="flex items-start gap-2.5 text-xs cursor-pointer" style={{ color: COLORS.muted }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              I understand this grants full admin access, including managing every user, order and store setting.
            </label>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Delete account modal                                                     */
/* ------------------------------------------------------------------------ */

function DeleteAccountModal({ target, onClose, onConfirm, busy }) {
  const [typed, setTyped] = useState("");

  useEffect(() => setTyped(""), [target]);

  if (!target) return <ModalShell open={false} onClose={onClose} title="" />;

  const canDelete = target.email && typed.trim().toLowerCase() === target.email.trim().toLowerCase();

  return (
    <ModalShell
      open={!!target}
      onClose={onClose}
      title="Delete Account?"
      icon={FiTrash2}
      iconTone="danger"
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <DangerButton onClick={onConfirm} disabled={!canDelete} loading={busy}>Delete Account</DangerButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm" style={{ color: COLORS.muted }}>
          This permanently removes the Firestore profile document and associated data for this account. This does
          not delete the underlying Firebase Authentication credential — that requires a server-side Admin SDK
          process. This action cannot be easily undone.
        </p>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "rgba(185,28,28,0.08)", border: `1px solid ${COLORS.danger}` }}>
          <p className="text-xs" style={{ color: COLORS.muted }}>
            Type <span style={{ color: COLORS.white, fontWeight: 600 }}>{target.email || "the account's email"}</span> to confirm.
          </p>
        </div>
        <TextInput value={typed} onChange={setTyped} placeholder={target.email || "No email on file"} />
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Merge accounts modal                                                     */
/* ------------------------------------------------------------------------ */

function MergeAccountsModal({ group, onClose, onConfirm, busy }) {
  const [primaryUid, setPrimaryUid] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (group) {
      setPrimaryUid(group.primary.uid);
      setConfirming(false);
    }
  }, [group]);

  if (!group) return <ModalShell open={false} onClose={onClose} title="" />;

  return (
    <ModalShell
      open={!!group}
      onClose={onClose}
      title="Merge Duplicate Accounts"
      subtitle={group.email}
      icon={FiGitMerge}
      maxWidth="max-w-xl"
      footer={
        confirming ? (
          <>
            <GhostButton onClick={() => setConfirming(false)}>Back</GhostButton>
            <DangerButton onClick={() => onConfirm(group, primaryUid)} loading={busy}>Confirm Merge</DangerButton>
          </>
        ) : (
          <>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <GoldButton onClick={() => setConfirming(true)}>Merge Accounts</GoldButton>
          </>
        )
      }
    >
      {!confirming ? (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: COLORS.muted }}>
            Choose which account becomes the primary record. Empty fields on the primary account will be filled in
            from the other linked accounts; existing primary values are kept as-is.
          </p>
          <div className="space-y-2">
            {group.accounts.map((a) => (
              <label
                key={a.uid}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 cursor-pointer"
                style={{ border: `1px solid ${primaryUid === a.uid ? COLORS.gold : COLORS.border}`, backgroundColor: primaryUid === a.uid ? "rgba(212,175,55,0.06)" : "transparent" }}
              >
                <input type="radio" name="primary" checked={primaryUid === a.uid} onChange={() => setPrimaryUid(a.uid)} />
                <Avatar name={a.name} email={a.email} photoURL={a.photoURL} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: COLORS.white }}>{a.name || "Unnamed"} · <RoleBadge role={a.role} /></p>
                  <p className="text-xs truncate" style={{ color: COLORS.muted }}>{a.uid} · Created {formatDate(a.createdAt)}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="rounded-xl p-3.5 text-xs leading-relaxed" style={{ backgroundColor: "rgba(212,175,55,0.08)", border: `1px solid rgba(212,175,55,0.25)`, color: COLORS.muted }}>
            This merges Firestore profile documents only. It does not merge, delete, or link the separate Firebase
            Authentication sign-in credentials behind each UID — those remain distinct accounts.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: COLORS.white }}>Merge these accounts?</p>
          <p className="text-sm" style={{ color: COLORS.muted }}>
            All selected duplicate account information will be consolidated under the selected primary account.
            The other {group.accounts.length - 1} document{group.accounts.length - 1 === 1 ? "" : "s"} will be marked
            as merged and kept for audit history rather than deleted.
          </p>
          <p className="text-sm font-medium" style={{ color: COLORS.dangerText }}>This action may be irreversible.</p>
        </div>
      )}
    </ModalShell>
  );
}