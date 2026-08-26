import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  doc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  useNavigate,
} from "react-router-dom";

import {
  FaBoxOpen,
  FaChartBar,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaUndo,
  FaWallet,
  FaMoneyBillWave,
  FaExchangeAlt,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendar,
  FaShoppingBag,
  FaPercentage,
  FaSearch,
  FaDownload,
  FaStore,
  FaChevronDown,
} from "react-icons/fa";

import {
  db,
  auth,
} from "../../firebase/firebase";

import {
  ADMIN_EMAILS,
} from "../../utils/adminCheck";

import {
  warningAlert,
  successAlert,
  errorAlert,
} from "../../utils/alerts";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

// DEFAULT COMMISSION RATE — 10%.
// Overridden per-partner by partners/{id}.commissionRate if set.
const DEFAULT_COMMISSION = 0.10;

const STATUS_COLORS = {
  Pending:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Confirmed: "bg-green-500/20  text-green-400  border-green-500/30",
  Shipping:  "bg-blue-500/20   text-blue-400   border-blue-500/30",
  Delivered: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Cancelled: "bg-red-500/20    text-red-400    border-red-500/30",
  Refunded:  "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const WITHDRAW_STATUS_COLORS = {
  Pending:  "bg-yellow-500/20 text-yellow-400",
  Approved: "bg-blue-500/20   text-blue-400",
  Paid:     "bg-green-500/20  text-green-400",
  Rejected: "bg-red-500/20    text-red-400",
};

const CHART_PERIODS = ["Daily", "Weekly", "Monthly", "Yearly"];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatCurrency(n) {
  return "৳" + Number(n || 0).toLocaleString("en-IN");
}

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function startOfWeek() {
  const d = startOfToday();
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}

function tsToDate(ts) {
  if (!ts) return new Date(0);
  return ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
}

