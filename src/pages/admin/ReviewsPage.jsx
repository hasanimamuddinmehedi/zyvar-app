import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  FaStar,
  FaTrash,
  FaCheck,
  FaTimes,
  FaStore,
  FaBoxOpen,
  FaGlobe,
  FaShieldAlt,
  FaUser,
  FaExclamationTriangle,
} from "react-icons/fa";

import {
  db,
  auth,
} from "../../firebase/firebase";

import {
  successAlert,
  errorAlert,
  confirmAlert,
} from "../../utils/alerts";

import {
  ADMIN_EMAILS,
} from "../../utils/adminCheck";

/*
  IMPORTANT — read this if a tab ever shows 0 reviews that you can
  see in the Firestore console:

  `ADMIN_EMAILS` only exists in this JS file. Firestore Security
  Rules have no idea who's "admin" unless your rules check the same
  thing (e.g. via a custom claim, or a hardcoded email/uid list in
  the rules themselves). Any query here that has no `where()` filter
  (fetchWebsiteReviews, the admin branch of fetchStoreReviews) needs
  a matching rule that unconditionally allows the admin to `list`
  that collection — a rule scoped to `resource.data.userId == uid`
  or `resource.data.featured == true` will silently reject an
  unfiltered query entirely, not just filter out non-matching docs.

  Example rule fix (Firestore rules, not JS):

    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email in [
          "admin1@zyvar.com", "admin2@zyvar.com"
        ];
    }

    match /websiteReviews/{id} {
      allow read: if isAdmin()
        || resource.data.featured == true
        || (request.auth != null && request.auth.uid == resource.data.userId);
      allow create: if request.auth != null;
      allow update, delete: if isAdmin();
    }

  (Email-in-rules works but is brittle to keep in sync; a Cloud
  Function that sets a custom claim `admin: true` on approved admin
  accounts, checked via `request.auth.token.admin == true`, is the
  more robust long-term fix.)

  ─────────────────────────────────────────────────────────────
  UPDATE — "type" field fix (website reviews leaking into other
  tabs):

  All three review kinds (website / product / store) live in the
  SAME "reviews" collection. They're told apart by a `type` field:
  "website", "product", or "store" (Testimonials.jsx already writes
  `type: "website"` on every customer submission — see that file).

  fetchWebsiteReviews used to run a completely unfiltered
  `getDocs(collection(db, "reviews"))`, which returned EVERY
  document in the collection — including store reviews (which carry
  a `partnerSlug`) and product reviews (which carry a `productId`).
  That's why the Website Reviews tab was showing store/product
  reviews too. It's now filtered with `where("type", "==",
  "website")`, and the admin's own website-review submission form
  below now stamps `type: "website"` on what it writes so it stays
  consistent with Testimonials.jsx.

  fetchProductReviews previously used `where("productId", "!=",
  "")`, which is a fragile way to isolate product reviews (it
  depends on every product review doc always having that field and
  no other review type ever having it). It now filters on
  `where("type", "==", "product")` instead, matching the same
  pattern. If your product review submission code doesn't yet write
  `type: "product"`, add it there so those reviews keep showing up
  here.
*/

// STAR DISPLAY — renders N filled stars out of 5
function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          size={13}
          className={
            star <= Math.round(rating || 0)
              ? "text-[#C6922B]"
              : "text-white/10"
          }
        />
      ))}
      <span className="text-gray-400 text-xs ml-1">
        {Number(rating || 0).toFixed(1)}
      </span>
    </div>
  );
}

