import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUser,
  FiShoppingBag,
  FiTruck,
  FiCreditCard,
  FiPackage,
  FiStar,
  FiUsers,
  FiBell,
  FiLock,
  FiMonitor,
  FiAlertTriangle,
  FiMenu,
  FiX,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiUpload,
  FiSave,
  FiLoader,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiChevronRight,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";

// Adjust this import path if your project's Firebase config file lives elsewhere.
// It must export an initialized `auth` (Firebase Auth) and `db` (Firestore) instance.
import { auth, db } from "../../firebase/firebase";
import {
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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
};

/* ------------------------------------------------------------------------ */
/* Permissions                                                              */
/* ------------------------------------------------------------------------ */

const permissions = {
  admin: {
    profile: true,
    store: true,
    delivery: true,
    payments: true,
    products: true,
    reviews: true,
    users: true,
    notifications: true,
    security: true,
    appearance: true,
    danger: true,
  },
  partner: {
    profile: true,
    shop: true,
    payout: true,
    delivery: true,
    notifications: true,
    security: true,
    appearance: true,
  },
};

const ADMIN_ORDER = [
  "profile",
  "store",
  "delivery",
  "payments",
  "products",
  "reviews",
  "users",
  "notifications",
  "security",
  "appearance",
  "danger",
];

const PARTNER_ORDER = [
  "profile",
  "shop",
  "payout",
  "delivery",
  "notifications",
  "security",
  "appearance",
];

const SECTION_META = {
  profile: { label: "Profile", icon: FiUser },
  store: { label: "Store Settings", icon: FiShoppingBag },
  delivery: { label: "Delivery", icon: FiTruck },
  payments: { label: "Payments", icon: FiCreditCard },
  products: { label: "Products", icon: FiPackage },
  reviews: { label: "Reviews", icon: FiStar },
  users: { label: "User Management", icon: FiUsers },
  shop: { label: "Shop Information", icon: FiShoppingBag },
  payout: { label: "Payout", icon: FiDollarSign },
  notifications: { label: "Notifications", icon: FiBell },
  security: { label: "Security", icon: FiLock },
  appearance: { label: "Appearance", icon: FiMonitor },
  danger: { label: "Danger Zone", icon: FiAlertTriangle },
};

/* ------------------------------------------------------------------------ */
/* Default settings shapes                                                  */
/* ------------------------------------------------------------------------ */

const DEFAULT_PROFILE = {
  photoURL: "",
  fullName: "",
  email: "",
  phone: "",
  address: "",
};

const DEFAULT_ADMIN_SETTINGS = {
  profile: { ...DEFAULT_PROFILE },
  store: {
    name: "",
    tagline: "",
    logoURL: "",
    currency: "BDT",
    language: "en",
    timezone: "Asia/Dhaka",
    maintenanceMode: false,
  },
  delivery: {
    charge: 0,
    freeThreshold: 0,
    estimatedTime: "",
    areas: "",
    cashOnDelivery: true,
  },
  payments: {
    bkash: { enabled: false, number: "" },
    nagad: { enabled: false, number: "" },
    rocket: { enabled: false, number: "" },
    sslcommerz: { enabled: false, storeId: "", storePassword: "" },
    stripe: { enabled: false, publishableKey: "", secretKey: "" },
    paypal: { enabled: false, clientId: "" },
    testMode: true,
  },
  products: {
    requireApproval: true,
    autoPublish: false,
    lowStockThreshold: 5,
    hideOutOfStock: false,
    skuPrefix: "ZY",
  },
  reviews: {
    autoApprove: false,
    showOnHomepage: true,
    allowPartnerReviews: true,
    moderationEnabled: true,
  },
  users: {
    partnerRegistrationOpen: true,
    partnerApprovalRequired: true,
    customerRegistrationOpen: true,
  },
  notifications: {
    email: true,
    orders: true,
    payments: true,
    lowStock: true,
  },
  security: { twoFactorEnabled: false },
  appearance: { theme: "dark", compactSidebar: false, animationsEnabled: true },
};

