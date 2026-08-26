import { useEffect, useRef, useState } from "react";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  useNavigate,
} from "react-router-dom";

import {
  FaArrowLeft,
  FaStore,
  FaCamera,
  FaFacebook,
  FaInstagram,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCreditCard,
  FaImage,
  FaCheckCircle,
  FaGlobe,
} from "react-icons/fa";

import {
  uploadImage,
} from "../utils/cloudinary";

import {
  successAlert,
  errorAlert,
} from "../utils/alerts";

// ─── Reusable styled image upload button ───────────────────────────
function ImageUploadField({
  label,
  hint,
  value,
  uploading,
  onChange,
  icon: Icon,
  aspectClass,
}) {

  const inputRef = useRef(null);

  return (

    <div>

      <label className="block mb-3 text-gray-400 font-medium">
        {label}
      </label>

      <div
        onClick={() =>
          !uploading &&
          inputRef.current?.click()
        }
        className={`
          relative
          cursor-pointer
          rounded-3xl
          border-2
          border-dashed
          overflow-hidden
          transition
          group
          ${
            value
              ? "border-[#C6922B]/40 hover:border-[#C6922B]"
              : "border-white/10 hover:border-[#C6922B]/60"
          }
          ${aspectClass || "h-44"}
        `}
      >

        {/* PREVIEW */}
        {value ? (

          <>
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
            />

            <div className="
              absolute
              inset-0
              bg-black/50
              opacity-0
              group-hover:opacity-100
              transition
              flex
              flex-col
              items-center
              justify-center
              gap-2
            ">
              <FaCamera className="text-white text-2xl" />
              <span className="text-white text-sm font-semibold">
                Change {label}
              </span>
            </div>
          </>

        ) : (

          <div className="
            w-full
            h-full
            flex
            flex-col
            items-center
            justify-center
            gap-3
            text-gray-500
            group-hover:text-[#C6922B]
            transition
            bg-black/20
          ">

            {
              uploading ? (

                <div className="
                  w-8
                  h-8
                  border-2
                  border-[#C6922B]
                  border-t-transparent
                  rounded-full
                  animate-spin
                " />

              ) : (

                <>
                  <Icon className="text-3xl" />
                  <span className="text-sm font-medium">
                    Upload {label}
                  </span>
                  {hint && (
                    <span className="text-xs text-gray-600">
                      {hint}
                    </span>
                  )}
                </>
              )
            }

          </div>
        )}

        {/* UPLOADING OVERLAY */}
        {uploading && value && (

          <div className="
            absolute
            inset-0
            bg-black/70
            flex
            items-center
            justify-center
          ">
            <div className="
              w-8
              h-8
              border-2
              border-[#C6922B]
              border-t-transparent
              rounded-full
              animate-spin
            " />
          </div>
        )}

      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />

    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function PartnerSettings() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [partnerData, setPartnerData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);

  const [bannerUploading, setBannerUploading] = useState(false);

  const [partnerForm, setPartnerForm] = useState({
    storeName: "",
    storeDescription: "",
    facebook: "",
    instagram: "",
    paymentNumber: "",
    contactEmail: "",
    contactPhone: "",
    storeAddress: "",
    logo: "",
    banner: "",
  });

  // ── AUTH & DATA LOAD ──────────────────────────────────────────────
  useEffect(() => {

    const unsubscribe = onAuthStateChanged(

      auth,

      async (currentUser) => {

        if (!currentUser) {
          navigate("/login");
          return;
        }

        setUser(currentUser);

        try {

          const partnerRef = doc(
            db,
            "partnerApplications",
            currentUser.uid
          );

          const partnerSnap = await getDoc(partnerRef);

          if (
            !partnerSnap.exists() ||
            partnerSnap.data()?.status !== "approved"
          ) {
            // Not an approved partner — redirect to profile
            navigate("/profile");
            return;
          }

          const partner = partnerSnap.data();

          setPartnerData(partner);

          setPartnerForm({
            storeName:       partner.shopName          || "",
            storeDescription: partner.storeDescription || "",
            facebook:        partner.facebook          || "",
            instagram:       partner.instagram         || "",
            paymentNumber:   partner.paymentNumber     || "",
            contactEmail:    partner.contactEmail      || currentUser.email || "",
            contactPhone:    partner.contactPhone      || "",
            storeAddress:    partner.storeAddress      || "",
            logo:            partner.logo              || "",
            banner:          partner.banner            || "",
          });

        } catch (error) {

          console.log(error);

        } finally {

          setLoading(false);
        }
      }
    );

    return () => unsubscribe();

  }, []);

  // ── FORM INPUT ────────────────────────────────────────────────────
  const handleChange = (e) => {
    setPartnerForm({
      ...partnerForm,
      [e.target.name]: e.target.value,
    });
  };

  // ── LOGO UPLOAD ───────────────────────────────────────────────────
  const handleLogoUpload = async (e) => {

    const file = e.target.files?.[0];
    if (!file) return;

    try {

      setLogoUploading(true);

      const imageUrl = await uploadImage(file);

      setPartnerForm((prev) => ({
        ...prev,
        logo: imageUrl,
      }));

    } catch (error) {

      console.log(error);

      await errorAlert(
        "Upload Failed",
        "Could not upload store logo. Please try again."
      );

    } finally {

      setLogoUploading(false);
    }
  };

  // ── BANNER UPLOAD ─────────────────────────────────────────────────
  const handleBannerUpload = async (e) => {

    const file = e.target.files?.[0];
    if (!file) return;

    try {

      setBannerUploading(true);

      const imageUrl = await uploadImage(file);

      setPartnerForm((prev) => ({
        ...prev,
        banner: imageUrl,
      }));

    } catch (error) {

      console.log(error);

      await errorAlert(
        "Upload Failed",
        "Could not upload store banner. Please try again."
      );

    } finally {

      setBannerUploading(false);
    }
  };

  // ── SAVE ──────────────────────────────────────────────────────────
  // FIX: Updates users, partnerApplications, AND the live "partners"
  // doc (same uid) so PartnerStorePage.jsx always reflects changes.
  const savePartnerProfile = async () => {

    try {

      setSaving(true);

      const partnerUpdates = {
        shopName:         partnerForm.storeName,
        storeDescription: partnerForm.storeDescription,
        facebook:         partnerForm.facebook,
        instagram:        partnerForm.instagram,
        paymentNumber:    partnerForm.paymentNumber,
        contactEmail:     partnerForm.contactEmail,
        contactPhone:     partnerForm.contactPhone,
        storeAddress:     partnerForm.storeAddress,
        logo:             partnerForm.logo,
        banner:           partnerForm.banner,
      };

      // Update users collection
      await updateDoc(
        doc(db, "users", user.uid),
        {
          storeName:        partnerForm.storeName,
          storeDescription: partnerForm.storeDescription,
          facebook:         partnerForm.facebook,
          instagram:        partnerForm.instagram,
          paymentNumber:    partnerForm.paymentNumber,
          contactEmail:     partnerForm.contactEmail,
          contactPhone:     partnerForm.contactPhone,
          storeAddress:     partnerForm.storeAddress,
          logo:             partnerForm.logo,
          banner:           partnerForm.banner,
        }
      );

      // Update partnerApplications (source of truth)
      await updateDoc(
        doc(db, "partnerApplications", user.uid),
        partnerUpdates
      );

      // FIX: Also sync live "partners" doc so PartnerStorePage.jsx
      // reads current data without needing a re-approval flow.
      try {

        await updateDoc(
          doc(db, "partners", user.uid),
          partnerUpdates
        );

      } catch (partnerDocError) {

        // If partners doc doesn't exist yet, log and continue.
        console.log(partnerDocError);
      }

      // Keep local state in sync
      setPartnerData((prev) => ({
        ...prev,
        ...partnerUpdates,
      }));

      await successAlert(
        "Store Updated",
        "Your partner profile has been saved successfully."
      );

    } catch (error) {

      console.log(error);

      await errorAlert(
        "Save Failed",
        "Could not update partner profile. Please try again."
      );

    } finally {

      setSaving(false);
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────
  if (loading) {

    return (

      <div className="min-h-screen bg-black flex items-center justify-center">

        <div className="w-16 h-16 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

      </div>
    );
  }

  const partnerStoreUrl = partnerData?.slug
    ? `${window.location.origin}/${partnerData.slug}`
    : "";

  return (

    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 sm:px-6 lg:px-10 py-20">

      <div className="max-w-5xl mx-auto">

        {/* ── PAGE HEADER ── */}
        <div className="mb-12">

          <button
            onClick={() => navigate("/profile")}
            className="
              flex
              items-center
              gap-2
              text-gray-400
              hover:text-[#C6922B]
              transition
              mb-8
              text-sm
              font-medium
            "
          >
            <FaArrowLeft />
            Back to Profile
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">

            <div>

              <h1 className="text-4xl font-black mb-2">
                Partner Store Settings
              </h1>

              <p className="text-gray-400">
                Manage your store information, branding and contact details.
              </p>

            </div>

            {/* STORE LIVE BADGE */}
            <div className="
              flex
              items-center
              gap-3
              px-5
              py-3
              rounded-2xl
              bg-green-500/10
              border
              border-green-500/20
              text-green-400
              text-sm
              font-bold
              w-fit
            ">
              <FaCheckCircle />
              Store Live
            </div>

          </div>

          {/* STORE URL PILL */}
          {partnerStoreUrl && (

            <div className="
              mt-6
              flex
              items-center
              gap-3
              px-5
              py-3
              rounded-2xl
              bg-white/5
              border
              border-white/10
              w-fit
            ">
              <FaGlobe className="text-[#C6922B]" />
              <a
                href={partnerStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-[#C6922B] transition text-sm"
              >
                {partnerStoreUrl}
              </a>
            </div>

          )}

        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* ─ LEFT COLUMN ─ */}
          <div className="lg:col-span-2 space-y-8">

            {/* STORE BRANDING */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-2xl
              p-8
            ">

              <div className="flex items-center gap-3 mb-8">

                <div className="
                  w-10
                  h-10
                  rounded-xl
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                ">
                  <FaStore />
                </div>

                <h2 className="text-2xl font-black">
                  Store Branding
                </h2>

              </div>

              {/* BANNER — full width */}
              <ImageUploadField
                label="Store Banner"
                hint="Recommended: 1200 × 400 px"
                value={partnerForm.banner}
                uploading={bannerUploading}
                onChange={handleBannerUpload}
                icon={FaImage}
                aspectClass="h-44 w-full"
              />

              {/* LOGO — smaller square below */}
              <div className="mt-6 max-w-xs">

                <ImageUploadField
                  label="Store Logo"
                  hint="Recommended: 400 × 400 px"
                  value={partnerForm.logo}
                  uploading={logoUploading}
                  onChange={handleLogoUpload}
                  icon={FaCamera}
                  aspectClass="h-44 w-44"
                />

              </div>

            </div>

            {/* STORE DETAILS */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-2xl
              p-8
            ">

              <div className="flex items-center gap-3 mb-8">

                <div className="
                  w-10
                  h-10
                  rounded-xl
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                ">
                  <FaStore />
                </div>

                <h2 className="text-2xl font-black">
                  Store Details
                </h2>

              </div>

              <div className="space-y-6">

                {/* STORE NAME */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium">
                    Store Name
                  </label>

                  <input
                    type="text"
                    name="storeName"
                    value={partnerForm.storeName}
                    onChange={handleChange}
                    placeholder="Your store name"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                    "
                  />

                </div>

                {/* STORE DESCRIPTION */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium">
                    Store Description
                  </label>

                  <textarea
                    rows="5"
                    name="storeDescription"
                    value={partnerForm.storeDescription}
                    onChange={handleChange}
                    placeholder="Tell customers what your store offers…"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                      resize-none
                    "
                  />

                </div>

                {/* STORE ADDRESS */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                    <FaMapMarkerAlt className="text-[#C6922B]" />
                    Store Address
                  </label>

                  <textarea
                    rows="3"
                    name="storeAddress"
                    value={partnerForm.storeAddress}
                    onChange={handleChange}
                    placeholder="Physical store address (optional)"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                      resize-none
                    "
                  />

                </div>

              </div>

            </div>

            {/* CONTACT INFORMATION */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-2xl
              p-8
            ">

              <div className="flex items-center gap-3 mb-8">

                <div className="
                  w-10
                  h-10
                  rounded-xl
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                ">
                  <FaEnvelope />
                </div>

                <h2 className="text-2xl font-black">
                  Contact Information
                </h2>

              </div>

              <div className="grid sm:grid-cols-2 gap-6">

                {/* CONTACT EMAIL */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                    <FaEnvelope className="text-[#C6922B]" />
                    Contact Email
                  </label>

                  <input
                    type="email"
                    name="contactEmail"
                    value={partnerForm.contactEmail}
                    onChange={handleChange}
                    placeholder="store@example.com"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                    "
                  />

                </div>

                {/* CONTACT PHONE */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                    <FaPhone className="text-[#C6922B]" />
                    Contact Phone
                  </label>

                  <input
                    type="text"
                    name="contactPhone"
                    value={partnerForm.contactPhone}
                    onChange={handleChange}
                    placeholder="+880 1XXX XXXXXX"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                    "
                  />

                </div>

              </div>

            </div>

            {/* SOCIAL LINKS */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-2xl
              p-8
            ">

              <div className="flex items-center gap-3 mb-8">

                <div className="
                  w-10
                  h-10
                  rounded-xl
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                ">
                  <FaGlobe />
                </div>

                <h2 className="text-2xl font-black">
                  Social Links
                </h2>

              </div>

              <div className="grid sm:grid-cols-2 gap-6">

                {/* FACEBOOK */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                    <FaFacebook className="text-blue-400" />
                    Facebook URL
                  </label>

                  <input
                    type="text"
                    name="facebook"
                    value={partnerForm.facebook}
                    onChange={handleChange}
                    placeholder="https://facebook.com/yourstore"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                    "
                  />

                </div>

                {/* INSTAGRAM */}
                <div>

                  <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                    <FaInstagram className="text-pink-400" />
                    Instagram URL
                  </label>

                  <input
                    type="text"
                    name="instagram"
                    value={partnerForm.instagram}
                    onChange={handleChange}
                    placeholder="https://instagram.com/yourstore"
                    className="
                      w-full
                      px-5
                      py-4
                      rounded-2xl
                      bg-black/30
                      border
                      border-white/10
                      outline-none
                      focus:border-[#C6922B]
                      transition
                      placeholder-gray-600
                    "
                  />

                </div>

              </div>

            </div>

            {/* PAYMENT */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-2xl
              p-8
            ">

              <div className="flex items-center gap-3 mb-8">

                <div className="
                  w-10
                  h-10
                  rounded-xl
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                ">
                  <FaCreditCard />
                </div>

                <h2 className="text-2xl font-black">
                  Payment Details
                </h2>

              </div>

              <div>

                <label className="block mb-3 text-gray-400 font-medium flex items-center gap-2">
                  <FaCreditCard className="text-[#C6922B]" />
                  Payment Number
                  <span className="text-xs text-gray-500 font-normal">
                    (bKash / Nagad / Rocket)
                  </span>
                </label>

                <input
                  type="text"
                  name="paymentNumber"
                  value={partnerForm.paymentNumber}
                  onChange={handleChange}
                  placeholder="+880 1XXX XXXXXX"
                  className="
                    w-full
                    px-5
                    py-4
                    rounded-2xl
                    bg-black/30
                    border
                    border-white/10
                    outline-none
                    focus:border-[#C6922B]
                    transition
                    placeholder-gray-600
                  "
                />

              </div>

            </div>

            {/* SAVE BUTTON — bottom of left col */}
            <button
              onClick={savePartnerProfile}
              disabled={saving}
              className="
                w-full
                py-5
                rounded-2xl
                bg-[#C6922B]
                text-black
                font-black
                text-lg
                hover:scale-[1.02]
                active:scale-[0.98]
                transition
                disabled:opacity-50
                disabled:cursor-not-allowed
                disabled:scale-100
              "
            >
              {saving ? "Saving…" : "Save Store Settings"}
            </button>

          </div>

          {/* ─ RIGHT COLUMN — live preview card ─ */}
          <div className="space-y-6">

            {/* PREVIEW CARD */}
            <div className="
              rounded-[40px]
              border
              border-white/10
              bg-white/5
              backdrop-blur-xl
              overflow-hidden
              sticky
              top-24
            ">

              {/* MINI BANNER */}
              <div className="h-28 relative">

                {partnerForm.banner ? (

                  <img
                    src={partnerForm.banner}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />

                ) : (

                  <div className="
                    w-full
                    h-full
                    bg-gradient-to-r
                    from-[#C6922B]/30
                    to-black
                  " />
                )}

              </div>

              <div className="p-6 -mt-10 relative">

                {/* LOGO CIRCLE */}
                <div className="
                  w-20
                  h-20
                  rounded-2xl
                  border-4
                  border-[#0B0B0B]
                  overflow-hidden
                  bg-[#C6922B]/20
                  flex
                  items-center
                  justify-center
                  text-[#C6922B]
                  text-2xl
                  mb-4
                ">

                  {partnerForm.logo ? (

                    <img
                      src={partnerForm.logo}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />

                  ) : (

                    <FaStore />
                  )}

                </div>

                <h3 className="text-xl font-black mb-1">
                  {partnerForm.storeName || "Your Store Name"}
                </h3>

                <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                  {
                    partnerForm.storeDescription ||
                    "Store description will appear here…"
                  }
                </p>

                {partnerForm.storeAddress && (

                  <div className="
                    flex
                    items-start
                    gap-2
                    text-gray-400
                    text-xs
                    mb-4
                  ">
                    <FaMapMarkerAlt className="text-[#C6922B] mt-0.5 shrink-0" />
                    <span>{partnerForm.storeAddress}</span>
                  </div>
                )}

                <div className="flex gap-3">

                  {partnerForm.facebook && (

                    <div className="
                      w-8
                      h-8
                      rounded-full
                      bg-blue-500/20
                      flex
                      items-center
                      justify-center
                      text-blue-400
                    ">
                      <FaFacebook size={14} />
                    </div>
                  )}

                  {partnerForm.instagram && (

                    <div className="
                      w-8
                      h-8
                      rounded-full
                      bg-pink-500/20
                      flex
                      items-center
                      justify-center
                      text-pink-400
                    ">
                      <FaInstagram size={14} />
                    </div>
                  )}

                </div>

              </div>

              <div className="
                px-6
                py-4
                border-t
                border-white/5
                text-xs
                text-gray-600
                text-center
              ">
                Live preview — updates as you type
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}