// ─────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, gold }) {
  return (
    <div className={`
      rounded-[28px] border p-6
      backdrop-blur-xl
      transition hover:-translate-y-1 duration-300
      ${gold
        ? "border-[#C6922B]/30 bg-gradient-to-br from-[#C6922B]/15 to-[#C6922B]/5"
        : "border-white/10 bg-white/5"
      }
    `}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
          ${gold ? "bg-[#C6922B] text-black" : "bg-white/10 text-[#C6922B]"}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${gold ? "text-[#C6922B]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SVG BAR CHART (no external library)
// ─────────────────────────────────────────────────────────────
function BarChart({ data, label }) {

  const W = 600, H = 200, PAD = 40;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = (W - PAD * 2) / (data.length || 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H + 40}`}
        className="w-full min-w-[320px]"
        style={{ maxHeight: 260 }}
      >
        {/* Y GRIDLINES */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD} y1={H - H * f + 10}
              x2={W - PAD} y2={H - H * f + 10}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
            <text
              x={PAD - 6} y={H - H * f + 14}
              fill="#6b7280" fontSize="10" textAnchor="end"
            >
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        {/* BARS */}
        {data.map((d, i) => {
          const bh = Math.max((d.value / max) * H, 2);
          const x = PAD + i * barW + barW * 0.15;
          const w = barW * 0.7;
          const y = H - bh + 10;

          return (
            <g key={i}>
              {/* BAR SHADOW */}
              <rect x={x + 2} y={y + 2} width={w} height={bh}
                fill="rgba(198,146,43,0.15)" rx="6" />
              {/* BAR */}
              <rect x={x} y={y} width={w} height={bh}
                fill="url(#barGrad)" rx="6" />
              {/* VALUE LABEL */}
              {d.value > 0 && (
                <text
                  x={x + w / 2} y={y - 4}
                  fill="#C6922B" fontSize="9" textAnchor="middle" fontWeight="bold"
                >
                  {d.value > 999 ? (d.value / 1000).toFixed(1) + "k" : d.value}
                </text>
              )}
              {/* X LABEL */}
              <text
                x={x + w / 2} y={H + 28}
                fill="#6b7280" fontSize="9" textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C6922B" />
            <stop offset="100%" stopColor="#8B6520" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PartnerEarningsPage() {

  const navigate = useNavigate();

  // ── VIEWER IDENTITY ──────────────────────────────────────
  const [viewerInfo, setViewerInfo] = useState(null);
  const [resolvingViewer, setResolvingViewer] = useState(true);

  // ── RAW DATA ─────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [partner, setPartner] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [allPartners, setAllPartners] = useState([]); // admin only

  // ── LOADING ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ── ACTIVE ADMIN PARTNER FILTER ──────────────────────────
  const [selectedPartnerId, setSelectedPartnerId] = useState("all");

  // ── CHART PERIOD ─────────────────────────────────────────
  const [chartPeriod, setChartPeriod] = useState("Monthly");

  // ── FILTERS ──────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterPayment, setFilterPayment] = useState("All");

  // ── WITHDRAW FORM ────────────────────────────────────────
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    method: "Bkash",
    accountNumber: "",
    accountName: "",
  });
  const [withdrawing, setWithdrawing] = useState(false);

  // ── ACTIVE TAB ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("overview");

  // ─────────────────────────────────────────────────────────
  // RESOLVE VIEWER IDENTITY
  // ─────────────────────────────────────────────────────────
  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {

        if (ADMIN_EMAILS.includes(currentUser.email)) {

          setViewerInfo({
            uid: currentUser.uid,
            isAdmin: true,
            partnerSlug: "zyvar",
          });

          setResolvingViewer(false);
          return;
        }

        const partnerRef = doc(db, "partnerApplications", currentUser.uid);
        const partnerSnap = await getDoc(partnerRef);

        if (
          partnerSnap.exists() &&
          partnerSnap.data().status === "approved"
        ) {

          setViewerInfo({
            uid: currentUser.uid,
            isAdmin: false,
            partnerSlug: partnerSnap.data().slug || "",
          });

        } else {

          navigate("/");
        }

      } catch (err) {

        console.log(err);

      } finally {

        setResolvingViewer(false);
      }
    });

    return () => unsubscribe();

  }, []);

  // ─────────────────────────────────────────────────────────
  // FETCH ALL DATA
  // ─────────────────────────────────────────────────────────
  useEffect(() => {

    if (!viewerInfo) return;

    const fetchAll = async () => {

      try {

        setLoading(true);

        // FETCH PARTNER DOC (for commission rate, balance info)
        if (!viewerInfo.isAdmin) {

          const pQuery = query(
            collection(db, "partners"),
            where("slug", "==", viewerInfo.partnerSlug)
          );

          const pSnap = await getDocs(pQuery);

          if (!pSnap.empty) {
            setPartner({ id: pSnap.docs[0].id, ...pSnap.docs[0].data() });
          }

        } else {

          // Admin: fetch all partners for the switcher
          const allPSnap = await getDocs(collection(db, "partners"));

          const pList = allPSnap.docs.map((d) => ({
            id: d.id, ...d.data(),
          }));

          setAllPartners(pList);
        }

        // FETCH ORDERS — admin gets all, partner gets own
        const ordersSnap = await getDocs(collection(db, "orders"));

        const allOrders = ordersSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
        }));

        if (viewerInfo.isAdmin) {

          setOrders(allOrders);

        } else {

          // Filter to orders that contain this partner's items
          const ownSlug = viewerInfo.partnerSlug;

          const ownOrders = allOrders
            .map((order) => {

              const ownItems = Array.isArray(order.items)
                ? order.items.filter(
                    (item) => (item.partnerSlug || "zyvar") === ownSlug
                  )
                : [];

              if (!ownItems.length) return null;

              const ownSubtotal = ownItems.reduce(
                (acc, item) =>
                  acc + Number(item.price || 0) * Number(item.quantity || 1),
                0
              );

              return { ...order, items: ownItems, ownSubtotal };
            })
            .filter(Boolean);

          setOrders(ownOrders);
        }

        // FETCH PRODUCTS
        const prodSnap = await getDocs(collection(db, "products"));
        setProducts(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // FETCH WITHDRAWALS
        let wQuery;

        if (viewerInfo.isAdmin) {
          wQuery = collection(db, "withdrawRequests");
        } else {
          wQuery = query(
            collection(db, "withdrawRequests"),
            where("partnerSlug", "==", viewerInfo.partnerSlug)
          );
        }

        const wSnap = await getDocs(wQuery);

        const wList = wSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );

        setWithdrawals(wList);

      } catch (err) {

        console.log(err);

      } finally {

        setLoading(false);
      }
    };

    fetchAll();

  }, [viewerInfo]);

  // ─────────────────────────────────────────────────────────
  // COMMISSION RATE
  // Reads per-partner rate from partner doc, falls back to default
  // ─────────────────────────────────────────────────────────
  const commissionRate = useMemo(() => {

    if (partner?.commissionRate != null) {
      return Number(partner.commissionRate);
    }

    return DEFAULT_COMMISSION;

  }, [partner]);

  // ─────────────────────────────────────────────────────────
  // COMPUTED EARNINGS FROM RAW ORDERS
  // For each order, partnerIncome = ownSubtotal * (1 - commissionRate)
  // ─────────────────────────────────────────────────────────
  const enrichedOrders = useMemo(() => {

    // Admin with a selected partner — filter orders for that partner
    let baseOrders = orders;

    if (viewerInfo?.isAdmin && selectedPartnerId !== "all") {

      const selPartner = allPartners.find((p) => p.id === selectedPartnerId);

      if (selPartner) {

        baseOrders = orders
          .map((order) => {

            const ownItems = Array.isArray(order.items)
              ? order.items.filter(
                  (item) =>
                    (item.partnerSlug || "zyvar") === selPartner.slug
                )
              : [];

            if (!ownItems.length) return null;

            const ownSubtotal = ownItems.reduce(
              (acc, item) =>
                acc + Number(item.price || 0) * Number(item.quantity || 1),
              0
            );

            return { ...order, items: ownItems, ownSubtotal };
          })
          .filter(Boolean);
      }
    }

    return baseOrders.map((order) => {

      const subtotal =
        Number(order.ownSubtotal) ||
        Number(order.productSubtotal) ||
        Number(order.subtotal) ||
        (Array.isArray(order.items)
          ? order.items.reduce(
              (acc, item) =>
                acc +
                Number(item.price || 0) * Number(item.quantity || 1),
              0
            )
          : 0);

      const shipping = Number(order.shipping || 0);
      const commission = subtotal * commissionRate;
      const partnerIncome = subtotal - commission;

      return {
        ...order,
        _subtotal: subtotal,
        _shipping: shipping,
        _commission: commission,
        _partnerIncome: partnerIncome,
        _date: tsToDate(order.createdAt),
      };
    });

  }, [orders, commissionRate, selectedPartnerId, allPartners, viewerInfo]);

  // ─────────────────────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {

    const delivered = enrichedOrders.filter(
      (o) => o.status === "Delivered"
    );

    const pending = enrichedOrders.filter(
      (o) => o.status === "Pending" || o.status === "Confirmed"
    );

    const cancelled = enrichedOrders.filter(
      (o) => o.status === "Cancelled"
    );

    const refunded = enrichedOrders.filter(
      (o) => o.status === "Refunded"
    );

    const totalRevenue = delivered.reduce(
      (acc, o) => acc + o._partnerIncome, 0
    );

    const today = startOfToday();
    const week = startOfWeek();
    const month = startOfMonth();
    const year = startOfYear();

    const todaySales = delivered
      .filter((o) => o._date >= today)
      .reduce((acc, o) => acc + o._partnerIncome, 0);

    const weekSales = delivered
      .filter((o) => o._date >= week)
      .reduce((acc, o) => acc + o._partnerIncome, 0);

    const monthSales = delivered
      .filter((o) => o._date >= month)
      .reduce((acc, o) => acc + o._partnerIncome, 0);

    const yearSales = delivered
      .filter((o) => o._date >= year)
      .reduce((acc, o) => acc + o._partnerIncome, 0);

    const totalProductsSold = delivered.reduce(
      (acc, o) =>
        acc +
        (Array.isArray(o.items)
          ? o.items.reduce(
              (s, item) => s + Number(item.quantity || 1), 0
            )
          : 0),
      0
    );

    const avgOrderValue =
      delivered.length > 0
        ? totalRevenue / delivered.length
        : 0;

    // WITHDRAWALS
    const withdrawn = withdrawals
      .filter(
        (w) => w.status === "Approved" || w.status === "Paid"
      )
      .reduce((acc, w) => acc + Number(w.amount || 0), 0);

    const pendingWithdrawal = withdrawals
      .filter((w) => w.status === "Pending")
      .reduce((acc, w) => acc + Number(w.amount || 0), 0);

    const availableBalance = totalRevenue - withdrawn;

    return {
      totalRevenue,
      totalOrders: enrichedOrders.length,
      completedOrders: delivered.length,
      pendingOrders: pending.length,
      cancelledOrders: cancelled.length,
      refundedOrders: refunded.length,
      todaySales,
      weekSales,
      monthSales,
      yearSales,
      totalProductsSold,
      avgOrderValue,
      withdrawn,
      pendingWithdrawal,
      availableBalance,
    };

  }, [enrichedOrders, withdrawals]);

  // ─────────────────────────────────────────────────────────
  // CHART DATA
  // ─────────────────────────────────────────────────────────
  const chartData = useMemo(() => {

    const delivered = enrichedOrders.filter(
      (o) => o.status === "Delivered"
    );

    if (chartPeriod === "Daily") {

      // Last 14 days
      return Array.from({ length: 14 }, (_, i) => {

        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        d.setHours(0, 0, 0, 0);

        const next = new Date(d);
        next.setDate(next.getDate() + 1);

        const value = Math.round(
          delivered
            .filter((o) => o._date >= d && o._date < next)
            .reduce((acc, o) => acc + o._partnerIncome, 0)
        );

        return {
          label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
          value,
        };
      });
    }

    if (chartPeriod === "Weekly") {

      // Last 8 weeks
      return Array.from({ length: 8 }, (_, i) => {

        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        end.setHours(23, 59, 59, 999);

        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const value = Math.round(
          delivered
            .filter((o) => o._date >= start && o._date <= end)
            .reduce((acc, o) => acc + o._partnerIncome, 0)
        );

        return {
          label: `W${8 - i}`,
          value,
        };
      }).reverse();
    }

    if (chartPeriod === "Monthly") {

      const months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec",
      ];

      return months.map((label, m) => {

        const value = Math.round(
          delivered
            .filter((o) => {
              const d = o._date;
              return (
                d.getFullYear() === new Date().getFullYear() &&
                d.getMonth() === m
              );
            })
            .reduce((acc, o) => acc + o._partnerIncome, 0)
        );

        return { label, value };
      });
    }

    // Yearly — last 5 years
    return Array.from({ length: 5 }, (_, i) => {

      const yr = new Date().getFullYear() - (4 - i);

      const value = Math.round(
        delivered
          .filter((o) => o._date.getFullYear() === yr)
          .reduce((acc, o) => acc + o._partnerIncome, 0)
      );

      return { label: String(yr), value };
    });

  }, [enrichedOrders, chartPeriod]);

  // ─────────────────────────────────────────────────────────
  // FILTERED ORDERS for Recent Orders table
  // ─────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {

    return enrichedOrders
      .filter((o) => {

        if (
          search &&
          !o.id.toLowerCase().includes(search.toLowerCase()) &&
          !(o.name || "").toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }

        if (filterStatus !== "All" && o.status !== filterStatus) {
          return false;
        }

        if (filterFrom) {
          const from = new Date(filterFrom);
          if (o._date < from) return false;
        }

        if (filterTo) {
          const to = new Date(filterTo);
          to.setHours(23, 59, 59, 999);
          if (o._date > to) return false;
        }

        if (
          filterPayment !== "All" &&
          (o.paymentMethod || "") !== filterPayment
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b._date - a._date);

  }, [enrichedOrders, search, filterStatus, filterFrom, filterTo, filterPayment]);

  // ─────────────────────────────────────────────────────────
  // TOP PRODUCTS
  // ─────────────────────────────────────────────────────────
  const topProducts = useMemo(() => {

    const map = {};

    enrichedOrders
      .filter((o) => o.status === "Delivered")
      .forEach((o) => {
        (o.items || []).forEach((item) => {
          const key = item.id || item.name;
          if (!map[key]) {
            map[key] = {
              name: item.name || "Unknown",
              qty: 0,
              revenue: 0,
            };
          }
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          map[key].qty += qty;
          map[key].revenue += qty * price * (1 - commissionRate);
        });
      });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

  }, [enrichedOrders, commissionRate]);

  // ─────────────────────────────────────────────────────────
  // EXPORT CSV
  // ─────────────────────────────────────────────────────────
  const exportCSV = () => {

    const headers = [
      "Order ID","Customer","Date","Status",
      "Subtotal","Commission","Partner Income","Payment",
    ];

    const rows = filteredOrders.map((o) => [
      o.id,
      o.name || "—",
      formatDate(o.createdAt),
      o.status || "—",
      o._subtotal.toFixed(2),
      o._commission.toFixed(2),
      o._partnerIncome.toFixed(2),
      o.paymentMethod || "—",
    ]);

    const csv =
      [headers, ...rows]
        .map((r) => r.map((c) => `"${c}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zyvar-earnings-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────
  // SUBMIT WITHDRAWAL REQUEST
  // ─────────────────────────────────────────────────────────
  const handleWithdraw = async (e) => {

    e.preventDefault();

    const amount = Number(withdrawForm.amount);

    if (!amount || amount <= 0) {
      await warningAlert("Invalid Amount", "Please enter a valid withdrawal amount.");
      return;
    }

    if (amount > stats.availableBalance) {
      await warningAlert(
        "Insufficient Balance",
        `Your available balance is ${formatCurrency(stats.availableBalance)}.`
      );
      return;
    }

    if (!withdrawForm.accountNumber.trim()) {
      await warningAlert("Account Required", "Please enter your account number.");
      return;
    }

    try {

      setWithdrawing(true);

      const newRequest = {
        partnerSlug: viewerInfo.partnerSlug,
        partnerId: viewerInfo.uid,
        amount,
        method: withdrawForm.method,
        accountNumber: withdrawForm.accountNumber.trim(),
        accountName: withdrawForm.accountName.trim(),
        status: "Pending",
        adminNote: "",
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(
        collection(db, "withdrawRequests"),
        newRequest
      );

      setWithdrawals([
        { id: ref.id, ...newRequest, createdAt: { seconds: Date.now() / 1000 } },
        ...withdrawals,
      ]);

      setWithdrawForm({
        amount: "",
        method: "Bkash",
        accountNumber: "",
        accountName: "",
      });

      await successAlert(
        "Request Submitted",
        "Your withdrawal request has been submitted and is pending admin approval."
      );

    } catch (err) {

      console.log(err);

      await errorAlert("Failed", "Could not submit withdrawal request.");

    } finally {

      setWithdrawing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────
  if (resolvingViewer || loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading earnings...</p>
        </div>
      </div>
    );
  }

  // TABS
  const TABS = [
    { id: "overview",    label: "Overview" },
    { id: "orders",      label: "Orders" },
    { id: "products",    label: "Top Products" },
    { id: "withdraw",    label: "Withdraw" },
    { id: "history",     label: "Withdrawal History" },
  ];

  // ACTIVE PARTNER for admin view
  const activePartner =
    viewerInfo.isAdmin && selectedPartnerId !== "all"
      ? allPartners.find((p) => p.id === selectedPartnerId)
      : null;

  const activeCommission =
    activePartner?.commissionRate != null
      ? Number(activePartner.commissionRate)
      : commissionRate;

  return (

    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 sm:px-6 lg:px-10 py-10">

      <div className="max-w-7xl mx-auto space-y-10">

        {/* ── PAGE HEADER ───────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">

          <div>
            <p className="uppercase tracking-[0.3em] text-[#C6922B] text-sm mb-3">
              {viewerInfo.isAdmin ? "ZYVAR ADMIN" : "PARTNER DASHBOARD"}
            </p>
            <h1 className="text-4xl md:text-5xl font-black leading-tight">
              Earnings
              <span className="block text-[#C6922B]">Dashboard</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              Commission rate:{" "}
              <span className="text-[#C6922B] font-bold">
                {((activeCommission || commissionRate) * 100).toFixed(0)}%
              </span>
              {" "}marketplace fee · Partner receives{" "}
              <span className="text-[#C6922B] font-bold">
                {(100 - (activeCommission || commissionRate) * 100).toFixed(0)}%
              </span>
            </p>
          </div>

          {/* ADMIN: PARTNER SWITCHER */}
          {viewerInfo.isAdmin && (

            <div className="relative">

              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="
                  appearance-none
                  px-6 py-4 pr-12
                  rounded-2xl
                  bg-white/5
                  border border-white/10
                  outline-none
                  focus:border-[#C6922B]
                  text-white
                  font-bold
                  cursor-pointer
                "
              >
                <option value="all">All Partners</option>
                {allPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shopName || p.slug}
                  </option>
                ))}
              </select>

              <FaChevronDown
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={12}
              />

            </div>
          )}

        </div>

        {/* ── TABS ──────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-5 py-3 rounded-2xl font-bold text-sm transition
                ${activeTab === tab.id
                  ? "bg-[#C6922B] text-black"
                  : "border border-white/10 bg-white/5 text-gray-300 hover:border-[#C6922B] hover:text-[#C6922B]"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════ */}
        {activeTab === "overview" && (

          <div className="space-y-10">

            {/* STAT CARDS */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">

              <StatCard
                icon={FaMoneyBillWave}
                label="Total Revenue"
                value={formatCurrency(stats.totalRevenue)}
                sub={`After ${((activeCommission || commissionRate) * 100).toFixed(0)}% commission`}
                gold
              />

              <StatCard
                icon={FaWallet}
                label="Available Balance"
                value={formatCurrency(stats.availableBalance)}
                sub="Ready to withdraw"
                gold
              />

              <StatCard
                icon={FaExchangeAlt}
                label="Withdrawn"
                value={formatCurrency(stats.withdrawn)}
              />

              <StatCard
                icon={FaClock}
                label="Pending Withdrawal"
                value={formatCurrency(stats.pendingWithdrawal)}
              />

              <StatCard
                icon={FaShoppingBag}
                label="Total Orders"
                value={stats.totalOrders}
              />

              <StatCard
                icon={FaCheckCircle}
                label="Completed Orders"
                value={stats.completedOrders}
              />

              <StatCard
                icon={FaTimesCircle}
                label="Cancelled Orders"
                value={stats.cancelledOrders}
              />

              <StatCard
                icon={FaUndo}
                label="Refunded Orders"
                value={stats.refundedOrders}
              />

              <StatCard
                icon={FaCalendarDay}
                label="Today's Sales"
                value={formatCurrency(stats.todaySales)}
              />

              <StatCard
                icon={FaCalendarWeek}
                label="This Week"
                value={formatCurrency(stats.weekSales)}
              />

              <StatCard
                icon={FaCalendar}
                label="This Month"
                value={formatCurrency(stats.monthSales)}
              />

              <StatCard
                icon={FaChartBar}
                label="This Year"
                value={formatCurrency(stats.yearSales)}
              />

              <StatCard
                icon={FaBoxOpen}
                label="Products Sold"
                value={stats.totalProductsSold}
              />

              <StatCard
                icon={FaPercentage}
                label="Avg Order Value"
                value={formatCurrency(stats.avgOrderValue)}
              />

            </div>

            {/* REVENUE CHART */}
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">

              <div className="flex flex-wrap items-center justify-between gap-4 mb-8">

                <div>
                  <p className="uppercase tracking-[0.3em] text-[#C6922B] text-xs mb-1">
                    Revenue Trend
                  </p>
                  <h2 className="text-2xl font-black">
                    {chartPeriod} Revenue
                  </h2>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {CHART_PERIODS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={`
                        px-4 py-2 rounded-xl font-bold text-xs transition
                        ${chartPeriod === p
                          ? "bg-[#C6922B] text-black"
                          : "border border-white/10 text-gray-400 hover:border-[#C6922B]"
                        }
                      `}
                    >
                      {p}
                    </button>
                  ))}
                </div>

              </div>

              <BarChart data={chartData} label="৳" />

            </div>

            {/* TOP PRODUCTS MINI */}
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">

              <h2 className="text-2xl font-black mb-6">
                Top Selling Products
              </h2>

              {topProducts.length === 0 ? (

                <p className="text-gray-400">No completed orders yet.</p>

              ) : (

                <div className="space-y-4">
                  {topProducts.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-[#C6922B]/20 text-[#C6922B] font-black text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <p className="font-bold break-words">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-6 text-sm shrink-0">
                        <span className="text-gray-400">{p.qty} sold</span>
                        <span className="font-black text-[#C6922B]">
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: ORDERS
        ══════════════════════════════════════════════ */}
        {activeTab === "orders" && (

          <div className="space-y-6">

            {/* FILTERS */}
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 space-y-4">

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* SEARCH */}
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                  <input
                    type="text"
                    placeholder="Search order ID or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B] text-sm"
                  />
                </div>

                {/* STATUS FILTER */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B] text-sm"
                >
                  {["All","Pending","Confirmed","Shipping","Delivered","Cancelled","Refunded"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                {/* DATE FROM */}
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B] text-sm"
                />

                {/* DATE TO */}
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B] text-sm"
                />

              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">

                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B] text-sm"
                >
                  {["All","COD","bKash","Nagad"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>

                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-[#C6922B]/30 bg-[#C6922B]/10 text-[#C6922B] font-bold text-sm hover:bg-[#C6922B] hover:text-black transition"
                >
                  <FaDownload size={13} />
                  Export CSV
                </button>

              </div>

            </div>

            {/* ORDERS TABLE */}
            {filteredOrders.length === 0 ? (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-12 text-center">
                <FaBoxOpen className="text-[#C6922B] mx-auto mb-4" size={36} />
                <p className="text-xl font-black mb-2">No Orders Found</p>
                <p className="text-gray-400">Try adjusting your filters.</p>
              </div>

            ) : (

              <div className="space-y-4">

                {filteredOrders.map((order) => (

                  <div
                    key={order.id}
                    className="rounded-[28px] border border-white/10 bg-white/5 p-6"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">

                      <div className="min-w-0">
                        <p className="text-gray-400 text-xs mb-1">Order ID</p>
                        <p className="text-[#C6922B] font-black break-all text-sm">
                          #{order.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 items-center">

                        <span className={`px-3 py-1 rounded-full border text-xs font-bold ${
                          STATUS_COLORS[order.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        }`}>
                          {order.status || "Pending"}
                        </span>

                        <span className="text-gray-400 text-xs">
                          {formatDate(order.createdAt)}
                        </span>

                      </div>

                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Customer</p>
                        <p className="font-bold text-sm break-words">{order.name || "—"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Payment</p>
                        <p className="font-bold text-sm">{order.paymentMethod || "—"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Subtotal</p>
                        <p className="font-bold text-sm">{formatCurrency(order._subtotal)}</p>
                      </div>

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Shipping</p>
                        <p className="font-bold text-sm">{formatCurrency(order._shipping)}</p>
                      </div>

                    </div>

                    {/* EARNINGS BREAKDOWN */}
                    <div className="rounded-2xl bg-black/20 border border-white/10 p-4 flex flex-wrap gap-6">

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Commission ({((activeCommission || commissionRate) * 100).toFixed(0)}%)</p>
                        <p className="text-red-400 font-black">-{formatCurrency(order._commission)}</p>
                      </div>

                      <div>
                        <p className="text-gray-500 text-xs mb-1">Your Income</p>
                        <p className="text-[#C6922B] font-black text-lg">{formatCurrency(order._partnerIncome)}</p>
                      </div>

                    </div>

                    {/* ITEMS */}
                    {Array.isArray(order.items) && order.items.length > 0 && (

                      <div className="mt-4 space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 text-sm text-gray-300"
                          >
                            <img
                              src={item.images?.[0] || item.image || "/placeholder.png"}
                              alt={item.name}
                              className="w-10 h-10 rounded-xl object-cover shrink-0"
                            />
                            <span className="flex-1 min-w-0 break-words">{item.name}</span>
                            <span className="shrink-0 text-gray-500">×{item.quantity || 1}</span>
                            <span className="shrink-0 font-bold">৳{Number(item.price || 0) * Number(item.quantity || 1)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                ))}

              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: TOP PRODUCTS
        ══════════════════════════════════════════════ */}
        {activeTab === "products" && (

          <div className="space-y-5">

            <h2 className="text-2xl font-black">Top Selling Products</h2>

            {topProducts.length === 0 ? (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-12 text-center">
                <FaBoxOpen className="text-[#C6922B] mx-auto mb-4" size={36} />
                <p className="text-xl font-black mb-2">No Sales Yet</p>
                <p className="text-gray-400">Products will appear here once orders are delivered.</p>
              </div>

            ) : (

              topProducts.map((p, i) => (

                <div
                  key={i}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-6 flex flex-wrap items-center justify-between gap-6"
                >

                  <div className="flex items-center gap-4 min-w-0">

                    <span className="w-10 h-10 rounded-2xl bg-[#C6922B]/20 text-[#C6922B] font-black flex items-center justify-center shrink-0 text-lg">
                      {i + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="font-black break-words">{p.name}</p>
                      <p className="text-gray-400 text-sm">{p.qty} units sold</p>
                    </div>

                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-gray-400 text-xs mb-1">Partner Income</p>
                    <p className="text-[#C6922B] font-black text-2xl">{formatCurrency(p.revenue)}</p>
                  </div>

                </div>
              ))
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: WITHDRAW (partner only)
        ══════════════════════════════════════════════ */}
        {activeTab === "withdraw" && (

          <div className="grid lg:grid-cols-2 gap-8">

            {/* BALANCE SUMMARY */}
            <div className="space-y-5">

              <div className="rounded-[28px] border border-[#C6922B]/30 bg-[#C6922B]/10 p-8">

                <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest">
                  Available Balance
                </p>

                <p className="text-5xl font-black text-[#C6922B] mb-2">
                  {formatCurrency(stats.availableBalance)}
                </p>

                <p className="text-gray-500 text-sm">
                  Total earned: {formatCurrency(stats.totalRevenue)} · Withdrawn: {formatCurrency(stats.withdrawn)}
                </p>

              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 space-y-4">

                <div className="flex justify-between">
                  <span className="text-gray-400">Total Revenue</span>
                  <span className="font-black">{formatCurrency(stats.totalRevenue)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Withdrawn</span>
                  <span className="font-black text-green-400">-{formatCurrency(stats.withdrawn)}</span>
                </div>

                <div className="flex justify-between border-t border-white/10 pt-4">
                  <span className="text-gray-400">Pending Requests</span>
                  <span className="font-black text-yellow-400">{formatCurrency(stats.pendingWithdrawal)}</span>
                </div>

                <div className="flex justify-between border-t border-white/10 pt-4">
                  <span className="font-black">Available Now</span>
                  <span className="font-black text-[#C6922B] text-lg">{formatCurrency(stats.availableBalance)}</span>
                </div>

              </div>

            </div>

            {/* WITHDRAW FORM — partner only */}
            {!viewerInfo.isAdmin ? (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-8">

                <h2 className="text-2xl font-black mb-8">Request Withdrawal</h2>

                <form onSubmit={handleWithdraw} className="space-y-6">

                  <div>
                    <label className="block mb-2 text-sm uppercase tracking-widest text-gray-400">
                      Amount (৳)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={stats.availableBalance}
                      value={withdrawForm.amount}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, amount: e.target.value })
                      }
                      placeholder={`Max: ${formatCurrency(stats.availableBalance)}`}
                      className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm uppercase tracking-widests text-gray-400">
                      Payment Method
                    </label>
                    <select
                      value={withdrawForm.method}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, method: e.target.value })
                      }
                      className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                    >
                      {["Bkash", "Nagad", "Rocket", "Bank"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm uppercase tracking-widest text-gray-400">
                      Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={withdrawForm.accountNumber}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, accountNumber: e.target.value })
                      }
                      placeholder="017XXXXXXXX"
                      className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm uppercase tracking-widest text-gray-400">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={withdrawForm.accountName}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, accountName: e.target.value })
                      }
                      placeholder="Account holder name"
                      className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={withdrawing || stats.availableBalance <= 0}
                    className="
                      w-full py-5 rounded-2xl
                      bg-[#C6922B] text-black
                      font-black text-lg
                      hover:scale-[1.01] transition
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {withdrawing ? "Submitting..." : "Request Withdrawal"}
                  </button>

                  <p className="text-gray-500 text-xs text-center">
                    Withdrawals are processed within 2–5 business days after admin approval.
                  </p>

                </form>

              </div>

            ) : (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 flex items-center justify-center">
                <p className="text-gray-400 text-center">
                  Withdrawal requests are submitted by partners. Admin reviews them in the withdrawal history tab.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: WITHDRAWAL HISTORY
        ══════════════════════════════════════════════ */}
        {activeTab === "history" && (

          <div className="space-y-5">

            <h2 className="text-2xl font-black">Withdrawal History</h2>

            {withdrawals.length === 0 ? (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-12 text-center">
                <FaMoneyBillWave className="text-[#C6922B] mx-auto mb-4" size={36} />
                <p className="text-xl font-black mb-2">No Withdrawals Yet</p>
                <p className="text-gray-400">Withdrawal requests will appear here.</p>
              </div>

            ) : (

              withdrawals.map((w) => (

                <div
                  key={w.id}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-6"
                >

                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div className="space-y-2 min-w-0">

                      <div className="flex flex-wrap items-center gap-3">

                        <p className="text-2xl font-black text-[#C6922B]">
                          {formatCurrency(w.amount)}
                        </p>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          WITHDRAW_STATUS_COLORS[w.status] || "bg-gray-500/20 text-gray-400"
                        }`}>
                          {w.status}
                        </span>

                      </div>

                      <div className="flex flex-wrap gap-5 text-sm">

                        <span className="text-gray-400">
                          Method: <span className="text-white font-bold">{w.method}</span>
                        </span>

                        <span className="text-gray-400 break-words">
                          Account: <span className="text-white font-bold">{w.accountNumber}</span>
                        </span>

                        {w.accountName && (
                          <span className="text-gray-400 break-words">
                            Name: <span className="text-white font-bold">{w.accountName}</span>
                          </span>
                        )}

                        {viewerInfo.isAdmin && w.partnerSlug && (
                          <span className="text-gray-400">
                            Partner: <span className="text-[#C6922B] font-bold">{w.partnerSlug}</span>
                          </span>
                        )}

                      </div>

                      {w.adminNote && (
                        <p className="text-sm text-yellow-400 break-words">
                          Admin Note: {w.adminNote}
                        </p>
                      )}

                    </div>

                    <p className="text-gray-500 text-sm whitespace-nowrap">
                      {formatDate(w.createdAt)}
                    </p>

                  </div>

                </div>
              ))
            )}

          </div>
        )}

      </div>

    </div>
  );
}