const DEFAULT_PARTNER_SETTINGS = {
  profile: { ...DEFAULT_PROFILE },
  shop: {
    name: "",
    logoURL: "",
    description: "",
    category: "",
    openingHours: "",
  },
  payout: {
    bkash: "",
    nagad: "",
    rocket: "",
    bankAccount: "",
    preferredMethod: "bkash",
  },
  delivery: {
    areas: "",
    processingTime: "",
    shippingPreferences: "",
  },
  notifications: {
    newOrder: true,
    paymentReceived: true,
    customerMessages: true,
    lowStockAlerts: true,
  },
  security: { twoFactorEnabled: false },
  appearance: { theme: "dark", compactSidebar: false, animationsEnabled: true },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ------------------------------------------------------------------------ */
/* Small reusable UI primitives (kept inside this file on purpose)          */
/* ------------------------------------------------------------------------ */

function SettingsCard({ title, description, children }) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mb-5 backdrop-blur-sm"
      style={{
        backgroundColor: "rgba(21,21,21,0.85)",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-base sm:text-lg font-semibold tracking-wide" style={{ color: COLORS.white }}>
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5" style={{ color: COLORS.muted }}>
      {children}
    </label>
  );
}

function SettingsInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error,
  disabled = false,
  isPassword = false,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) =>
            onChange(type === "number" ? Number(e.target.value) : e.target.value)
          }
          aria-invalid={!!error}
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 disabled:opacity-50"
          style={{
            backgroundColor: "#0F0F0F",
            border: `1px solid ${error ? "#B91C1C" : COLORS.border}`,
            color: COLORS.white,
          }}
          onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
          onBlur={(e) => (e.target.style.borderColor = error ? "#B91C1C" : COLORS.border)}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: COLORS.muted }}
          >
            {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: "#F87171" }}>{error}</p>}
    </div>
  );
}

function SettingsTextarea({ id, label, value, onChange, placeholder = "", rows = 3 }) {
  return (
    <div>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <textarea
        id={id}
        rows={rows}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 resize-none"
        style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
        onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
        onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
      />
    </div>
  );
}

