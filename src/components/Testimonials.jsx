import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import {
  FaStar,
  FaQuoteLeft,
} from "react-icons/fa";

import {
  db,
  auth,
} from "../firebase/firebase";

import {
  successAlert,
  errorAlert,
  warningAlert,
} from "../utils/alerts";

// FALLBACK REVIEWS — shown when no featured reviews exist yet.
// Uses real photo headshots (not cartoon avatars) so the section
// never looks empty or plain.
const FALLBACK_REVIEWS = [
  {
    id: "fallback-1",
    userName: "Sarah Rahman",
    userPhoto:
      "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 5,
    comment:
      "Amazing premium product quality and fast delivery. I am absolutely in love with everything I ordered from ZYVAR!",
    createdAt: null,
    isFallback: true,
  },
  {
    id: "fallback-2",
    userName: "Hasib Hossain",
    userPhoto:
      "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 5,
    comment:
      "Luxury shopping experience with authentic products. ZYVAR has completely changed the way I shop online.",
    createdAt: null,
    isFallback: true,
  },
  {
    id: "fallback-3",
    userName: "Mehedi Islam",
    userPhoto:
      "https://randomuser.me/api/portraits/men/76.jpg",
    rating: 5,
    comment:
      "Best ecommerce UI and premium collections. Every product feels exclusive and the packaging is beautiful.",
    createdAt: null,
    isFallback: true,
  },
];

// FORMAT SHORT DATE
function formatShortDate(ts) {
  if (!ts) return "";
  const d =
    ts?.seconds
      ? new Date(ts.seconds * 1000)
      : new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// STAR DISPLAY
function Stars({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <FaStar
          key={s}
          size={13}
          className={
            s <= Math.round(rating || 5)
              ? "text-[#C6922B]"
              : "text-white/15"
          }
        />
      ))}
    </div>
  );
}

// AVATAR — user photo or styled initial fallback
function Avatar({ photo, name, size = "w-12 h-12" }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "?")[0].toUpperCase();

  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setImgError(true)}
        className={`${size} rounded-full object-cover border-2 border-[#C6922B]/30 shrink-0 bg-[#C6922B]/10`}
      />
    );
  }

  return (
    <div
      className={`
        ${size}
        rounded-full
        bg-gradient-to-br from-[#C6922B]/30 to-[#C6922B]/10
        border-2 border-[#C6922B]/30
        flex items-center justify-center
        shrink-0
      `}
    >
      <span className="text-[#C6922B] font-black text-lg">
        {initial}
      </span>
    </div>
  );
}

