import {
  useState,
  useEffect,
} from "react";

import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";

import {
  FaFacebookF,
  FaInstagram,
} from "react-icons/fa";

import {
  Home,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  LogOut,
  LogIn,
  UserPlus,
  Phone,
  Info,
  Search,
  Store,
} from "lucide-react";

// FIREBASE
import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  signOut,
} from "firebase/auth";

import { auth, db } from "../firebase/firebase";

import RequestProductModal from "./RequestProductModal";

// SLUG UTILITY
const toSlug = (name = "") =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

export default function Navbar() {

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [showSearch,
    setShowSearch] =
    useState(false);

  const [search,
    setSearch] =
    useState("");

  const [requestOpen,
    setRequestOpen] =
    useState(false);

  const [products,
    setProducts] =
    useState([]);

  const navigate = useNavigate();

  const location = useLocation();

  const isLoggedIn =
    localStorage.getItem(
      "zyvar-user"
    ) === "true";

  // FETCH PRODUCTS FROM FIREBASE
  useEffect(() => {

    const fetchProducts =
      async () => {

        try {

          const querySnapshot =
            await getDocs(
              collection(
                db,
                "products"
              )
            );

          const productsData =
            querySnapshot.docs.map(
              (doc) => ({

                _id: doc.id,

                ...doc.data(),
              })
            );

          setProducts(
            productsData
          );

        } catch (error) {

          console.log(
            "Firebase Fetch Error:",
            error
          );
        }
      };

    fetchProducts();

  }, []);

  // SEARCHABLE ITEMS
  const searchableItems = [

    {
      name: "Home",
      path: "/",
    },

    {
      name: "Products",
      path: "/products",
    },

    {
      name: "Stores",
      path: "/stores",
    },

    {
      name: "About",
      path: "/about",
    },

    {
      name: "Contact",
      path: "/contact",
    },

    {
      name: "Wishlist",
      path: "/wishlist",
    },

    {
      name: "Cart",
      path: "/cart",
    },

    {
      name: "Profile",
      path: "/profile",
    },

    {
      name: "My Orders",
      path: "/my-orders",
    },

    // REAL PRODUCTS — clean slug URL: /product/product-name
    ...products.map(
      (product) => ({

        name:
          product.name || "",

        path:
          `/product/${product.slug || toSlug(product.name)}`,

        image:
          product.image,

        price:
          product.price,

        isProduct: true,
      })
    ),
  ];

  // FILTER SEARCH RESULTS
  const filteredResults =
    searchableItems.filter((item) =>
      item.name
        ?.toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  // HIDE NAVBAR ON LOGIN & SIGNUP
  if (
    location.pathname === "/login" ||
    location.pathname === "/signup"
  ) {

    return null;
  }

  // LOGOUT
  // FIX: the previous version only cleared the "zyvar-user" localStorage flag and
  // navigated to /login — it never actually signed the user out of Firebase Auth.
  // This meant auth.currentUser remained populated after "logout", which (combined
  // with any code checking auth.currentUser as a fallback) could silently log the
  // user right back in the moment they landed on /login. signOut(auth) is now called
  // first so Firebase's own session is properly terminated, then local data is cleared.
  const handleLogout =
    async () => {

      try {

        await signOut(auth);

      } catch (error) {

        console.log(
          "Firebase signOut error:",
          error
        );
      }

      localStorage.removeItem(
        "zyvar-user"
      );

      localStorage.removeItem(
        "zyvar-user-id"
      );

      localStorage.removeItem(
        "zyvar-user-data"
      );

      localStorage.removeItem(
        "zyvar-remember"
      );

      navigate("/login");
    };

  return (
    <>

    <header className="fixed top-0 left-0 w-full z-50 bg-black/60 backdrop-blur-2xl border-b border-white/10">

      <div className="max-w-[1450px] mx-auto px-4 sm:px-6 lg:px-6 xl:px-8">

        <div className="h-16 flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-6">

            {/* LOGO */}
            <Link
              to="/"
              className="flex items-center gap-3"
            >

              {/* LOGO IMAGE */}
              <div className="w-9 h-9 flex items-center justify-center">

                <img
                  src="https://res.cloudinary.com/dhppdatrl/image/upload/v1778734083/w3ehnytbwrugrxptj9py.png"
                  alt="ZYVAR Logo"
                  className="
                    w-full
                    h-full
                    object-contain
                  "
                />

              </div>

              {/* BRAND NAME */}
              <h1 className="text-lg xl:text-xl font-black tracking-[0.16em] text-[#C6922B]">

                ZYVAR

              </h1>

            </Link>

            {/* DESKTOP MENU */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-white text-sm">

              <Link
                to="/"
                className="flex items-center gap-2 hover:text-[#C6922B] transition"
              >

                <Home size={18} />

                Home

              </Link>

              <Link
                to="/products"
                className="flex items-center gap-2 hover:text-[#C6922B] transition"
              >

                <ShoppingBag size={18} />

                Products

              </Link>

              <Link
                to="/stores"
                className="flex items-center gap-2 hover:text-[#C6922B] transition"
              >

                <Store size={18} />

                Stores

              </Link>

              <Link
                to="/about"
                className="flex items-center gap-2 hover:text-[#C6922B] transition"
              >

                <Info size={18} />

                About

              </Link>

              <Link
                to="/contact"
                className="flex items-center gap-2 hover:text-[#C6922B] transition"
              >

                <Phone size={18} />

                Contact

              </Link>

            </nav>

          </div>

          {/* RIGHT */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 text-white">

            {/* SOCIALS */}
            <div className="flex items-center gap-3 mr-4">

              <a
                href="https://www.facebook.com/zyvar.shop"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] hover:text-[#C6922B] transition"
              >

                <FaFacebookF />

              </a>

              <a
                href="https://www.instagram.com/zyvar.shop"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] hover:text-[#C6922B] transition"
              >

                <FaInstagram />

              </a>

            </div>

            {/* SEARCH BUTTON */}
            <button

              onClick={() =>
                setShowSearch(
                  !showSearch
                )
              }

              className="
                w-12
                h-12
                rounded-2xl
                border
                border-white/10
                bg-white/5
                flex
                items-center
                justify-center
                hover:border-[#D4AF37]
                hover:text-[#D4AF37]
                transition
              "
            >

              {
                showSearch

                  ? <X size={20} />

                  : <Search size={20} />
              }

            </button>

            {/* Wishlist */}
            <button
              onClick={() =>
                navigate("/wishlist")
              }
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Heart size={20} />

            </button>

            {/* Cart */}
            <button
              onClick={() =>
                navigate("/cart")
              }
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <ShoppingBag size={20} />

            </button>

            {/* Profile */}
            <button
              onClick={() =>
                navigate("/profile")
              }
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <User size={20} />

            </button>

            {/* LOGIN / LOGOUT */}
            {!isLoggedIn ? (

              <>

                <button
                  onClick={() =>
                    navigate("/login")
                  }
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-2xl border border-white/10 bg-white/5 text-white hover:border-[#C6922B] hover:text-[#C6922B] transition"
                >

                  <LogIn size={18} />

                  Login

                </button>

                <button
                  onClick={() =>
                    navigate("/signup")
                  }
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-2xl bg-[#C6922B] text-black font-bold hover:scale-105 transition"
                >

                  <UserPlus size={18} />

                  Signup

                </button>

              </>

            ) : (

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-2xl bg-red-500 text-white font-bold hover:scale-105 transition"
              >

                <LogOut size={18} />

                Logout

              </button>

            )}

          </div>

          {/* MOBILE RIGHT — search button only, no X here since menu has its own */}
          <div className="lg:hidden flex items-center gap-3">

            {/* MOBILE SEARCH BUTTON */}
            <button

              onClick={() => {

                setShowSearch(
                  !showSearch
                );

                // CLOSE MENU WHEN OPENING SEARCH
                if (!showSearch) {
                  setMenuOpen(false);
                }
              }}

              className="
                w-10
                h-10
                rounded-2xl
                border
                border-white/10
                bg-white/5
                text-white
                flex
                items-center
                justify-center
              "
            >

              {/* ONLY SHOW SEARCH ICON — X is handled inside the search bar */}
              <Search size={20} />

            </button>

            {/* MOBILE MENU TOGGLE */}
            <button
              onClick={() => {

                setMenuOpen(!menuOpen);

                // CLOSE SEARCH WHEN OPENING MENU
                if (!menuOpen) {
                  setShowSearch(false);
                }
              }}
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 text-white flex items-center justify-center"
            >

              {menuOpen
                ? <X />
                : <Menu />}

            </button>

          </div>

        </div>

      </div>

      {/* FLOATING SEARCH BAR */}
      {
        showSearch && !requestOpen && (

          <div
            className="
              absolute
              top-full
              left-0
              w-full
              border-b
              border-white/10
              bg-[#0B0B0B]/95
              backdrop-blur-2xl
              p-4
              animate-in
              fade-in
              slide-in-from-top-2
              duration-300
            "
          >

            <div className="max-w-4xl mx-auto">

              <div
                className="
                  flex
                  items-center
                  gap-4
                  px-6
                  py-5
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/5
                "
              >

                <Search
                  size={22}
                  className="text-[#D4AF37]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search premium products..."
                  autoFocus
                  className="
                    flex-1
                    bg-transparent
                    outline-none
                    text-lg
                    text-white
                    placeholder:text-gray-500
                  "
                />

                {/* SINGLE CLOSE BUTTON INSIDE SEARCH BAR */}
                <button
                  onClick={() => {

                    setShowSearch(false);

                    setSearch("");
                  }}
                  className="
                    w-9
                    h-9
                    rounded-xl
                    border
                    border-white/10
                    bg-white/5
                    flex
                    items-center
                    justify-center
                    text-gray-400
                    hover:text-white
                    hover:border-white/30
                    transition
                    flex-shrink-0
                  "
                >
                  <X size={18} />
                </button>

              </div>

              <button
                onClick={() => {

                  // CLOSE SEARCH BAR
                  setShowSearch(false);

                  // CLOSE MOBILE MENU
                  setMenuOpen(false);

                  // OPEN REQUEST MODAL
                  setRequestOpen(true);
                }}
                className="
                  w-full
                  mt-4
                  py-4
                  rounded-2xl
                  border
                  border-[#C6922B]/20
                  bg-[#C6922B]/10
                  text-[#C6922B]
                  font-bold
                "
              >

                Can't find product?
                Request It

              </button>

              {/* SEARCH RESULTS */}
              {
                search.length > 0 && (

                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">

                    {
                      filteredResults.length > 0 ? (

                        filteredResults.map(
                          (
                            item,
                            index
                          ) => (

                            <button
                              key={index}
                              onClick={() => {

                                navigate(
                                  item.path
                                );

                                setShowSearch(
                                  false
                                );

                                setSearch("");
                              }}
                              className="
                                w-full
                                text-left
                                px-6
                                py-4
                                border-b
                                border-white/10
                                text-white
                                hover:bg-white/10
                                hover:text-[#D4AF37]
                                transition
                                flex
                                items-center
                                gap-4
                              "
                            >

                              {
                                item.isProduct &&
                                item.image && (

                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="
                                      w-14
                                      h-14
                                      rounded-xl
                                      object-cover
                                      border
                                      border-white/10
                                    "
                                  />

                                )
                              }

                              <div>

                                <h3 className="font-semibold">

                                  {item.name}

                                </h3>

                                {
                                  item.isProduct && (

                                    <p className="text-sm text-[#D4AF37]">

                                      ৳{item.price}

                                    </p>

                                  )
                                }

                              </div>

                            </button>

                          )
                        )

                      ) : (

                        <div
                          className="
                            px-6
                            py-5
                            text-gray-400
                          "
                        >

                          No results found.

                        </div>

                      )
                    }

                  </div>

                )
              }

            </div>

          </div>
        )

      }

      {/* MOBILE MENU */}
      <div
        className={`lg:hidden fixed top-16 left-0 w-full h-[calc(100vh-64px)] bg-black/95 backdrop-blur-2xl border-t border-white/10 text-white transition-all duration-300 overflow-y-auto z-40 ${
          menuOpen
            ? "translate-x-0 opacity-100 visible"
            : "-translate-x-full opacity-0 invisible"
        }`}
      >

        <div className="px-6 py-8 flex flex-col min-h-full">

          {/* HEADER */}
          <div className="flex items-center justify-between mb-10">

            <h2 className="text-2xl font-black tracking-[0.2em] text-[#C6922B]">
              MENU
            </h2>

            <button
              onClick={() =>
                setMenuOpen(false)
              }
              className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"
            >

              <X size={22} />

            </button>

          </div>

          {/* MOBILE NAV LINKS */}
          <div className="flex flex-col gap-4">

            <Link
              to="/"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Home size={20} />

              Home

            </Link>

            <Link
              to="/products"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <ShoppingBag size={20} />

              Products

            </Link>

            <Link
              to="/stores"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Store size={20} />

              Stores

            </Link>

            <Link
              to="/about"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Info size={20} />

              About

            </Link>

            <Link
              to="/contact"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Phone size={20} />

              Contact

            </Link>

            <Link
              to="/wishlist"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <Heart size={20} />

              Wishlist

            </Link>

            <Link
              to="/cart"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <ShoppingBag size={20} />

              Cart

            </Link>

            <Link
              to="/profile"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <User size={20} />

              Profile

            </Link>

            <Link
              to="/my-orders"
              onClick={() =>
                setMenuOpen(false)
              }
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <ShoppingBag size={20} />

              My Orders

            </Link>

          </div>

          {/* SOCIAL LINKS */}
          <div className="flex items-center gap-4 mt-10">

            <a
              href="https://www.facebook.com/zyvar.shop"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <FaFacebookF />

            </a>

            <a
              href="https://www.instagram.com/zyvar.shop"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#C6922B] hover:text-[#C6922B] transition"
            >

              <FaInstagram />

            </a>

          </div>

          {/* LOGIN / LOGOUT */}
          <div className="mt-auto pt-10">

            {!isLoggedIn ? (

              <div className="space-y-4">

                <button
                  onClick={() => {

                    navigate("/login");

                    setMenuOpen(false);
                  }}
                  className="w-full py-4 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center gap-3 hover:border-[#C6922B] hover:text-[#C6922B] transition"
                >

                  <LogIn size={18} />

                  Login

                </button>

                <button
                  onClick={() => {

                    navigate("/signup");

                    setMenuOpen(false);
                  }}
                  className="w-full py-4 rounded-2xl bg-[#C6922B] text-black font-bold flex items-center justify-center gap-3 hover:scale-[1.02] transition"
                >

                  <UserPlus size={18} />

                  Signup

                </button>

              </div>

            ) : (

              <button
                onClick={() => {

                  handleLogout();

                  setMenuOpen(false);
                }}
                className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-3 hover:opacity-90 transition"
              >

                <LogOut size={18} />

                Logout

              </button>

            )}

          </div>

        </div>

      </div>

    </header>

    <RequestProductModal
      open={requestOpen}
      onClose={() => setRequestOpen(false)}
    />

    </>
  );
}