function SettingsSelect({ id, label, value, onChange, options }) {
  return (
    <div>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
        style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
        onFocus={(e) => (e.target.style.borderColor = COLORS.gold)}
        onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ backgroundColor: COLORS.card }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsToggle({ id, label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <label htmlFor={id} className="text-sm font-medium block" style={{ color: COLORS.white }}>
          {label}
        </label>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-40"
        style={{ backgroundColor: checked ? COLORS.gold : "#2E2E2E" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full"
          style={{
            backgroundColor: checked ? "#0B0B0B" : COLORS.white,
            transform: checked ? "translateX(20px)" : "translateX(0px)",
          }}
        />
      </button>
    </div>
  );
}

function ImageUploadField({ label, value, onChange }) {
  const inputId = useMemo(() => `img-${Math.random().toString(36).slice(2)}`, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}` }}
        >
          {value ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <FiUser size={22} style={{ color: COLORS.muted }} />
          )}
        </div>
        <label
          htmlFor={inputId}
          className="cursor-pointer inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          style={{ border: `1px solid ${COLORS.gold}`, color: COLORS.gold }}
        >
          <FiUpload size={14} />
          Upload image
        </label>
        <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

function ConfirmationModal({ open, title, message, confirmLabel = "Confirm", danger = true, requireText, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const canConfirm = requireText ? typed === requireText : true;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: danger ? "rgba(185,28,28,0.15)" : "rgba(212,175,55,0.15)" }}
              >
                <FiAlertTriangle size={18} color={danger ? "#F87171" : COLORS.gold} />
              </div>
              <div>
                <h4 id="confirm-modal-title" className="font-semibold" style={{ color: COLORS.white }}>
                  {title}
                </h4>
                <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
                  {message}
                </p>
              </div>
            </div>

            {requireText && (
              <div className="mt-4">
                <FieldLabel>{`Type "${requireText}" to confirm`}</FieldLabel>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ backgroundColor: "#0F0F0F", border: `1px solid ${COLORS.border}`, color: COLORS.white }}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: COLORS.muted, border: `1px solid ${COLORS.border}` }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
                style={{
                  backgroundColor: danger ? "#B91C1C" : COLORS.gold,
                  color: danger ? COLORS.white : "#0B0B0B",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -16, x: "-50%" }}
          className="fixed top-5 left-1/2 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl"
          style={{
            backgroundColor: COLORS.card,
            border: `1px solid ${toast.type === "error" ? "#B91C1C" : COLORS.gold}`,
          }}
        >
          {toast.type === "error" ? (
            <FiXCircle color="#F87171" size={18} />
          ) : (
            <FiCheckCircle color={COLORS.gold} size={18} />
          )}
          <span className="text-sm" style={{ color: COLORS.white }}>
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------ */
/* Main component                                                           */
/* ------------------------------------------------------------------------ */

export default function SettingsPage() {
  const [authUser, setAuthUser] = useState(null);
  const [role, setRole] = useState(null); // "admin" | "partner"
  const [initializing, setInitializing] = useState(true);

  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);

  const [activeSection, setActiveSection] = useState("profile");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null); // { title, message, confirmLabel, requireText, onConfirm }

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  /* ---------------------------- Auth + role -------------------------- */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setRole(null);
        setInitializing(false);
        setLoading(false);
        return;
      }
      setAuthUser(user);
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const resolvedRole = userDoc.exists() && userDoc.data().role === "admin" ? "admin" : "partner";
        setRole(resolvedRole);
        setActiveSection("profile");
      } catch (err) {
        console.error("Failed to resolve user role:", err);
        setRole("partner");
      } finally {
        setInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  /* ------------------------------ Load settings ------------------------ */

  useEffect(() => {
    if (!authUser || !role) return;

    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      try {
        const defaults = role === "admin" ? DEFAULT_ADMIN_SETTINGS : DEFAULT_PARTNER_SETTINGS;
        const ref =
          role === "admin"
            ? doc(db, "settings", "global")
            : doc(db, "partners", authUser.uid, "settings", "profile");

        const snap = await getDoc(ref);
        const merged = deepClone(defaults);

        if (snap.exists()) {
          const data = snap.data();
          Object.keys(defaults).forEach((key) => {
            if (data[key] && typeof data[key] === "object" && !Array.isArray(data[key])) {
              merged[key] = { ...defaults[key], ...data[key] };
            } else if (data[key] !== undefined) {
              merged[key] = data[key];
            }
          });
        }

        // Always seed profile basics from the auth user if empty.
        if (!merged.profile.email) merged.profile.email = authUser.email || "";
        if (!merged.profile.fullName && authUser.displayName) merged.profile.fullName = authUser.displayName;
        if (!merged.profile.photoURL && authUser.photoURL) merged.profile.photoURL = authUser.photoURL;

        if (!cancelled) {
          setSettings(merged);
          setSavedSettings(deepClone(merged));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        if (!cancelled) showToast("error", "Couldn't load your settings. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [authUser, role, showToast]);

  /* ------------------------------- Helpers ------------------------------ */

  const sectionOrder = role === "admin" ? ADMIN_ORDER : PARTNER_ORDER;
  const rolePermissions = role ? permissions[role] : {};

  const canEditSection = useCallback(
    (sectionId) => {
      if (!role) return false;
      return !!permissions[role]?.[sectionId];
    },
    [role]
  );

  const updateField = (section, path, value) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      if (Array.isArray(path)) {
        let cursor = next[section];
        for (let i = 0; i < path.length - 1; i++) cursor = cursor[path[i]];
        cursor[path[path.length - 1]] = value;
      } else {
        next[section][path] = value;
      }
      return next;
    });
  };

  const isSectionDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return JSON.stringify(settings[activeSection]) !== JSON.stringify(savedSettings[activeSection]);
  }, [settings, savedSettings, activeSection]);

  const validateSection = (sectionId) => {
    const newErrors = {};
    const data = settings[sectionId];

    if (sectionId === "profile") {
      if (!data.fullName?.trim()) newErrors.fullName = "Full name is required.";
      if (!data.email?.trim()) {
        newErrors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        newErrors.email = "Enter a valid email address.";
      }
    }

    if (sectionId === "store") {
      if (!data.name?.trim()) newErrors.storeName = "Store name is required.";
    }

    if (sectionId === "shop") {
      if (!data.name?.trim()) newErrors.shopName = "Shop name is required.";
    }

    if (sectionId === "delivery" && role === "admin") {
      if (Number(data.charge) < 0) newErrors.charge = "Delivery charge can't be negative.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* -------------------------------- Save --------------------------------- */

  const handleSave = async () => {
    if (!authUser || !role) return;

    // Security check: never allow writing a section the role isn't permitted to edit.
    if (!canEditSection(activeSection)) {
      showToast("error", "You don't have permission to change these settings.");
      return;
    }

    if (!validateSection(activeSection)) {
      showToast("error", "Please fix the errors before saving.");
      return;
    }

    setSaving(true);
    try {
      const ref =
        role === "admin"
          ? doc(db, "settings", "global")
          : doc(db, "partners", authUser.uid, "settings", "profile");

      await setDoc(
        ref,
        {
          [activeSection]: settings[activeSection],
          updatedAt: serverTimestamp(),
          updatedBy: authUser.uid,
        },
        { merge: true }
      );

      setSavedSettings((prev) => ({ ...prev, [activeSection]: deepClone(settings[activeSection]) }));
      showToast("success", "Settings saved successfully.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      showToast("error", "Something went wrong while saving. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings((prev) => ({ ...prev, [activeSection]: deepClone(savedSettings[activeSection]) }));
    setErrors({});
  };

  /* ----------------------------- Password change -------------------------- */

  const handleChangePassword = async () => {
    if (!authUser) return;
    const { current, next, confirm } = passwordForm;

    if (!current || !next || !confirm) {
      showToast("error", "Fill in all password fields.");
      return;
    }
    if (next.length < 8) {
      showToast("error", "New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      showToast("error", "New passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(authUser.email, current);
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, next);
      setPasswordForm({ current: "", next: "", confirm: "" });
      showToast("success", "Password updated successfully.");
    } catch (err) {
      console.error("Failed to update password:", err);
      showToast("error", "Couldn't update password. Check your current password and try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  /* ------------------------------ Danger zone ----------------------------- */

  const openResetConfirm = () => {
    if (role !== "admin") return;
    setConfirmModal({
      title: "Reset all settings?",
      message: "This restores every store setting to its default value. This cannot be undone.",
      confirmLabel: "Reset settings",
      danger: true,
      onConfirm: async () => {
        try {
          const ref = doc(db, "settings", "global");
          const defaults = deepClone(DEFAULT_ADMIN_SETTINGS);
          await setDoc(ref, { ...defaults, updatedAt: serverTimestamp(), updatedBy: authUser.uid });
          setSettings(defaults);
          setSavedSettings(deepClone(defaults));
          showToast("success", "Settings reset to defaults.");
        } catch (err) {
          console.error(err);
          showToast("error", "Couldn't reset settings.");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const openDeleteStoreDataConfirm = () => {
    if (role !== "admin") return;
    setConfirmModal({
      title: "Delete store data?",
      message:
        "This flags your store data for permanent deletion. Product, order, and review records are removed by a backend process shortly after.",
      confirmLabel: "Delete store data",
      danger: true,
      requireText: "DELETE",
      onConfirm: async () => {
        try {
          const ref = doc(db, "settings", "global");
          await setDoc(
            ref,
            { storeDataDeletionRequestedAt: serverTimestamp(), storeDataDeletionRequestedBy: authUser.uid },
            { merge: true }
          );
          showToast("success", "Store data deletion requested.");
        } catch (err) {
          console.error(err);
          showToast("error", "Couldn't submit deletion request.");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  /* -------------------------------------------------------------------- */
  /* Section renderers                                                    */
  /* -------------------------------------------------------------------- */

  const renderProfile = () => {
    const p = settings.profile;
    return (
      <SettingsCard title="Profile" description="Your personal account details.">
        <ImageUploadField label="Profile picture" value={p.photoURL} onChange={(v) => updateField("profile", "photoURL", v)} />
        <SettingsInput id="fullName" label="Full name" value={p.fullName} error={errors.fullName} onChange={(v) => updateField("profile", "fullName", v)} />
        <SettingsInput id="email" label="Email" type="email" value={p.email} error={errors.email} onChange={(v) => updateField("profile", "email", v)} />
        <SettingsInput id="phone" label="Phone" value={p.phone} onChange={(v) => updateField("profile", "phone", v)} placeholder="+880 1XXXXXXXXX" />
        <SettingsTextarea id="address" label="Address" value={p.address} onChange={(v) => updateField("profile", "address", v)} />
      </SettingsCard>
    );
  };

  const renderStore = () => {
    const s = settings.store;
    return (
      <SettingsCard title="Store Settings" description="Global configuration for the entire storefront.">
        <SettingsInput id="storeName" label="Store name" value={s.name} error={errors.storeName} onChange={(v) => updateField("store", "name", v)} />
        <SettingsInput id="tagline" label="Store tagline" value={s.tagline} onChange={(v) => updateField("store", "tagline", v)} />
        <ImageUploadField label="Store logo" value={s.logoURL} onChange={(v) => updateField("store", "logoURL", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SettingsSelect
            id="currency"
            label="Currency"
            value={s.currency}
            onChange={(v) => updateField("store", "currency", v)}
            options={[
              { value: "BDT", label: "BDT — Taka" },
              { value: "USD", label: "USD — Dollar" },
              { value: "EUR", label: "EUR — Euro" },
            ]}
          />
          <SettingsSelect
            id="language"
            label="Language"
            value={s.language}
            onChange={(v) => updateField("store", "language", v)}
            options={[
              { value: "en", label: "English" },
              { value: "bn", label: "Bangla" },
            ]}
          />
          <SettingsInput id="timezone" label="Timezone" value={s.timezone} onChange={(v) => updateField("store", "timezone", v)} />
        </div>
        <SettingsToggle
          id="maintenanceMode"
          label="Maintenance mode"
          description="Temporarily take the storefront offline for customers."
          checked={s.maintenanceMode}
          onChange={(v) => updateField("store", "maintenanceMode", v)}
        />
      </SettingsCard>
    );
  };

  const renderDelivery = () => {
    const d = settings.delivery;
    if (role === "admin") {
      return (
        <SettingsCard title="Delivery Settings" description="Store-wide shipping rules.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingsInput id="charge" label="Delivery charge" type="number" value={d.charge} error={errors.charge} onChange={(v) => updateField("delivery", "charge", v)} />
            <SettingsInput id="freeThreshold" label="Free delivery threshold" type="number" value={d.freeThreshold} onChange={(v) => updateField("delivery", "freeThreshold", v)} />
          </div>
          <SettingsInput id="estimatedTime" label="Estimated delivery time" value={d.estimatedTime} onChange={(v) => updateField("delivery", "estimatedTime", v)} placeholder="e.g. 2–4 business days" />
          <SettingsTextarea id="areas" label="Delivery areas" value={d.areas} onChange={(v) => updateField("delivery", "areas", v)} placeholder="List covered cities / zones" />
          <SettingsToggle id="cod" label="Cash on delivery" checked={d.cashOnDelivery} onChange={(v) => updateField("delivery", "cashOnDelivery", v)} />
        </SettingsCard>
      );
    }
    return (
      <SettingsCard title="Delivery" description="Your shop's shipping preferences.">
        <SettingsTextarea id="areas" label="Delivery areas" value={d.areas} onChange={(v) => updateField("delivery", "areas", v)} placeholder="Areas you can ship to" />
        <SettingsInput id="processingTime" label="Processing time" value={d.processingTime} onChange={(v) => updateField("delivery", "processingTime", v)} placeholder="e.g. 1–2 business days" />
        <SettingsTextarea id="shippingPreferences" label="Shipping preferences" value={d.shippingPreferences} onChange={(v) => updateField("delivery", "shippingPreferences", v)} />
      </SettingsCard>
    );
  };

  const renderPayments = () => {
    const pay = settings.payments;
    const gateway = (key, label, fields) => (
      <div key={key} className="rounded-xl p-4" style={{ border: `1px solid ${COLORS.border}` }}>
        <SettingsToggle
          id={`${key}-enabled`}
          label={label}
          checked={pay[key].enabled}
          onChange={(v) => updateField("payments", [key, "enabled"], v)}
        />
        {pay[key].enabled && (
          <div className="mt-3 space-y-3">
            {fields.map((f) => (
              <SettingsInput
                key={f.key}
                id={`${key}-${f.key}`}
                label={f.label}
                value={pay[key][f.key]}
                isPassword={f.secret}
                onChange={(v) => updateField("payments", [key, f.key], v)}
              />
            ))}
          </div>
        )}
      </div>
    );

    return (
      <SettingsCard title="Payment Settings" description="Enable and configure payment gateways.">
        <SettingsToggle id="testMode" label="Test mode" description="Use sandbox credentials for all gateways." checked={pay.testMode} onChange={(v) => updateField("payments", "testMode", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {gateway("bkash", "bKash", [{ key: "number", label: "Merchant number" }])}
          {gateway("nagad", "Nagad", [{ key: "number", label: "Merchant number" }])}
          {gateway("rocket", "Rocket", [{ key: "number", label: "Merchant number" }])}
          {gateway("sslcommerz", "SSLCommerz", [
            { key: "storeId", label: "Store ID" },
            { key: "storePassword", label: "Store password", secret: true },
          ])}
          {gateway("stripe", "Stripe", [
            { key: "publishableKey", label: "Publishable key" },
            { key: "secretKey", label: "Secret key", secret: true },
          ])}
          {gateway("paypal", "PayPal", [{ key: "clientId", label: "Client ID" }])}
        </div>
      </SettingsCard>
    );
  };

  const renderProducts = () => {
    const p = settings.products;
    return (
      <SettingsCard title="Product Settings" description="Rules applied to the product catalog.">
        <SettingsToggle id="requireApproval" label="Require product approval" description="New partner products need admin approval before going live." checked={p.requireApproval} onChange={(v) => updateField("products", "requireApproval", v)} />
        <SettingsToggle id="autoPublish" label="Auto publish" description="Publish approved products immediately." checked={p.autoPublish} onChange={(v) => updateField("products", "autoPublish", v)} />
        <SettingsToggle id="hideOutOfStock" label="Hide out-of-stock products" checked={p.hideOutOfStock} onChange={(v) => updateField("products", "hideOutOfStock", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsInput id="lowStockThreshold" label="Low-stock threshold" type="number" value={p.lowStockThreshold} onChange={(v) => updateField("products", "lowStockThreshold", v)} />
          <SettingsInput id="skuPrefix" label="SKU prefix" value={p.skuPrefix} onChange={(v) => updateField("products", "skuPrefix", v)} />
        </div>
      </SettingsCard>
    );
  };

  const renderReviews = () => {
    const r = settings.reviews;
    return (
      <SettingsCard title="Review Settings" description="Control how customer reviews behave.">
        <SettingsToggle id="autoApprove" label="Auto approve reviews" checked={r.autoApprove} onChange={(v) => updateField("reviews", "autoApprove", v)} />
        <SettingsToggle id="showOnHomepage" label="Show reviews on homepage" checked={r.showOnHomepage} onChange={(v) => updateField("reviews", "showOnHomepage", v)} />
        <SettingsToggle id="allowPartnerReviews" label="Allow partner reviews" checked={r.allowPartnerReviews} onChange={(v) => updateField("reviews", "allowPartnerReviews", v)} />
        <SettingsToggle id="moderationEnabled" label="Review moderation" description="Flagged reviews require manual approval." checked={r.moderationEnabled} onChange={(v) => updateField("reviews", "moderationEnabled", v)} />
      </SettingsCard>
    );
  };

  const renderUsers = () => {
    const u = settings.users;
    return (
      <SettingsCard title="User Management" description="Control registration across the platform.">
        <SettingsToggle id="partnerRegistrationOpen" label="Partner registration open" checked={u.partnerRegistrationOpen} onChange={(v) => updateField("users", "partnerRegistrationOpen", v)} />
        <SettingsToggle id="partnerApprovalRequired" label="Require partner approval" checked={u.partnerApprovalRequired} onChange={(v) => updateField("users", "partnerApprovalRequired", v)} />
        <SettingsToggle id="customerRegistrationOpen" label="Customer registration open" checked={u.customerRegistrationOpen} onChange={(v) => updateField("users", "customerRegistrationOpen", v)} />
      </SettingsCard>
    );
  };

  const renderShop = () => {
    const s = settings.shop;
    return (
      <SettingsCard title="Shop Information" description="How your shop appears to customers.">
        <SettingsInput id="shopName" label="Shop name" value={s.name} error={errors.shopName} onChange={(v) => updateField("shop", "name", v)} />
        <ImageUploadField label="Shop logo" value={s.logoURL} onChange={(v) => updateField("shop", "logoURL", v)} />
        <SettingsTextarea id="description" label="Shop description" value={s.description} onChange={(v) => updateField("shop", "description", v)} />
        <SettingsInput id="category" label="Business category" value={s.category} onChange={(v) => updateField("shop", "category", v)} />
        <SettingsInput id="openingHours" label="Opening hours" value={s.openingHours} onChange={(v) => updateField("shop", "openingHours", v)} placeholder="e.g. 9:00 AM – 9:00 PM" />
      </SettingsCard>
    );
  };

  const renderPayout = () => {
    const p = settings.payout;
    return (
      <SettingsCard title="Payout" description="Where your earnings are sent.">
        <SettingsInput id="payoutBkash" label="bKash number" value={p.bkash} onChange={(v) => updateField("payout", "bkash", v)} />
        <SettingsInput id="payoutNagad" label="Nagad number" value={p.nagad} onChange={(v) => updateField("payout", "nagad", v)} />
        <SettingsInput id="payoutRocket" label="Rocket number" value={p.rocket} onChange={(v) => updateField("payout", "rocket", v)} />
        <SettingsInput id="bankAccount" label="Bank account" value={p.bankAccount} onChange={(v) => updateField("payout", "bankAccount", v)} />
        <SettingsSelect
          id="preferredMethod"
          label="Preferred payout method"
          value={p.preferredMethod}
          onChange={(v) => updateField("payout", "preferredMethod", v)}
          options={[
            { value: "bkash", label: "bKash" },
            { value: "nagad", label: "Nagad" },
            { value: "rocket", label: "Rocket" },
            { value: "bank", label: "Bank account" },
          ]}
        />
      </SettingsCard>
    );
  };

  const renderNotifications = () => {
    const n = settings.notifications;
    if (role === "admin") {
      return (
        <SettingsCard title="Notifications" description="Choose what triggers a notification.">
          <SettingsToggle id="email" label="Email notifications" checked={n.email} onChange={(v) => updateField("notifications", "email", v)} />
          <SettingsToggle id="orders" label="Order notifications" checked={n.orders} onChange={(v) => updateField("notifications", "orders", v)} />
          <SettingsToggle id="payments" label="Payment notifications" checked={n.payments} onChange={(v) => updateField("notifications", "payments", v)} />
          <SettingsToggle id="lowStock" label="Low-stock notifications" checked={n.lowStock} onChange={(v) => updateField("notifications", "lowStock", v)} />
        </SettingsCard>
      );
    }
    return (
      <SettingsCard title="Notifications" description="Choose what triggers a notification.">
        <SettingsToggle id="newOrder" label="New order" checked={n.newOrder} onChange={(v) => updateField("notifications", "newOrder", v)} />
        <SettingsToggle id="paymentReceived" label="Payment received" checked={n.paymentReceived} onChange={(v) => updateField("notifications", "paymentReceived", v)} />
        <SettingsToggle id="customerMessages" label="Customer messages" checked={n.customerMessages} onChange={(v) => updateField("notifications", "customerMessages", v)} />
        <SettingsToggle id="lowStockAlerts" label="Low-stock alerts" checked={n.lowStockAlerts} onChange={(v) => updateField("notifications", "lowStockAlerts", v)} />
      </SettingsCard>
    );
  };

  const renderSecurity = () => {
    const sec = settings.security;
    return (
      <>
        <SettingsCard title="Change password" description="Update the password used to sign in.">
          <SettingsInput id="currentPassword" label="Current password" isPassword value={passwordForm.current} onChange={(v) => setPasswordForm((p) => ({ ...p, current: v }))} />
          <SettingsInput id="newPassword" label="New password" isPassword value={passwordForm.next} onChange={(v) => setPasswordForm((p) => ({ ...p, next: v }))} />
          <SettingsInput id="confirmPassword" label="Confirm new password" isPassword value={passwordForm.confirm} onChange={(v) => setPasswordForm((p) => ({ ...p, confirm: v }))} />
          <button
            onClick={handleChangePassword}
            disabled={passwordSaving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: COLORS.gold, color: "#0B0B0B" }}
          >
            {passwordSaving ? <FiLoader className="animate-spin" size={16} /> : <FiCheck size={16} />}
            Update password
          </button>
        </SettingsCard>

        <SettingsCard title="Security" description="Extra protection for your account.">
          <SettingsToggle id="twoFactorEnabled" label="Two-factor authentication" description="Require a verification code at sign-in." checked={sec.twoFactorEnabled} onChange={(v) => updateField("security", "twoFactorEnabled", v)} />
          <div className="pt-2">
            <FieldLabel>Login / session information</FieldLabel>
            <div className="rounded-xl p-3 text-sm" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
              Signed in as <span style={{ color: COLORS.white }}>{authUser?.email}</span>
              {authUser?.metadata?.lastSignInTime && (
                <div className="mt-1">
                  Last sign-in: {new Date(authUser.metadata.lastSignInTime).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </SettingsCard>
      </>
    );
  };

  const renderAppearance = () => {
    const a = settings.appearance;
    return (
      <SettingsCard title="Appearance" description="Personalize how the dashboard looks and feels.">
        <SettingsSelect
          id="theme"
          label="Theme"
          value={a.theme}
          onChange={(v) => updateField("appearance", "theme", v)}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
          ]}
        />
        <SettingsToggle id="compactSidebar" label="Sidebar compact mode" checked={a.compactSidebar} onChange={(v) => updateField("appearance", "compactSidebar", v)} />
        <SettingsToggle id="animationsEnabled" label="Animations" description="Enable interface motion and transitions." checked={a.animationsEnabled} onChange={(v) => updateField("appearance", "animationsEnabled", v)} />
      </SettingsCard>
    );
  };

  const renderDanger = () => {
    if (role !== "admin") return null;
    return (
      <SettingsCard title="Danger Zone" description="These actions are destructive and hard to undo.">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={openResetConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.white }}
          >
            <FiRotateCcw size={16} />
            Reset settings
          </button>
          <button
            onClick={openDeleteStoreDataConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ border: "1px solid #B91C1C", color: "#F87171" }}
          >
            <FiTrash2 size={16} />
            Delete store data
          </button>
        </div>
      </SettingsCard>
    );
  };

  const SECTION_RENDERERS = {
    profile: renderProfile,
    store: renderStore,
    delivery: renderDelivery,
    payments: renderPayments,
    products: renderProducts,
    reviews: renderReviews,
    users: renderUsers,
    shop: renderShop,
    payout: renderPayout,
    notifications: renderNotifications,
    security: renderSecurity,
    appearance: renderAppearance,
    danger: renderDanger,
  };

  /* -------------------------------------------------------------------- */
  /* Guarded states                                                        */
  /* -------------------------------------------------------------------- */

  if (initializing || (authUser && loading) || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <div className="flex flex-col items-center gap-3">
          <FiLoader className="animate-spin" size={28} color={COLORS.gold} />
          <p className="text-sm" style={{ color: COLORS.muted }}>Loading your settings…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.muted }}>Please sign in to view settings.</p>
      </div>
    );
  }

  if (!settings) return null;

  /* -------------------------------------------------------------------- */
  /* Render                                                                */
  /* -------------------------------------------------------------------- */

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.bg }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <ConfirmationModal
        open={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        requireText={confirmModal?.requireText}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Header */}
      <div className="px-4 sm:px-8 pt-8 pb-6" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: COLORS.white }}>
              Settings
            </h1>
            <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
              Manage your account and application preferences
            </p>
          </div>
          <button
            className="lg:hidden p-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}` }}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open settings menu"
          >
            <FiMenu color={COLORS.white} size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="sticky top-6 space-y-1">
            {sectionOrder.map((id) => {
              const meta = SECTION_META[id];
              const Icon = meta.icon;
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveSection(id);
                    setErrors({});
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150"
                  style={{
                    backgroundColor: active ? "rgba(212,175,55,0.1)" : "transparent",
                    color: active ? COLORS.gold : COLORS.muted,
                    border: active ? `1px solid rgba(212,175,55,0.35)` : "1px solid transparent",
                  }}
                >
                  <Icon size={16} />
                  <span className="flex-1 text-left">{meta.label}</span>
                  {active && <FiChevronRight size={14} />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 lg:hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
              onClick={() => setMobileSidebarOpen(false)}
            >
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="h-full w-72 p-5"
                style={{ backgroundColor: COLORS.card, borderRight: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="font-semibold" style={{ color: COLORS.white }}>
                    Settings
                  </span>
                  <button onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu">
                    <FiX color={COLORS.muted} size={20} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {sectionOrder.map((id) => {
                    const meta = SECTION_META[id];
                    const Icon = meta.icon;
                    const active = activeSection === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveSection(id);
                          setErrors({});
                          setMobileSidebarOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium"
                        style={{
                          backgroundColor: active ? "rgba(212,175,55,0.1)" : "transparent",
                          color: active ? COLORS.gold : COLORS.muted,
                        }}
                      >
                        <Icon size={16} />
                        {meta.label}
                      </button>
                    );
                  })}
                </nav>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {rolePermissions[activeSection] ? (
                SECTION_RENDERERS[activeSection]?.()
              ) : (
                <SettingsCard title="Not available">
                  <p className="text-sm" style={{ color: COLORS.muted }}>
                    You don't have access to this section.
                  </p>
                </SettingsCard>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Save bar (hidden for the danger zone, which has its own actions) */}
          {activeSection !== "danger" && rolePermissions[activeSection] && (
            <div
              className="sticky bottom-4 mt-2 flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 backdrop-blur-md"
              style={{ backgroundColor: "rgba(21,21,21,0.9)", border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.muted }}>
                {isSectionDirty ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.gold }} />
                    Unsaved changes
                  </>
                ) : (
                  "All changes saved"
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancel}
                  disabled={!isSectionDirty || saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                  style={{ color: COLORS.muted, border: `1px solid ${COLORS.border}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isSectionDirty || saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: COLORS.gold, color: "#0B0B0B" }}
                >
                  {saving ? <FiLoader className="animate-spin" size={15} /> : <FiSave size={15} />}
                  Save changes
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}