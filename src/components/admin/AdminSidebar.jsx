import {
  FaChartPie,
  FaBoxOpen,
  FaShoppingBag,
  FaCog,
  FaPlus,
  FaSignOutAlt,
  FaClipboardList,
  FaHandshake,
  FaTicketAlt,
  FaUsers,
} from "react-icons/fa";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "../../firebase/firebase";

export default function AdminSidebar() {

  const navigate =
    useNavigate();

  const handleLogout =
    async () => {

      await signOut(auth);

      localStorage.removeItem(
        "zyvar-admin"
      );

      navigate(
        "/admin-login"
      );
    };

  const goHome = () => {
    navigate("/");
  };

  const navClass =
    ({ isActive }) =>

      `w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition duration-300 ${
        isActive
          ? "bg-[#C6922B] text-black font-black shadow-xl shadow-yellow-500/10"
          : "border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B]"
      }`;

  return (

    <aside
      className="
        hidden lg:flex
        fixed
        left-0
        top-0
        z-50
        w-[280px]
        h-screen
        flex-col
        justify-between
        bg-[#111111]/95
        backdrop-blur-2xl
        border-r
        border-white/10
        p-6
        overflow-y-auto
        scrollbar-none
      "
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >

      {/* Hides scrollbar in WebKit (Chrome, Safari) */}
      <style>{`
        aside::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* TOP */}
      <div>

        {/* LOGO (links to home) */}
        <div className="mb-14">

          <div
            onClick={goHome}
            role="button"
            tabIndex={0}
            className="flex items-center gap-4 mb-5 cursor-pointer"
          >

            {/* Original logo image */}
            <img
              src="https://res.cloudinary.com/dhppdatrl/image/upload/v1778734083/w3ehnytbwrugrxptj9py.png"
              alt="ZYVAR Logo"
              className="w-14 h-14 rounded-3xl object-contain"
            />

            <div>

              <h1 className="text-4xl font-black tracking-[0.3em] text-[#C6922B] leading-none">
                ZYVAR
              </h1>

              <p className="text-gray-400 mt-2 uppercase text-[10px] tracking-[0.35em]">
                Ultimate Admin Panel
              </p>

            </div>

          </div>

        </div>

        {/* NAVIGATION */}
        <nav className="space-y-4">

          {/* 1. Dashboard */}
          <NavLink
            to="/admin/dashboard"
            className={navClass}
          >
            <FaChartPie className="text-lg" />
            Dashboard
          </NavLink>

          {/* 2. Upload Product */}
          <NavLink
            to="/admin/upload"
            className={navClass}
          >
            <FaPlus className="text-lg" />
            Upload Product
          </NavLink>

          {/* 3. Products */}
          <NavLink
            to="/admin/products"
            className={navClass}
          >
            <FaBoxOpen className="text-lg" />
            Products
          </NavLink>

          {/* 4. Orders */}
          <NavLink
            to="/admin/orders"
            className={navClass}
          >
            <FaShoppingBag className="text-lg" />
            Orders
          </NavLink>

          {/* 5. Product Requests */}
          <NavLink
            to="/admin/product-requests"
            className={navClass}
          >
            <FaClipboardList className="text-lg" />
            Product Requests
          </NavLink>

          {/* 6. Partner Applications */}
          <NavLink
            to="/admin/partner-applications"
            className={navClass}
          >
            <FaHandshake className="text-lg" />
            Partner Applications
          </NavLink>

          {/* 7. Partner Coupons */}
          <NavLink
            to="/admin/partner-coupons"
            className={navClass}
          >
            <FaTicketAlt className="text-lg" />
            Partner Coupons
          </NavLink>

          {/* 8. Users */}
          <NavLink
            to="/admin/users"
            className={navClass}
          >
            <FaUsers className="text-lg" />
            Users
          </NavLink>
          

          {/* 9. Settings */}
          <NavLink
            to="/admin/settings"
            className={navClass}
          >
            <FaCog className="text-lg" />
            Settings
          </NavLink>

        </nav>

      </div>

      {/* BOTTOM CARD: LOGOUT */}
      <div className="rounded-[35px] border border-white/10 bg-gradient-to-br from-[#1A1A1A] to-[#101010] p-6 mt-10 relative overflow-hidden">

        {/* GLOW */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#C6922B]/10 blur-[80px]" />

        <div className="relative z-10">

          <button
            onClick={handleLogout}
            className="w-full py-4 rounded-2xl bg-red-500 text-white font-black flex items-center justify-center gap-3 hover:opacity-90 transition duration-300"
          >
            <FaSignOutAlt />
            Logout Admin
          </button>

        </div>

      </div>

    </aside>
  );
}