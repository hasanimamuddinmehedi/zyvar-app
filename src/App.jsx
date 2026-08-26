import {
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import {
  useEffect,
  Suspense,
  lazy,
} from "react";

// HOME IS LOADED EAGERLY (NOT LAZY) — it's the most common first-visit landing
// page (including from social media / search links), so we don't want it to wait
// behind a lazy-load chunk fetch. Every other page is lazy-loaded below: this means
// a first-time visitor landing on "/" only downloads the JS needed for Home, the
// Navbar, and shared chrome — NOT the code for Checkout, the entire Admin panel,
// the entire Partner panel, etc. Those chunks are only fetched when the user
// actually navigates to a route that needs them, which is what makes the initial
// load dramatically smaller and faster.
import Home from "./pages/Home";

import Navbar from "./components/Navbar";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import {
  trackPage,
} from "./utils/analytics";

/* ====================================================
   LAZY-LOADED PAGES
   Each of these becomes its own small JS chunk that Vercel/Vite serves on demand,
   instead of all being bundled into one giant file loaded on every visit.
==================================================== */

const Products =
  lazy(() => import("./pages/Products"));

const ProductDetails =
  lazy(() => import("./pages/ProductDetails"));

const Login =
  lazy(() => import("./pages/Login"));

const Cart =
  lazy(() => import("./pages/Cart"));

const Wishlist =
  lazy(() => import("./pages/Wishlist"));

const Checkout =
  lazy(() => import("./pages/Checkout"));

const Orders =
  lazy(() => import("./pages/Orders"));

const Payment =
  lazy(() => import("./pages/Payment"));

const Signup =
  lazy(() => import("./pages/Signup"));

const About =
  lazy(() => import("./pages/About"));

const Contact =
  lazy(() => import("./pages/Contact"));

const Profile =
  lazy(() => import("./pages/Profile"));

const ProfileSettings =
  lazy(() => import("./pages/ProfileSettings"));

const Partnersettings =
  lazy(() => import("./pages/Partnersettings"));

const OrderSuccess =
  lazy(() => import("./pages/OrderSuccess"));

const OrderTracking =
  lazy(() => import("./pages/OrderTracking"));

const MyOrders =
  lazy(() => import("./pages/MyOrders"));

/* ADMIN LAYOUT */
const AdminLayout =
  lazy(() => import("./pages/admin/AdminLayout"));

/* ADMIN PAGES */
const DashboardPage =
  lazy(() => import("./pages/admin/DashboardPage"));

const OrdersPage =
  lazy(() => import("./pages/admin/OrdersPage"));

const ProductsPage =
  lazy(() => import("./pages/admin/ProductsPage"));

const UploadPage =
  lazy(() => import("./pages/admin/UploadPage"));

const SettingsPage =
  lazy(() => import("./pages/admin/SettingsPage"));

const ProductRequestsPage =
  lazy(() => import("./pages/admin/ProductRequestsPage"));

const PartnerApplicationsPage =
  lazy(() => import("./pages/admin/PartnerApplicationsPage"));

const PartnerCouponsPage =
  lazy(() => import("./pages/admin/PartnerCouponsPage"));

const UsersPage =
  lazy(() => import("./pages/admin/UsersPage"));

const BecomePartnerPage =
  lazy(() => import("./pages/BecomePartnerPage"));

const PartnerStorePage =
  lazy(() => import("./pages/PartnerStorePage"));

const PartnerLayout =
  lazy(() => import("./pages/partner/PartnerLayout"));

const PartnerUploadProduct =
  lazy(() => import("./pages/partner/PartnerUploadProduct"));

const PartnerDashboardPage =
  lazy(() => import("./pages/partner/DashboardPage"));

const PartnerProductsPage =
  lazy(() => import("./pages/partner/ProductsPage"));

const PartnerOrdersPage =
  lazy(() => import("./pages/partner/OrdersPage"));

const PartnerReviewsPage =
  lazy(() => import("./pages/partner/ReviewsPage"));

const PartnerEarningsPage =
  lazy(() => import("./pages/partner/EarningsPage"));

const PartnerSettingsPage =
  lazy(() => import("./pages/partner/SettingsPage"));

import PartnerRoute from "./components/PartnerRoute";
import StoresPage from "./pages/StoresPage";

// SIMPLE FALLBACK SHOWN WHILE A LAZY CHUNK IS BEING FETCHED.
// Kept minimal and on-brand so route transitions don't flash an unstyled blank page.
function PageLoader() {

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B0B0B",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "3px solid rgba(198,146,43,0.25)",
          borderTopColor: "#C6922B",
          animation: "zyvar-spin 0.8s linear infinite",
        }}
      />

      <style>
        {`
          @keyframes zyvar-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

function AppContent() {

  const location =
    useLocation();

  // TRACK PAGE VIEW
  useEffect(() => {

    trackPage(
      location.pathname
    );

  }, [location]);

  // HIDE NAVBAR ON AUTH + ADMIN PAGES
  const hideNavbarRoutes = [
    "/login",
    "/signup",
    "/user-login",
  ];

  const shouldHideNavbar =

    hideNavbarRoutes.includes(
      location.pathname
    ) ||

    location.pathname.startsWith(
      "/admin"
    );

  return (

    <>
      {/* NAVBAR */}
      {
        !shouldHideNavbar && (
          <Navbar />
        )
      }

      {/* ROUTES — wrapped in Suspense so lazy-loaded pages show PageLoader
          while their chunk is being fetched, instead of a blank screen */}
      <Suspense fallback={<PageLoader />}>

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={
            <Home />
          }
        />

        {/* PRODUCTS */}
        <Route
          path="/products"
          element={
            <Products />
          }
        />

        {/* PRODUCT DETAILS — clean slug URL: /product/product-name */}
        <Route
          path="/product/:id"
          element={
            <ProductDetails />
          }
        />

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            <Login />
          }
        />

        {/* SIGNUP */}
        <Route
          path="/signup"
          element={
            <Signup />
          }
        />

        {/* CART */}
        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          }
        />

        {/* WISHLIST */}
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute>
              <Wishlist />
            </ProtectedRoute>
          }
        />

        {/* CHECKOUT */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />

        {/* PAYMENT */}
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />

        {/* PROFILE */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* PROFILE SETTINGS */}
        <Route
          path="/profile-settings"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/partner-settings"
          element={
            <ProtectedRoute>
              <Partnersettings />
            </ProtectedRoute>
          }
        />

        {/* USER ORDERS */}
        <Route
          path="/my-orders"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />

        {/* ORDER SUCCESS */}
        <Route
          path="/order-success/:id"
          element={
            <OrderSuccess />
          }
        />

        {/* ORDER TRACKING */}
        <Route
          path="/order-tracking/:id"
          element={
            <OrderTracking />
          }
        />

        {/* ABOUT */}
        <Route
          path="/about"
          element={
            <About />
          }
        />

        {/* CONTACT */}
        <Route
          path="/contact"
          element={
            <Contact />
          }
        />

        {/* ADMIN PANEL */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >

          {/* DASHBOARD */}
          <Route
            index
            element={
              <DashboardPage />
            }
          />

          <Route
            path="dashboard"
            element={
              <DashboardPage />
            }
          />

          {/* ORDERS */}
          <Route
            path="orders"
            element={
              <OrdersPage />
            }
          />

          {/* PRODUCTS */}
          <Route
            path="products"
            element={
              <ProductsPage />
            }
          />

          {/* UPLOAD */}
          <Route
            path="upload"
            element={
              <UploadPage />
            }
          />

          {/* SETTINGS */}
          <Route
            path="settings"
            element={
              <SettingsPage />
            }
          />

          {/* PRODUCT REQUESTS */}
          <Route
            path="product-requests"
            element={
              <ProductRequestsPage />
            }
          />
          <Route
  path="partner-applications"
  element={
    <PartnerApplicationsPage />
  }
/>
<Route
  path="partner-coupons"
  element={
    <PartnerCouponsPage />
  }
/>

<Route
  path="users"
  element={
    <UsersPage />
  }
/>
        </Route>

        {/* LEGACY ADMIN ORDERS PAGE */}
        <Route
          path="/orders"
          element={
            <AdminRoute>
              <Orders />
            </AdminRoute>
          }
        />

        {/* PUBLIC PARTNER STORE */}
<Route
  path="/:partnerSlug"
  element={
    <PartnerStorePage />
  }
/>

        <Route
  path="/become-partner"
  element={<BecomePartnerPage />}
/>

<Route
  path="/partner-dashboard"
  element={
    <PartnerRoute>
      <PartnerLayout />
    </PartnerRoute>
  }
>

  <Route
    index
    element={
      <PartnerDashboardPage />
    }
  />

  <Route
  path="uploads"
  element={
      <PartnerUploadProduct />
  }
/>

  <Route
    path="products"
    element={
      <PartnerProductsPage />
    }
  />

  <Route
    path="orders"
    element={
      <PartnerOrdersPage />
    }
  />

  <Route
    path="reviews"
    element={
      <PartnerReviewsPage />
    }
  />

  <Route
    path="earnings"
    element={
      <PartnerEarningsPage />
    }
  />

  <Route
    path="settings"
    element={
      <PartnerSettingsPage />
    }
  />

</Route>

<Route
  path="/stores"
  element={<StoresPage />}
/>

      </Routes>

      </Suspense>
    </>
  );
}

export default function App() {

  return (
    <AppContent />
  );
}