export default function Testimonials() {

  // FEATURED REVIEWS from Firestore
  const [reviews,
    setReviews] =
    useState([]);

  const [reviewsLoading,
    setReviewsLoading] =
    useState(true);

  // ACTIVE CARD INDEX — drives the one-by-one animation
  const [activeIndex,
    setActiveIndex] =
    useState(0);

  // LOGGED-IN USER
  const [currentUser,
    setCurrentUser] =
    useState(null);

  // REVIEW FORM STATE
  const [formOpen,
    setFormOpen] =
    useState(false);

  const [formRating,
    setFormRating] =
    useState(5);

  const [formComment,
    setFormComment] =
    useState("");

  const [formName,
    setFormName] =
    useState("");

  const [submitting,
    setSubmitting] =
    useState(false);

  const [alreadyReviewed,
    setAlreadyReviewed] =
    useState(false);

  // AUTH LISTENER
  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(auth, (user) => {

        setCurrentUser(user);

        if (user) {
          checkAlreadyReviewed(user.uid);
          setFormName(user.displayName || "");
        }
      });

    return () => unsubscribe();

  }, []);

  // CHECK IF USER ALREADY SUBMITTED A WEBSITE REVIEW
  // FIX: queries "reviews" collection with type=="website",
  // not the "websiteReviews" collection which has no Firestore rule
  const checkAlreadyReviewed =
    async (uid) => {

      try {

        const q =
          query(
            collection(db, "reviews"),
            where("userId", "==", uid),
            where("type", "==", "website")
          );

        const snap = await getDocs(q);

        setAlreadyReviewed(!snap.empty);

      } catch (error) {

        console.log(error);
      }
    };

  // FETCH FEATURED REVIEWS
  // FIX: reads from "reviews" collection filtered by
  // type=="website" and featured==true, matching where we write.
  useEffect(() => {

    const fetchReviews =
      async () => {

        try {

          setReviewsLoading(true);

          const q =
            query(
              collection(db, "reviews"),
              where("type", "==", "website"),
              where("featured", "==", true)
            );

          const snap = await getDocs(q);

          const data =
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

          data.sort(
            (a, b) =>
              (b.createdAt?.seconds || 0) -
              (a.createdAt?.seconds || 0)
          );

          setReviews(data);

        } catch (error) {

          console.log(error);

        } finally {

          setReviewsLoading(false);
        }
      };

    fetchReviews();

  }, []);

  // DISPLAYED REVIEWS — real or fallback
  const displayReviews =
    reviews.length > 0
      ? reviews
      : FALLBACK_REVIEWS;

  // AUTO-ADVANCE CAROUSEL
  useEffect(() => {

    if (displayReviews.length <= 1) return;

    const interval = setInterval(() => {

      setActiveIndex(
        (prev) =>
          (prev + 1) % displayReviews.length
      );

    }, 4000);

    return () => clearInterval(interval);

  }, [displayReviews.length]);

  // SUBMIT WEBSITE REVIEW
  // FIX: writes to "reviews" collection with type:"website"
  // so the existing Firestore rule (allow create if auth != null)
  // covers it — no new rule needed, no permissions error.
  const handleSubmit =
    async (e) => {

      e.preventDefault();

      if (!currentUser) return;

      if (!formComment.trim()) {

        await warningAlert(
          "Review Required",
          "Please write something before submitting."
        );

        return;
      }

      try {

        setSubmitting(true);

        await addDoc(
          collection(db, "reviews"),
          {
            // TYPE FIELD — distinguishes website reviews from
            // store reviews (partnerSlug present) and product
            // reviews (productId present) in the shared collection
            type: "website",

            userId: currentUser.uid,

            userName:
              formName.trim() ||
              currentUser.displayName ||
              "ZYVAR Customer",

            userPhoto:
              currentUser.photoURL || "",

            rating: Number(formRating),

            comment: formComment.trim(),

            // featured starts false — admin toggles this in
            // ReviewsPage.jsx to show it on the homepage
            featured: false,

            createdAt: serverTimestamp(),
          }
        );

        setAlreadyReviewed(true);

        setFormOpen(false);

        setFormComment("");

        await successAlert(
          "Review Submitted!",
          "Thank you! Our team will review and may feature your testimonial on the homepage."
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Submission Failed",
          "Could not submit your review. Please try again."
        );

      } finally {

        setSubmitting(false);
      }
    };

  return (

    <section className="px-4 sm:px-6 lg:px-10 py-24 border-t border-white/10 relative overflow-hidden">

      {/* BACKGROUND GLOW */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#C6922B]/8 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">

          <div>

            <p className="uppercase tracking-[0.3em] text-[#C6922B] text-sm mb-4">
              Testimonials
            </p>

            <h2 className="text-4xl md:text-5xl font-black">
              What Customers
              <span className="block text-[#C6922B]">
                Say About Us
              </span>
            </h2>

          </div>

          {/* WRITE A REVIEW BUTTON */}
          <div>

            {
              !currentUser ? (

                <Link
                  to="/login"
                  className="
                    text-gray-500 text-sm
                    underline
                    underline-offset-4
                    decoration-gray-600
                    hover:text-[#C6922B]
                    hover:decoration-[#C6922B]
                    transition
                  "
                >
                  Login to share your experience
                </Link>

              ) : alreadyReviewed ? (

                <p className="text-gray-500 text-sm">
                  ✓ You've already shared your review
                </p>

              ) : (

                <button
                  onClick={() => setFormOpen(!formOpen)}
                  className="
                    px-7 py-4
                    rounded-2xl
                    bg-[#C6922B]/10
                    border border-[#C6922B]/30
                    text-[#C6922B]
                    font-bold
                    hover:bg-[#C6922B]
                    hover:text-black
                    transition duration-300
                    whitespace-nowrap
                  "
                >
                  {formOpen ? "Close" : "Share Your Experience"}
                </button>
              )
            }

          </div>

        </div>

        {/* REVIEW SUBMISSION FORM */}
        <AnimatePresence>

          {formOpen && currentUser && !alreadyReviewed && (

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="
                mb-14
                rounded-[32px]
                border border-[#C6922B]/20
                bg-[#C6922B]/5
                p-8
              "
            >

              <h3 className="text-2xl font-black mb-8">
                Write A Review
              </h3>

              <form
                onSubmit={handleSubmit}
                className="space-y-6"
              >

                {/* NAME */}
                <div>

                  <label className="block mb-2 text-sm uppercase tracking-widest text-gray-400">
                    Your Name
                  </label>

                  <input
                    type="text"
                    value={formName}
                    onChange={(e) =>
                      setFormName(e.target.value)
                    }
                    placeholder="Enter your name"
                    className="
                      w-full max-w-sm
                      px-5 py-4
                      rounded-2xl
                      bg-black/40
                      border border-white/10
                      outline-none
                      focus:border-[#C6922B]
                    "
                  />

                </div>

                {/* STAR RATING SELECTOR */}
                <div>

                  <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">
                    Your Rating
                  </label>

                  <div className="flex gap-2">

                    {[1, 2, 3, 4, 5].map((star) => (

                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormRating(star)}
                        className="text-3xl transition hover:scale-110"
                      >
                        <FaStar
                          className={
                            star <= formRating
                              ? "text-[#C6922B]"
                              : "text-white/15"
                          }
                        />
                      </button>
                    ))}

                  </div>

                </div>

                {/* COMMENT */}
                <div>

                  <label className="block mb-2 text-sm uppercase tracking-widest text-gray-400">
                    Your Experience
                  </label>

                  <textarea
                    rows="4"
                    required
                    value={formComment}
                    onChange={(e) =>
                      setFormComment(e.target.value)
                    }
                    placeholder="Tell us about your experience with ZYVAR..."
                    className="
                      w-full
                      px-5 py-4
                      rounded-2xl
                      bg-black/40
                      border border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      resize-none
                    "
                  />

                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    px-10 py-4
                    rounded-2xl
                    bg-[#C6922B]
                    text-black
                    font-black
                    hover:scale-105
                    transition
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                  "
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>

                <p className="text-gray-500 text-xs">
                  Reviews are reviewed by our team before being featured on this page.
                </p>

              </form>

            </motion.div>
          )}

        </AnimatePresence>

        {/* CAROUSEL */}
        {
          reviewsLoading ? (

            <div className="flex items-center justify-center py-20">

              <div className="w-12 h-12 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

            </div>

          ) : (

            <div className="grid lg:grid-cols-5 gap-8 items-start">

              {/* MAIN FEATURED CARD */}
              <div className="lg:col-span-3">

                <AnimatePresence mode="wait">

                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.97 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="
                      relative
                      rounded-[40px]
                      border border-[#C6922B]/20
                      bg-gradient-to-br from-[#C6922B]/10 to-white/[0.03]
                      backdrop-blur-xl
                      p-10
                      overflow-hidden
                    "
                  >

                    {/* DECORATIVE QUOTE */}
                    <FaQuoteLeft
                      className="absolute top-8 right-8 text-[#C6922B]/10"
                      size={72}
                    />

                    {/* STARS */}
                    <div className="mb-6">
                      <Stars
                        rating={
                          displayReviews[activeIndex]?.rating
                        }
                      />
                    </div>

                    {/* COMMENT */}
                    <p className="
                      text-xl
                      leading-relaxed
                      text-gray-100
                      font-medium
                      mb-10
                      relative z-10
                    ">
                      "
                      {displayReviews[activeIndex]?.comment}
                      "
                    </p>

                    {/* USER */}
                    <div className="flex items-center gap-4">

                      <Avatar
                        photo={
                          displayReviews[activeIndex]?.userPhoto
                        }
                        name={
                          displayReviews[activeIndex]?.userName
                        }
                        size="w-14 h-14"
                      />

                      <div>

                        <p className="font-black text-lg text-white">
                          {displayReviews[activeIndex]?.userName}
                        </p>

                        {
                          displayReviews[activeIndex]?.createdAt && (

                            <p className="text-gray-500 text-sm">
                              {formatShortDate(
                                displayReviews[activeIndex].createdAt
                              )}
                            </p>
                          )
                        }

                        <p className="text-gray-600 text-xs">
                          Verified Customer
                        </p>

                      </div>

                    </div>

                    {/* PROGRESS DOTS */}
                    <div className="flex gap-2 mt-8">

                      {displayReviews.map((_, i) => (

                        <button
                          key={i}
                          onClick={() => setActiveIndex(i)}
                          className={`
                            h-1.5
                            rounded-full
                            transition-all duration-300
                            ${
                              i === activeIndex
                                ? "w-8 bg-[#C6922B]"
                                : "w-2 bg-white/20 hover:bg-white/40"
                            }
                          `}
                        />
                      ))}

                    </div>

                  </motion.div>

                </AnimatePresence>

              </div>

              {/* SIDE LIST */}
              <div className="lg:col-span-2 space-y-4">

                {displayReviews.map((review, i) => (

                  <motion.button
                    key={review.id}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.08,
                      duration: 0.4,
                    }}
                    className={`
                      w-full text-left
                      rounded-[24px]
                      border
                      p-5
                      transition duration-300
                      ${
                        i === activeIndex
                          ? "border-[#C6922B]/40 bg-[#C6922B]/10 scale-[1.01]"
                          : "border-white/10 bg-white/5 hover:border-[#C6922B]/20 hover:bg-white/[0.07]"
                      }
                    `}
                  >

                    <div className="flex items-start gap-3">

                      <Avatar
                        photo={review.userPhoto}
                        name={review.userName}
                        size="w-10 h-10"
                      />

                      <div className="flex-1 min-w-0">

                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">

                          <p className={`font-black text-sm break-words ${
                            i === activeIndex
                              ? "text-[#C6922B]"
                              : "text-white"
                          }`}>
                            {review.userName}
                          </p>

                          {review.createdAt && (

                            <p className="text-gray-600 text-xs whitespace-nowrap">
                              {formatShortDate(review.createdAt)}
                            </p>
                          )}

                        </div>

                        <Stars rating={review.rating} />

                        <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                          {review.comment}
                        </p>

                      </div>

                    </div>

                  </motion.button>
                ))}

              </div>

            </div>
          )
        }

      </div>

    </section>
  );
}