// ERROR BANNER — shown inline on a tab when a fetch fails
// (most commonly a Firestore permission-denied)
function FetchErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="rounded-[24px] border border-red-500/30 bg-red-500/5 px-6 py-5 flex items-start gap-4">
      <FaExclamationTriangle className="text-red-400 shrink-0 mt-1" size={18} />
      <div>
        <p className="font-bold text-red-400 mb-1">Couldn't load reviews</p>
        <p className="text-gray-400 text-sm break-words">{error}</p>
        <p className="text-gray-500 text-xs mt-2">
          If this says "permission-denied" or "insufficient permissions", it's a
          Firestore Security Rules issue, not a bug in this page — see the
          comment at the top of ReviewsPage.jsx.
        </p>
      </div>
    </div>
  );
}

// FORMAT DATE from Firestore timestamp or Date string
function formatDate(ts) {
  if (!ts) return "—";
  const d =
    ts?.seconds
      ? new Date(ts.seconds * 1000)
      : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// TAB IDS
const TABS = {
  WEBSITE: "website",
  PRODUCT: "product",
  STORE: "store",
};

export default function ReviewsPage() {

  // ─── VIEWER IDENTITY ───────────────────────────────────
  const [viewerInfo,
    setViewerInfo] =
    useState(null);

  const [resolvingViewer,
    setResolvingViewer] =
    useState(true);

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {

          if (!currentUser) {

            setViewerInfo(null);

            setResolvingViewer(false);

            return;
          }

          try {

            if (
              ADMIN_EMAILS.includes(
                currentUser.email
              )
            ) {

              setViewerInfo({
                uid: currentUser.uid,
                isAdmin: true,
                partnerSlug: "zyvar",
              });

              setResolvingViewer(false);

              return;
            }

            const partnerRef =
              doc(
                db,
                "partnerApplications",
                currentUser.uid
              );

            const partnerSnap =
              await getDoc(partnerRef);

            if (
              partnerSnap.exists() &&
              partnerSnap.data().status === "approved"
            ) {

              setViewerInfo({
                uid: currentUser.uid,
                isAdmin: false,
                partnerSlug:
                  partnerSnap.data().slug || "",
                shopName:
                  partnerSnap.data().shopName || "",
              });

            } else {

              setViewerInfo(null);
            }

          } catch (error) {

            console.error("Viewer resolution failed:", error);

            setViewerInfo(null);

          } finally {

            setResolvingViewer(false);
          }
        }
      );

    return () => unsubscribe();

  }, []);

  // ─── ACTIVE TAB ────────────────────────────────────────
  // Partners skip straight to store reviews (only tab they see)
  const [activeTab,
    setActiveTab] =
    useState(TABS.STORE);

  useEffect(() => {

    if (viewerInfo?.isAdmin) {

      setActiveTab(TABS.WEBSITE);
    }

  }, [viewerInfo]);

  // ─── WEBSITE REVIEWS STATE ─────────────────────────────
  const [websiteReviews,
    setWebsiteReviews] =
    useState([]);

  const [websiteLoading,
    setWebsiteLoading] =
    useState(false);

  const [websiteError,
    setWebsiteError] =
    useState("");

  // ─── PRODUCT REVIEWS STATE ─────────────────────────────
  const [productReviews,
    setProductReviews] =
    useState([]);

  const [productLoading,
    setProductLoading] =
    useState(false);

  const [productError,
    setProductError] =
    useState("");

  // ─── STORE REVIEWS STATE ───────────────────────────────
  const [storeReviews,
    setStoreReviews] =
    useState([]);

  const [storeLoading,
    setStoreLoading] =
    useState(false);

  const [storeError,
    setStoreError] =
    useState("");

  // ─── FETCH ON TAB CHANGE ───────────────────────────────
  useEffect(() => {

    if (!viewerInfo) return;

    if (activeTab === TABS.WEBSITE && viewerInfo.isAdmin) {
      fetchWebsiteReviews();
    }

    if (activeTab === TABS.PRODUCT && viewerInfo.isAdmin) {
      fetchProductReviews();
    }

    if (activeTab === TABS.STORE) {
      fetchStoreReviews();
    }

  }, [activeTab, viewerInfo]);

  // ─── FETCH WEBSITE REVIEWS ─────────────────────────────
  // FIX: this used to be an unfiltered `getDocs(collection(db,
  // "reviews"))`, which pulled back every review in the shared
  // collection — including store reviews (partnerSlug) and product
  // reviews (productId). Now filtered to only docs written with
  // `type: "website"`, matching how Testimonials.jsx (and the
  // admin submission form below) tag their writes.
  const fetchWebsiteReviews =
    async () => {

      try {

        setWebsiteLoading(true);

        setWebsiteError("");

        const q =
          query(
            collection(db, "reviews"),
            where("type", "==", "website")
          );

        const snapshot =
          await getDocs(q);

        const data =
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort(
              (a, b) =>
                (b.createdAt?.seconds || 0) -
                (a.createdAt?.seconds || 0)
            );

        setWebsiteReviews(data);

      } catch (error) {

        // Most common cause: Firestore Security Rules rejecting an
        // unfiltered `list` query on websiteReviews for this user.
        // See the comment block at the top of this file.
        console.error("fetchWebsiteReviews failed:", error);

        setWebsiteError(
          error?.message || "Failed to load website reviews."
        );

      } finally {

        setWebsiteLoading(false);
      }
    };

  // ─── FETCH PRODUCT REVIEWS ─────────────────────────────
  // Reads from "reviews" collection, filtered by `type ==
  // "product"`. If your product review submission flow doesn't
  // stamp that field yet, add `type: "product"` there — no other
  // code changes needed here.
  const fetchProductReviews =
    async () => {

      try {

        setProductLoading(true);

        setProductError("");

        // FIX: previously filtered with `where("productId", "!=",
        // "")`, which only works if every product review always
        // has that field and nothing else ever does. Using the
        // explicit `type` field is more robust and keeps this tab
        // isolated from website/store reviews.
        const q =
          query(
            collection(db, "reviews"),
            where("type", "==", "product")
          );

        const snapshot =
          await getDocs(q);

        const data =
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort(
              (a, b) =>
                (b.createdAt?.seconds || 0) -
                (a.createdAt?.seconds || 0)
            );

        setProductReviews(data);

      } catch (error) {

        console.error("fetchProductReviews failed:", error);

        setProductError(
          error?.message || "Failed to load product reviews."
        );

      } finally {

        setProductLoading(false);
      }
    };

  // ─── FETCH STORE REVIEWS ───────────────────────────────
  // Both store and product reviews live in the "reviews"
  // collection. Store reviews always have a "partnerSlug"
  // field; product reviews never do. We filter by partnerSlug
  // to exclude product reviews without needing a type field
  // or any data migration on existing documents.
  //
  // Admin: all store reviews across every partner.
  // Partner: only reviews for their own partnerSlug.
  const fetchStoreReviews =
    async () => {

      try {

        setStoreLoading(true);

        setStoreError("");

        let snapshot;

        if (viewerInfo.isAdmin) {

          // Filter to only docs that have a partnerSlug field
          // (i.e. store reviews, not product reviews)
          const q =
            query(
              collection(db, "reviews"),
              where("partnerSlug", "!=", "")
            );

          snapshot = await getDocs(q);

        } else {

          // Partner: filter to their own slug specifically
          const q =
            query(
              collection(db, "reviews"),
              where(
                "partnerSlug",
                "==",
                viewerInfo.partnerSlug
              )
            );

          snapshot = await getDocs(q);
        }

        const data =
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort(
              (a, b) =>
                (b.createdAt?.seconds || 0) -
                (a.createdAt?.seconds || 0)
            );

        setStoreReviews(data);

      } catch (error) {

        console.error("fetchStoreReviews failed:", error);

        setStoreError(
          error?.message || "Failed to load store reviews."
        );

      } finally {

        setStoreLoading(false);
      }
    };

  // ─── TOGGLE WEBSITE REVIEW FEATURED ───────────────────
  // Admin picks which website reviews appear in the homepage
  // testimonial section by toggling featured: true/false.
  const toggleFeatured =
    async (review) => {

      try {

        const newFeatured =
          !review.featured;

        await updateDoc(
          doc(db, "reviews", review.id),
          { featured: newFeatured }
        );

        setWebsiteReviews(
          websiteReviews.map((r) =>
            r.id === review.id
              ? { ...r, featured: newFeatured }
              : r
          )
        );

        await successAlert(
          newFeatured
            ? "Added To Testimonials"
            : "Removed From Testimonials",
          newFeatured
            ? "This review will now appear in the homepage testimonial section."
            : "This review has been removed from the homepage testimonial section."
        );

      } catch (error) {

        console.error("toggleFeatured failed:", error);

        await errorAlert(
          "Update Failed",
          error?.message || "Could not update review. Please try again."
        );
      }
    };

  // ─── DELETE WEBSITE REVIEW ─────────────────────────────
  const deleteWebsiteReview =
    async (id) => {

      try {

        const result =
          await confirmAlert(
            "Delete Review?",
            "This will permanently remove this website review."
          );

        if (!result.isConfirmed) return;

        await deleteDoc(
          doc(db, "reviews", id)
        );

        setWebsiteReviews(
          websiteReviews.filter((r) => r.id !== id)
        );

        await successAlert(
          "Deleted",
          "Website review has been deleted."
        );

      } catch (error) {

        console.error("deleteWebsiteReview failed:", error);

        await errorAlert(
          "Delete Failed",
          error?.message || "Could not delete review. Please try again."
        );
      }
    };

  // ─── DELETE PRODUCT REVIEW ─────────────────────────────
  const deleteProductReview =
    async (id) => {

      try {

        const result =
          await confirmAlert(
            "Delete Review?",
            "This will permanently remove this product review."
          );

        if (!result.isConfirmed) return;

        await deleteDoc(
          doc(db, "reviews", id)
        );

        setProductReviews(
          productReviews.filter((r) => r.id !== id)
        );

        await successAlert(
          "Deleted",
          "Product review has been deleted."
        );

      } catch (error) {

        console.error("deleteProductReview failed:", error);

        await errorAlert(
          "Delete Failed",
          error?.message || "Could not delete review. Please try again."
        );
      }
    };

  // ─── DELETE STORE REVIEW ───────────────────────────────
  // Admin only — partners can read but not delete store reviews.
  const deleteStoreReview =
    async (id) => {

      try {

        const result =
          await confirmAlert(
            "Delete Review?",
            "This will permanently remove this store review and recompute the store's rating."
          );

        if (!result.isConfirmed) return;

        // FIND THE REVIEW SO WE KNOW WHICH STORE TO RECOMPUTE
        const review =
          storeReviews.find((r) => r.id === id);

        await deleteDoc(
          doc(db, "reviews", id)
        );

        const remaining =
          storeReviews.filter((r) => r.id !== id);

        setStoreReviews(remaining);

        // RECOMPUTE AGGREGATE RATING for the affected store
        if (review?.partnerSlug) {

          const storeRemaining =
            remaining.filter(
              (r) => r.partnerSlug === review.partnerSlug
            );

          const totalReviews =
            storeRemaining.length;

          const averageRating =
            totalReviews > 0

              ? storeRemaining.reduce(
                  (acc, r) =>
                    acc + Number(r.rating || 0),
                  0
                ) / totalReviews

              : 0;

          // UPDATE THE PARTNER DOC — same pattern as PartnerStorePage.jsx
          const partnerQuery =
            query(
              collection(db, "partners"),
              where("slug", "==", review.partnerSlug)
            );

          const partnerSnap =
            await getDocs(partnerQuery);

          if (!partnerSnap.empty) {

            await updateDoc(
              doc(db, "partners", partnerSnap.docs[0].id),
              { rating: averageRating, totalReviews }
            );
          }
        }

        await successAlert(
          "Deleted",
          "Store review has been deleted and rating updated."
        );

      } catch (error) {

        console.error("deleteStoreReview failed:", error);

        await errorAlert(
          "Delete Failed",
          error?.message || "Could not delete review. Please try again."
        );
      }
    };

  // ─── WEBSITE REVIEW SUBMISSION FORM ───────────────────
  // Customers submit website/testimonial reviews here.
  // Admin sees them in the Website Reviews tab and can
  // feature or delete them.
  const [websiteForm,
    setWebsiteForm] =
    useState({
      name: "",
      rating: 5,
      comment: "",
    });

  const [submittingWebsite,
    setSubmittingWebsite] =
    useState(false);

  const handleSubmitWebsiteReview =
    async (e) => {

      e.preventDefault();

      if (!auth.currentUser) return;

      try {

        setSubmittingWebsite(true);

        await addDoc(
          collection(db, "reviews"),
          {
            // FIX: stamp `type: "website"` so this submission is
            // correctly picked up by fetchWebsiteReviews' filtered
            // query above, and by Testimonials.jsx's featured-review
            // query, instead of leaking into / being invisible to
            // the wrong tabs.
            type: "website",

            userId:
              auth.currentUser.uid,

            userName:
              websiteForm.name ||
              auth.currentUser.displayName ||
              "ZYVAR Customer",

            userPhoto:
              auth.currentUser.photoURL || "",

            rating:
              Number(websiteForm.rating),

            comment:
              websiteForm.comment,

            featured: false,

            createdAt:
              serverTimestamp(),
          }
        );

        setWebsiteForm({
          name: "",
          rating: 5,
          comment: "",
        });

        await successAlert(
          "Review Submitted!",
          "Thank you for your feedback. Our team will review it shortly."
        );

      } catch (error) {

        console.error("handleSubmitWebsiteReview failed:", error);

        await errorAlert(
          "Submission Failed",
          error?.message || "Could not submit your review. Please try again."
        );

      } finally {

        setSubmittingWebsite(false);
      }
    };

  // ─── LOADING / NOT AUTHORIZED ──────────────────────────
  if (resolvingViewer) {

    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white text-2xl font-black text-center px-6">
        Loading...
      </div>
    );
  }

  if (!viewerInfo) {

    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white text-2xl font-black text-center px-6">
        You must be ZYVAR admin or an approved partner to view this page.
      </div>
    );
  }

  // TABS AVAILABLE TO THIS VIEWER
  const availableTabs = viewerInfo.isAdmin

    ? [
        { id: TABS.WEBSITE, label: "Website Reviews", icon: FaGlobe },
        { id: TABS.PRODUCT, label: "Product Reviews", icon: FaBoxOpen },
        { id: TABS.STORE,   label: "Store Reviews",   icon: FaStore },
      ]

    : [
        { id: TABS.STORE, label: "My Store Reviews", icon: FaStore },
      ];

  return (

    <div className="space-y-10">

      {/* HEADER */}
      <div>

        <p className="uppercase tracking-[0.3em] text-[#C6922B] text-sm mb-4">
          {viewerInfo.isAdmin ? "ZYVAR ADMIN" : "PARTNER DASHBOARD"}
        </p>

        <h2 className="text-3xl md:text-5xl font-black leading-tight">
          Manage
          <span className="block text-[#C6922B]">
            Reviews
          </span>
        </h2>

      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-3">

        {availableTabs.map(({ id, label, icon: Icon }) => (

          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex items-center gap-2
              px-6 py-3
              rounded-2xl
              font-bold
              transition
              ${
                activeTab === id

                  ? "bg-[#C6922B] text-black"

                  : "border border-white/10 bg-white/5 text-gray-300 hover:border-[#C6922B] hover:text-[#C6922B]"
              }
            `}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}

      </div>

      {/* ═══════════════════════════════════════════
          TAB: WEBSITE REVIEWS (ADMIN ONLY)
      ═══════════════════════════════════════════ */}
      {activeTab === TABS.WEBSITE && viewerInfo.isAdmin && (

        <div className="space-y-8">

          <FetchErrorBanner error={websiteError} />

          {/* STATS SUMMARY */}
          <div className="grid sm:grid-cols-2 gap-5">

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Total Submitted</p>

              <p className="text-4xl font-black text-[#C6922B]">
                {websiteReviews.length}
              </p>

            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Featured In Testimonial</p>

              <p className="text-4xl font-black text-green-400">
                {websiteReviews.filter((r) => r.featured).length}
              </p>

            </div>

          </div>

          {/* REVIEW LIST */}
          {websiteLoading ? (

            <div className="flex items-center justify-center py-20">

              <div className="w-12 h-12 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

            </div>

          ) : websiteReviews.length === 0 ? (

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-12 text-center">

              <FaGlobe className="text-[#C6922B] mx-auto mb-4" size={36} />

              <p className="text-xl font-black mb-2">No Website Reviews Yet</p>

              <p className="text-gray-400">
                Website reviews submitted by customers will appear here.
              </p>

            </div>

          ) : (

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

              {websiteReviews.map((review) => (

                <div
                  key={review.id}
                  className={`
                    rounded-[28px]
                    border
                    p-6
                    space-y-4
                    transition
                    ${
                      review.featured

                        ? "border-green-500/30 bg-green-500/5"

                        : "border-white/10 bg-white/5"
                    }
                  `}
                >

                  {/* USER */}
                  <div className="flex items-center gap-3 min-w-0">

                    {
                      review.userPhoto ? (

                        <img
                          src={review.userPhoto}
                          alt={review.userName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                        />

                      ) : (

                        <div className="w-12 h-12 rounded-full bg-[#C6922B]/20 flex items-center justify-center shrink-0">
                          <FaUser className="text-[#C6922B]" size={18} />
                        </div>
                      )
                    }

                    <div className="min-w-0">

                      <p className="font-black break-words leading-snug">
                        {review.userName}
                      </p>

                      <p className="text-gray-500 text-xs">
                        {formatDate(review.createdAt)}
                      </p>

                    </div>

                    {review.featured && (

                      <span className="ml-auto shrink-0 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold whitespace-nowrap">
                        Featured
                      </span>
                    )}

                  </div>

                  <StarRating rating={review.rating} />

                  <p className="text-gray-300 leading-relaxed text-sm break-words">
                    {review.comment}
                  </p>

                  {/* ACTIONS */}
                  <div className="flex gap-3 pt-2">

                    {/* TOGGLE FEATURED */}
                    <button
                      onClick={() => toggleFeatured(review)}
                      className={`
                        flex-1
                        py-3
                        rounded-2xl
                        font-bold
                        text-sm
                        flex items-center justify-center gap-2
                        transition
                        ${
                          review.featured

                            ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"

                            : "border border-[#C6922B]/30 bg-[#C6922B]/10 text-[#C6922B] hover:bg-[#C6922B] hover:text-black"
                        }
                      `}
                    >

                      {review.featured ? (

                        <>
                          <FaTimes size={12} />
                          Unfeature
                        </>

                      ) : (

                        <>
                          <FaShieldAlt size={12} />
                          Add To Testimonial
                        </>
                      )}

                    </button>

                    {/* DELETE */}
                    <button
                      onClick={() =>
                        deleteWebsiteReview(review.id)
                      }
                      className="
                        w-12
                        rounded-2xl
                        border border-red-500/30
                        text-red-400
                        flex items-center justify-center
                        hover:bg-red-500 hover:text-white
                        transition
                      "
                    >
                      <FaTrash size={13} />
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: PRODUCT REVIEWS (ADMIN ONLY)
      ═══════════════════════════════════════════ */}
      {activeTab === TABS.PRODUCT && viewerInfo.isAdmin && (

        <div className="space-y-6">

          <FetchErrorBanner error={productError} />

          {/* STATS */}
          <div className="grid sm:grid-cols-2 gap-5">

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Total Product Reviews</p>

              <p className="text-4xl font-black text-[#C6922B]">
                {productReviews.length}
              </p>

            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Average Rating</p>

              <p className="text-4xl font-black text-[#C6922B]">
                {
                  productReviews.length > 0

                    ? (
                        productReviews.reduce(
                          (acc, r) => acc + Number(r.rating || 0),
                          0
                        ) / productReviews.length
                      ).toFixed(1)

                    : "—"
                }
              </p>

            </div>

          </div>

          {productLoading ? (

            <div className="flex items-center justify-center py-20">

              <div className="w-12 h-12 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

            </div>

          ) : productReviews.length === 0 ? (

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-12 text-center">

              <FaBoxOpen className="text-[#C6922B] mx-auto mb-4" size={36} />

              <p className="text-xl font-black mb-2">No Product Reviews Yet</p>

              <p className="text-gray-400">
                Product reviews from customers will appear here.
              </p>

            </div>

          ) : (

            <div className="space-y-5">

              {productReviews.map((review) => (

                <div
                  key={review.id}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-6"
                >

                  <div className="flex flex-col md:flex-row md:items-start gap-5">

                    {/* LEFT — USER + PRODUCT INFO */}
                    <div className="flex-1 min-w-0 space-y-3">

                      {/* PRODUCT */}
                      <div className="flex items-center gap-2 flex-wrap">

                        <FaBoxOpen className="text-[#C6922B] shrink-0" size={13} />

                        <p className="text-[#C6922B] font-bold text-sm break-words">
                          {review.productName || "Unknown Product"}
                        </p>

                      </div>

                      {/* USER */}
                      <div className="flex items-center gap-3 min-w-0">

                        {
                          review.userPhoto ? (

                            <img
                              src={review.userPhoto}
                              alt={review.userName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />

                          ) : (

                            <div className="w-10 h-10 rounded-full bg-[#C6922B]/20 flex items-center justify-center shrink-0">
                              <FaUser className="text-[#C6922B]" size={14} />
                            </div>
                          )
                        }

                        <div className="min-w-0">

                          <p className="font-bold break-words text-sm">
                            {review.userName || "Anonymous"}
                          </p>

                          <p className="text-gray-500 text-xs">
                            {formatDate(review.createdAt)}
                          </p>

                        </div>

                      </div>

                      <StarRating rating={review.rating} />

                      <p className="text-gray-300 leading-relaxed text-sm break-words">
                        {review.comment}
                      </p>

                    </div>

                    {/* DELETE */}
                    <button
                      onClick={() =>
                        deleteProductReview(review.id)
                      }
                      className="
                        shrink-0
                        px-5 py-3
                        rounded-2xl
                        border border-red-500/30
                        text-red-400
                        flex items-center gap-2
                        hover:bg-red-500 hover:text-white
                        transition
                        text-sm font-bold
                        whitespace-nowrap
                        self-start
                      "
                    >
                      <FaTrash size={12} />
                      Delete
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: STORE REVIEWS
          Admin: all stores, full control.
          Partner: own store, read-only.
      ═══════════════════════════════════════════ */}
      {activeTab === TABS.STORE && (

        <div className="space-y-6">

          <FetchErrorBanner error={storeError} />

          {/* HEADER CONTEXT FOR PARTNER */}
          {!viewerInfo.isAdmin && (

            <div className="rounded-[24px] border border-[#C6922B]/20 bg-[#C6922B]/5 px-6 py-5 flex items-center gap-4">

              <FaStore className="text-[#C6922B] shrink-0" size={18} />

              <div>

                <p className="font-bold text-[#C6922B]">
                  {viewerInfo.shopName || "Your Store"}
                </p>

                <p className="text-gray-400 text-sm">
                  Showing all customer reviews for your store.
                </p>

              </div>

            </div>
          )}

          {/* STATS */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Total Reviews</p>

              <p className="text-4xl font-black text-[#C6922B]">
                {storeReviews.length}
              </p>

            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

              <p className="text-gray-400 mb-2">Average Rating</p>

              <p className="text-4xl font-black text-[#C6922B]">
                {
                  storeReviews.length > 0

                    ? (
                        storeReviews.reduce(
                          (acc, r) => acc + Number(r.rating || 0),
                          0
                        ) / storeReviews.length
                      ).toFixed(1)

                    : "—"
                }
              </p>

            </div>

            {viewerInfo.isAdmin && (

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">

                <p className="text-gray-400 mb-2">Stores Reviewed</p>

                <p className="text-4xl font-black text-[#C6922B]">
                  {
                    new Set(
                      storeReviews.map((r) => r.partnerSlug)
                    ).size
                  }
                </p>

              </div>
            )}

          </div>

          {storeLoading ? (

            <div className="flex items-center justify-center py-20">

              <div className="w-12 h-12 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

            </div>

          ) : storeReviews.length === 0 ? (

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-12 text-center">

              <FaStore className="text-[#C6922B] mx-auto mb-4" size={36} />

              <p className="text-xl font-black mb-2">No Store Reviews Yet</p>

              <p className="text-gray-400">
                {
                  viewerInfo.isAdmin

                    ? "Customer store reviews will appear here once submitted."

                    : "No customers have reviewed your store yet."
                }
              </p>

            </div>

          ) : (

            <div className="space-y-5">

              {storeReviews.map((review) => (

                <div
                  key={review.id}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-6"
                >

                  <div className="flex flex-col md:flex-row md:items-start gap-5">

                    <div className="flex-1 min-w-0 space-y-3">

                      {/* STORE NAME — shown for admin since they see all stores mixed */}
                      {viewerInfo.isAdmin && (

                        <div className="flex items-center gap-2 flex-wrap">

                          <FaStore className="text-[#C6922B] shrink-0" size={13} />

                          <p className="text-[#C6922B] font-bold text-sm break-words">
                            {review.partnerSlug || "Unknown Store"}
                          </p>

                        </div>
                      )}

                      {/* USER */}
                      <div className="flex items-center gap-3 min-w-0">

                        {
                          review.userPhoto ? (

                            <img
                              src={review.userPhoto}
                              alt={review.userName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />

                          ) : (

                            <div className="w-10 h-10 rounded-full bg-[#C6922B]/20 flex items-center justify-center shrink-0">
                              <FaUser className="text-[#C6922B]" size={14} />
                            </div>
                          )
                        }

                        <div className="min-w-0">

                          <p className="font-bold break-words text-sm">
                            {review.userName || "Anonymous"}
                          </p>

                          <p className="text-gray-500 text-xs">
                            {formatDate(review.updatedAt || review.createdAt)}
                          </p>

                        </div>

                      </div>

                      <StarRating rating={review.rating} />

                      <p className="text-gray-300 leading-relaxed text-sm break-words">
                        {review.comment}
                      </p>

                    </div>

                    {/* DELETE — ADMIN ONLY */}
                    {viewerInfo.isAdmin && (

                      <button
                        onClick={() =>
                          deleteStoreReview(review.id)
                        }
                        className="
                          shrink-0
                          px-5 py-3
                          rounded-2xl
                          border border-red-500/30
                          text-red-400
                          flex items-center gap-2
                          hover:bg-red-500 hover:text-white
                          transition
                          text-sm font-bold
                          whitespace-nowrap
                          self-start
                        "
                      >
                        <FaTrash size={12} />
                        Delete
                      </button>
                    )}

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>
      )}

    </div>
  );
}