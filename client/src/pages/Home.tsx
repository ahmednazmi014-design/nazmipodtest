import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  CircleUserRound,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Globe2,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ScanLine,
  Settings2,
  ShieldCheck,
  Truck,
  UserPlus,
  UsersRound,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { csvEscape, parseCsv } from "@/lib/csv";
import {
  listPendingProofs,
  removePendingProof,
  savePendingProof,
} from "@/lib/offlinePodQueue";
import PublicTracking, { CustomerTrackingLanding } from "./PublicTracking";
import { toast } from "sonner";

const roles = [
  "Owner",
  "Director",
  "Dispatch Manager",
  "Dispatch Staff",
  "Delivery Supervisor",
  "Driver",
  "Accounts",
  "Custom",
] as const;
const statuses = [
  "Scheduled",
  "Ready for Dispatch",
  "Assigned",
  "Out for Delivery",
  "Arrived",
  "Delivered",
  "Partially Delivered",
  "Failed",
  "Cancelled",
] as const;
type ViewKey =
  | "overview"
  | "deliveries"
  | "staff"
  | "pod"
  | "tracker"
  | "driver"
  | "driver-preview"
  | "operations"
  | "reports"
  | "fleet"
  | "settings"
  | "audit";
type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  mustChangePassword: boolean;
  phone: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastSignedIn: string | null;
};
type Delivery = {
  id: string;
  customer: string;
  address: string;
  contact: string;
  challan: string;
  reference: string;
  product: string;
  cartons: number;
  unitPrice?: number | null;
  taxPercent?: number | null;
  expectedDurationMinutes?: number;
  deliveredCartons: number;
  rejectedCartons: number;
  scheduledAt: string;
  assignedDriverId: string | null;
  vehicle: string;
  route: string;
  status: string;
  notes: string;
  proofStatus: string;
  proofNotes: string;
  photos: string[];
  gps: {
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    recordedAt: string;
  } | null;
  gpsTrailCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  arrivedAt?: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  driver: { id: string; name: string; phone: string } | null;
  photoMetadata?: {
    capturedAt: string;
    lat?: number | null;
    lng?: number | null;
    note?: string;
  }[];
  scannedCartons?: number;
  scannedBarcodes?: string[];
  parentDeliveryId?: string | null;
};

type Lang = "EN" | "UR";
const ui = {
  EN: {
    dashboard: "Dashboard",
    deliveries: "Deliveries",
    staff: "Staff",
    pod: "POD verification",
    tracker: "Live tracker",
    settings: "Company settings",
    audit: "Audit log",
    driver: "My route",
    driverPreview: "Try as Driver",
    operations: "Operations center",
    reports: "Reports & exports",
    fleet: "Fleet & riders",
    signOut: "Sign out",
    newDelivery: "New delivery",
    search: "Search deliveries",
    noRecords: "No records yet",
    save: "Save changes",
    cancel: "Cancel",
    loading: "Loading…",
    signIn: "Sign in",
    signInTitle: "Sign in to NAZMI POD",
    identifier: "Username or email",
    password: "Password",
    continue: "Use your account username or email and password to continue.",
    secureSignIn: "SECURE SIGN IN",
    passwordChangeTitle: "Change your password",
    passwordChangeDetail:
      "For your security, set a new password before continuing.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordMin: "At least 12 characters",
    changePassword: "Change password",
    wait: "Please wait…",
    mismatch: "Passwords do not match.",
    passwordShort: "Password must be at least 12 characters.",
    firstLogin: "First login required",
    tagline: "Every handover, accounted for.",
    taglineDetail:
      "A secure operations workspace for dispatch, riders and proof of delivery.",
    protected: "Password-protected access",
    cartonPod: "Carton-level POD records",
    liveRider: "Live rider location when shared",
    authFoot:
      "Sessions are encrypted in an httpOnly cookie. Contact the Owner to add staff or reset access.",
    staffName: "Full name",
    staffUsername: "Username",
    staffEmail: "Email (optional)",
    staffPhone: "Phone (optional)",
    staffRole: "Role",
    staffPassword: "Password",
    addStaff: "Add staff",
    mapWaiting: "Waiting for GPS",
    mapStart: "Driver must tap Start GPS to share location.",
    mapLatest: "Latest GPS received",
    openMap: "Open map",
    planner: "Dispatch route planner",
    origin: "Origin address",
    suggestOrigin: "Suggested company address",
    chooseDeliveries: "Choose 1–23 active or scheduled deliveries",
    chooseDriver: "Active driver",
    optimize: "Optimize and assign",
    optimizing: "Planning…",
    routeResult: "Suggested fastest driving order",
    routeDistance: "Distance",
    routeDuration: "Estimated time",
    noMaps:
      "Google Maps may be unavailable; you can still review the optimized stop order below.",
    photosHint:
      "Up to 3 photos. Images are resized and compressed before upload.",
    photoTooLarge:
      "Photo exceeds the allowed size after compression. Choose a smaller image.",
    photoLimit: "Choose no more than 3 photos.",
    removePhoto: "Remove photo",
    startGps: "Start GPS",
    gpsCaptured: "GPS captured",
  },
  UR: {
    dashboard: "ڈیش بورڈ",
    deliveries: "ڈیلیوریز",
    staff: "عملہ",
    pod: "POD تصدیق",
    tracker: "لائیو ٹریکر",
    settings: "کمپنی سیٹنگز",
    audit: "آڈٹ لاگ",
    driver: "میرا روٹ",
    driverPreview: "ڈرائیور پیش نظارہ",
    operations: "آپریشنز سینٹر",
    reports: "رپورٹس اور ایکسپورٹس",
    fleet: "فلیٹ اور رائیڈرز",
    signOut: "سائن آؤٹ",
    newDelivery: "نئی ڈیلیوری",
    search: "ڈیلیوری تلاش کریں",
    noRecords: "ابھی کوئی ریکارڈ نہیں",
    save: "تبدیلی محفوظ کریں",
    cancel: "منسوخ",
    loading: "لوڈ ہو رہا ہے…",
    signIn: "سائن اِن",
    signInTitle: "NAZMI POD میں سائن اِن کریں",
    identifier: "صارف نام یا ای میل",
    password: "پاس ورڈ",
    continue: "جاری رکھنے کے لیے اپنا صارف نام یا ای میل اور پاس ورڈ درج کریں۔",
    secureSignIn: "محفوظ سائن اِن",
    passwordChangeTitle: "اپنا پاس ورڈ تبدیل کریں",
    passwordChangeDetail:
      "سیکیورٹی کے لیے آگے بڑھنے سے پہلے نیا پاس ورڈ مقرر کریں۔",
    newPassword: "نیا پاس ورڈ",
    confirmPassword: "نئے پاس ورڈ کی تصدیق",
    passwordMin: "کم از کم 12 حروف",
    changePassword: "پاس ورڈ تبدیل کریں",
    wait: "انتظار کریں…",
    mismatch: "پاس ورڈ ایک جیسے نہیں ہیں۔",
    passwordShort: "پاس ورڈ کم از کم 12 حروف کا ہونا چاہیے۔",
    firstLogin: "پہلی بار سائن اِن ضروری ہے",
    tagline: "ہر حوالگی کا مکمل حساب۔",
    taglineDetail:
      "ڈسپیچ، رائیڈرز اور ڈیلیوری ثبوت کے لیے محفوظ آپریشنز ورک اسپیس۔",
    protected: "پاس ورڈ سے محفوظ رسائی",
    cartonPod: "کارٹن کی سطح پر POD ریکارڈ",
    liveRider: "شیئر ہونے پر رائیڈر کی لائیو لوکیشن",
    authFoot:
      "سیشن محفوظ httpOnly کوکی میں محفوظ ہے۔ عملہ شامل کرنے یا رسائی بحال کرنے کے لیے مالک سے رابطہ کریں۔",
    staffName: "پورا نام",
    staffUsername: "صارف نام",
    staffEmail: "ای میل (اختیاری)",
    staffPhone: "فون (اختیاری)",
    staffRole: "عہدہ",
    staffPassword: "پاس ورڈ",
    addStaff: "عملہ شامل کریں",
    mapWaiting: "GPS کا انتظار ہے",
    mapStart: "مقام شیئر کرنے کے لیے ڈرائیور کو GPS شروع کریں دبانا ہوگا۔",
    mapLatest: "تازہ ترین GPS موصول",
    openMap: "نقشہ کھولیں",
    planner: "ڈسپیچ روٹ پلانر",
    origin: "روانگی کا پتہ",
    suggestOrigin: "کمپنی کا تجویز کردہ پتہ",
    chooseDeliveries: "1 سے 23 فعال یا طے شدہ ڈیلیوریز منتخب کریں",
    chooseDriver: "فعال ڈرائیور",
    optimize: "روٹ بہتر بنائیں اور تفویض کریں",
    optimizing: "روٹ ترتیب دیا جا رہا ہے…",
    routeResult: "تجویز کردہ تیز ترین ڈرائیونگ ترتیب",
    routeDistance: "فاصلہ",
    routeDuration: "متوقع وقت",
    noMaps:
      "Google Maps دستیاب نہ ہو سکتا ہے؛ نیچے بہتر کردہ اسٹاپس کی ترتیب دیکھی جا سکتی ہے۔",
    photosHint: "زیادہ سے زیادہ 3 تصاویر۔ اپ لوڈ سے پہلے سائز کم کیا جاتا ہے۔",
    photoTooLarge: "کمپریشن کے بعد تصویر حد سے بڑی ہے۔ چھوٹی تصویر منتخب کریں۔",
    photoLimit: "زیادہ سے زیادہ 3 تصاویر منتخب کریں۔",
    removePhoto: "تصویر ہٹائیں",
    startGps: "GPS شروع کریں",
    gpsCaptured: "GPS محفوظ",
  },
} as const;
type UiKey = keyof typeof ui.EN;
function text(lang: Lang, key: UiKey) {
  return ui[lang][key];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function localDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function recurringDate(value: string, frequency: string, occurrence: number) {
  const date = new Date(value);
  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7 * occurrence);
    return date;
  }
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + occurrence);
  date.setDate(
    Math.min(
      originalDay,
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    )
  );
  return date;
}
function initials(name: string) {
  return name
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function canManage(role: string) {
  return ["Owner", "Director", "Dispatch Manager", "Dispatch Staff"].includes(
    role
  );
}
function canVerify(role: string) {
  return [
    "Owner",
    "Director",
    "Delivery Supervisor",
    "Dispatch Manager",
  ].includes(role);
}
function statusTone(status: string) {
  return status.toLowerCase().replaceAll(" ", "-");
}
function downloadPod(id: string) {
  window.location.href = `/api/pod/${encodeURIComponent(id)}.pdf`;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        N<span>✓</span>
      </span>
      <span>
        <b>NAZMI POD</b>
        <small>Delivery control</small>
      </span>
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill ${statusTone(status)}`}>
      <i />
      {status}
    </span>
  );
}
function Avatar({ name }: { name: string }) {
  return <span className="avatar">{initials(name)}</span>;
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={`button ${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function PageHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}

function AuthScreen({
  lang,
  onComplete,
}: {
  lang: Lang;
  onComplete: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const t = ui[lang];
  const login = trpc.auth.login.useMutation({ onSuccess: onComplete });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    (login.mutate as (input: { identifier: string; password: string }) => void)(
      { identifier: identifier.trim(), password }
    );
  };
  return (
    <main
      className={`auth-shell ${lang === "UR" ? "rtl" : ""}`}
      dir={lang === "UR" ? "rtl" : "ltr"}
    >
      <div className="auth-side">
        <Brand />
        <div className="auth-message">
          <span className="eyebrow">NAZMI PACKAGING COMPANY</span>
          <h1>{t.tagline}</h1>
          <p>{t.taglineDetail}</p>
          <div className="auth-points">
            <span>
              <Check size={15} />
              {t.protected}
            </span>
            <span>
              <Check size={15} />
              {t.cartonPod}
            </span>
            <span>
              <Check size={15} />
              {t.liveRider}
            </span>
          </div>
        </div>
      </div>
      <section className="auth-card">
        <div className="auth-language">
          <button
            className="language-button"
            type="button"
            onClick={() => {
              const next = lang === "EN" ? "UR" : "EN";
              localStorage.setItem("nazmi-lang", next);
              window.dispatchEvent(new Event("nazmi-language"));
            }}
          >
            {lang === "EN" ? "اردو" : "EN"}
          </button>
        </div>
        <span className="eyebrow">{t.secureSignIn}</span>
        <h2>{t.signInTitle}</h2>
        <p>{t.continue}</p>
        <form onSubmit={submit}>
          <Field label={t.identifier}>
            <input
              required
              autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder={
                lang === "EN"
                  ? "Username or you@company.com"
                  : "صارف نام یا ای میل"
              }
            />
          </Field>
          <Field label={t.password}>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={
                lang === "EN" ? "Enter password" : "پاس ورڈ درج کریں"
              }
            />
          </Field>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? t.wait : t.signIn}
            <ArrowRight size={16} />
          </Button>
        </form>
        <small className="auth-foot">{t.authFoot}</small>
      </section>
    </main>
  );
}
function PasswordChangeScreen({
  lang,
  onChanged,
}: {
  lang: Lang;
  onChanged: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const t = ui[lang];
  const update = (trpc.auth as any).changePassword.useMutation({
    onSuccess: async () => {
      toast.success(
        lang === "UR"
          ? "پاس ورڈ تبدیل اور محفوظ ہو گیا۔"
          : "Password changed and saved. Continue with your new password."
      );
      await onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 12) return toast.error(t.passwordShort);
    if (newPassword !== confirm) return toast.error(t.mismatch);
    update.mutate({ newPassword });
  };
  return (
    <main
      className={`auth-shell ${lang === "UR" ? "rtl" : ""}`}
      dir={lang === "UR" ? "rtl" : "ltr"}
    >
      <div className="auth-side">
        <Brand />
        <div className="auth-message">
          <span className="eyebrow">{t.firstLogin}</span>
          <h1>{t.passwordChangeTitle}</h1>
          <p>{t.passwordChangeDetail}</p>
        </div>
      </div>
      <section className="auth-card">
        <span className="eyebrow">{t.firstLogin}</span>
        <h2>{t.passwordChangeTitle}</h2>
        <p>{t.passwordChangeDetail}</p>
        <form onSubmit={submit}>
          <Field label={t.newPassword} hint={t.passwordMin}>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label={t.confirmPassword}>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? t.wait : t.changePassword}
            <ArrowRight size={16} />
          </Button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({
  summary,
  deliveries,
  user,
  navigate,
  lang,
}: {
  summary: any;
  deliveries: Delivery[];
  user: User;
  navigate: (view: ViewKey) => void;
  lang: Lang;
}) {
  const t = ui[lang];
  const completion = summary?.cartons
    ? Math.round((summary.deliveredCartons / summary.cartons) * 100)
    : 0;
  const unassigned = deliveries.filter(
    delivery =>
      !delivery.driver && !["Delivered", "Cancelled"].includes(delivery.status)
  ).length;
  const attention = deliveries.filter(delivery =>
    ["Failed", "Partially Delivered"].includes(delivery.status)
  ).length;
  const scheduledToday = deliveries.filter(delivery => {
    const today = new Date().toISOString().slice(0, 10);
    return delivery.scheduledAt.slice(0, 10) === today;
  }).length;
  return (
    <>
      <PageHeading
        eyebrow={lang === "UR" ? "آپریشنز / جائزہ" : "Operations / overview"}
        title={
          lang === "UR"
            ? `خوش آمدید، ${user.name.split(" ")[0]}`
            : `Good to see you, ${user.name.split(" ")[0]}.`
        }
        detail={
          lang === "UR"
            ? "آج کی ڈیلیوری آپریشن ایک نظر میں۔"
            : "Your delivery operation at a glance, from dispatch to verified handover."
        }
        action={
          canManage(user.role) && (
            <Button onClick={() => navigate("deliveries")}>
              <Plus size={16} />
              {t.newDelivery}
            </Button>
          )
        }
      />
      <div className="health-banner">
        <span className="live-dot" />
        <div>
          <b>Live operations connected</b>
          <small>Server data is active. No sample records are shown.</small>
        </div>
        <span className="health-right">{summary?.staff ?? 0} active staff</span>
      </div>
      <div className="metric-grid">
        <Metric
          label="Total deliveries"
          value={summary?.total ?? 0}
          hint="All current records"
          icon={<PackageCheck />}
        />
        <Metric
          label="Delivered"
          value={summary?.delivered ?? 0}
          hint={`${completion}% of dispatched cartons`}
          icon={<Check />}
          tone="blue"
        />
        <Metric
          label="Active on route"
          value={summary?.active ?? 0}
          hint="Out for delivery / arrived"
          icon={<Truck />}
          tone="amber"
        />
        <Metric
          label="POD review queue"
          value={summary?.pendingVerification ?? 0}
          hint="Evidence awaiting verification"
          icon={<ClipboardCheck />}
          tone="coral"
        />
      </div>
      <section className="panel ops-pulse-panel">
        <PanelTitle
          eyebrow="Dispatch intelligence"
          title="Operations pulse"
          action={
            <span className="pulse-live">
              <i /> Live
            </span>
          }
        />
        <div className="ops-pulse-grid">
          <div>
            <span>Scheduled today</span>
            <b>{scheduledToday}</b>
            <small>planned stops</small>
          </div>
          <div>
            <span>Needs assignment</span>
            <b>{unassigned}</b>
            <small>no rider or vehicle</small>
          </div>
          <div>
            <span>Needs attention</span>
            <b>{attention}</b>
            <small>failed or partial</small>
          </div>
          <div>
            <span>POD review</span>
            <b>{summary?.pendingVerification ?? 0}</b>
            <small>evidence waiting</small>
          </div>
        </div>
      </section>
      <div className="split-grid">
        <section className="panel">
          <PanelTitle
            eyebrow="Today"
            title="Priority deliveries"
            action={
              <Button variant="ghost" onClick={() => navigate("deliveries")}>
                View all <ArrowRight size={15} />
              </Button>
            }
          />
          {deliveries.length === 0 ? (
            <EmptyState
              text={t.noRecords}
              action={
                canManage(user.role) ? (
                  <Button onClick={() => navigate("deliveries")}>
                    <Plus size={15} />
                    Create first delivery
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DeliveryTable
              deliveries={deliveries.slice(0, 6)}
              onSelect={() => navigate("deliveries")}
            />
          )}
        </section>
        <section className="panel">
          <PanelTitle eyebrow="Workflow" title="At a glance" />
          <div className="progress-card">
            <div className="progress-ring">
              <strong>{completion}%</strong>
              <small>cartons delivered</small>
            </div>
            <div className="progress-list">
              <span>
                <i className="dot green" />
                Delivered <b>{summary?.delivered ?? 0}</b>
              </span>
              <span>
                <i className="dot amber" />
                Partial <b>{summary?.partial ?? 0}</b>
              </span>
              <span>
                <i className="dot red" />
                Failed <b>{summary?.failed ?? 0}</b>
              </span>
              <span>
                <i className="dot gray" />
                In progress <b>{summary?.active ?? 0}</b>
              </span>
            </div>
          </div>
          <div className="quick-links">
            <button onClick={() => navigate("pod")}>
              <FileCheck2 size={17} />
              <span>Review pending PODs</span>
              <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate("tracker")}>
              <MapPin size={17} />
              <span>Open live tracker</span>
              <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate("staff")}>
              <UsersRound size={17} />
              <span>Manage staff access</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  hint,
  icon,
  tone = "green",
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value.toLocaleString()}</strong>
      <small>{hint}</small>
    </div>
  );
}
function PanelTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <PackageCheck size={22} />
      <p>{text}</p>
      {action}
    </div>
  );
}
function DeliveryTable({
  deliveries,
  onSelect,
}: {
  deliveries: Delivery[];
  onSelect: (delivery: Delivery) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Delivery</th>
            <th>Customer</th>
            <th>Driver</th>
            <th>Load</th>
            <th>Status</th>
            <th>POD</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map(delivery => (
            <tr key={delivery.id} onClick={() => onSelect(delivery)}>
              <td>
                <b className="mono">{delivery.id}</b>
                <small>{delivery.challan}</small>
              </td>
              <td>
                <b>{delivery.customer}</b>
                <small>
                  <MapPin size={11} />
                  {delivery.address}
                </small>
              </td>
              <td>
                {delivery.driver ? (
                  <span className="person-cell">
                    <Avatar name={delivery.driver.name} />
                    {delivery.driver.name}
                  </span>
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </td>
              <td>
                <b>
                  {delivery.deliveredCartons}/{delivery.cartons}
                </b>
                <small>cartons</small>
              </td>
              <td>
                <StatusPill status={delivery.status} />
              </td>
              <td>
                <span
                  className={`proof-tag ${delivery.proofStatus.toLowerCase()}`}
                >
                  <FileCheck2 size={12} />
                  {delivery.proofStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveriesView({
  deliveries,
  staff,
  user,
  navigate,
  lang,
}: {
  deliveries: Delivery[];
  staff: User[];
  user: User;
  navigate: (view: ViewKey) => void;
  lang: Lang;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [layout, setLayout] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState(() => localDateKey(new Date()));
  const [csvRows, setCsvRows] = useState<any[] | null>(null);
  const utils = trpc.useUtils();
  const bulk = trpc.deliveries.bulkCreate.useMutation({
    onSuccess: () => {
      toast.success(`Imported ${csvRows?.length ?? 0} deliveries`);
      setCsvRows(null);
      void utils.deliveries.list.invalidate();
    },
  });
  const create = trpc.deliveries.create.useMutation({
    onError: error =>
      toast.error(
        error.data?.code === "CONFLICT"
          ? `Schedule conflict: ${error.message}`
          : error.message || "Could not create delivery"
      ),
    onSuccess: result => {
      const total = Number((result as any)?.seriesCreatedCount ?? 1);
      toast.success(
        total > 1
          ? `${total} deliveries created in the recurring series`
          : "Delivery created"
      );
      setShowCreate(false);
      navigate("deliveries");
    },
  });
  useEffect(() => {
    if (create.isSuccess) {
      void utils.deliveries.list.invalidate();
      void utils.dashboard.summary.invalidate();
      create.reset();
    }
  }, [create.isSuccess, create, utils]);
  const filtered = deliveries.filter(
    d =>
      (status === "All statuses" || d.status === status) &&
      [d.id, d.customer, d.address, d.challan, d.driver?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  return (
    <>
      <PageHeading
        eyebrow="Operations / delivery register"
        title="Deliveries"
        detail="Create, assign, track and complete every delivery with a server-side status history."
        action={
          canManage(user.role) && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              New delivery
            </Button>
          )
        }
      />
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search ID, customer, driver or address"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option>All statuses</option>
          {statuses.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          onClick={() => setLayout(layout === "list" ? "calendar" : "list")}
        >
          {layout === "list" ? "Calendar" : "List"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const header =
              "customer,address,challan,cartons,scheduledAt,contact,reference,product,driverUsername,vehicle,route,notes,unitPrice,taxPercent,expectedDurationMinutes";
            const a = document.createElement("a");
            a.href = URL.createObjectURL(
              new Blob([header + "\n"], { type: "text/csv" })
            );
            a.download = "nazmi-delivery-template.csv";
            a.click();
          }}
        >
          Download template
        </Button>
        <label className="button secondary">
          <Upload size={15} /> Import CSV
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = parseCsv(await file.text());
                const headers = rows[0].map(h => h.trim());
                const required = [
                  "customer",
                  "address",
                  "challan",
                  "cartons",
                  "scheduledAt",
                ];
                const missing = required.filter(h => !headers.includes(h));
                if (missing.length)
                  throw new Error(`Missing columns: ${missing.join(", ")}`);
                const items = rows.slice(1).map((r, i) => {
                  const obj = Object.fromEntries(
                    headers.map((h, j) => [h, r[j] ?? ""])
                  );
                  const cartons = Number(obj.cartons);
                  if (
                    !obj.customer ||
                    !obj.address ||
                    !obj.challan ||
                    !Number.isInteger(cartons) ||
                    cartons < 1 ||
                    !obj.scheduledAt
                  )
                    throw new Error(
                      `Invalid required values on CSV row ${i + 2}`
                    );
                  const driver = staff.find(
                    m =>
                      m.username.toLowerCase() ===
                        String(obj.driverUsername || "").toLowerCase() &&
                      m.role === "Driver"
                  );
                  return {
                    ...obj,
                    cartons,
                    scheduledAt: new Date(obj.scheduledAt).toISOString(),
                    ...(driver ? { driverUsername: driver.username } : {}),
                  };
                });
                if (!items.length || items.length > 200)
                  throw new Error("Import must contain 1–200 valid rows.");
                setCsvRows(items);
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not read CSV"
                );
              }
              e.currentTarget.value = "";
            }}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            const csv = [
              "Delivery,Customer,Status,Cartons,Delivered,Driver",
              ...filtered.map(d =>
                [
                  d.id,
                  d.customer,
                  d.status,
                  d.cartons,
                  d.deliveredCartons,
                  d.driver?.name ?? "",
                ]
                  .map(value => `"${String(value).replaceAll('"', '""')}"`)
                  .join(",")
              ),
            ].join("\n");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = "nazmi-deliveries.csv";
            a.click();
          }}
        >
          {" "}
          <Download size={15} />
          Export CSV
        </Button>
      </div>
      <section className="panel">
        <div className="table-meta">
          <span>
            <b>{filtered.length}</b> records
          </span>
          <span className="muted">Server-synced</span>
        </div>
        {layout === "list" ? (
          filtered.length ? (
            <DeliveryTable deliveries={filtered} onSelect={setSelected} />
          ) : (
            <EmptyState text="No deliveries match this filter." />
          )
        ) : (
          <>
            <div className="calendar-head">
              <Button
                variant="secondary"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft />
              </Button>
              <b>
                {month.toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                })}
              </b>
              <Button
                variant="secondary"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(x => (
                <b key={x}>{x}</b>
              ))}
              {Array.from(
                {
                  length: new Date(
                    month.getFullYear(),
                    month.getMonth(),
                    1
                  ).getDay(),
                },
                (_, i) => (
                  <i key={`blank${i}`} />
                )
              )}
              {Array.from(
                {
                  length: new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    0
                  ).getDate(),
                },
                (_, i) => {
                  const date = localDateKey(
                    new Date(month.getFullYear(), month.getMonth(), i + 1)
                  );
                  const count = filtered.filter(
                    x => localDateKey(x.scheduledAt) === date
                  ).length;
                  return (
                    <button
                      key={date}
                      className={day === date ? "selected" : ""}
                      onClick={() => setDay(date)}
                    >
                      {i + 1}
                      {count > 0 && <small>{count} deliveries</small>}
                    </button>
                  );
                }
              )}
            </div>
            <h3>Scheduled · {day}</h3>
            {filtered.filter(x => localDateKey(x.scheduledAt) === day)
              .length ? (
              <DeliveryTable
                deliveries={filtered.filter(
                  x => localDateKey(x.scheduledAt) === day
                )}
                onSelect={setSelected}
              />
            ) : (
              <EmptyState text="No deliveries scheduled for this day." />
            )}
          </>
        )}
      </section>
      {showCreate && (
        <CreateDeliveryModal
          staff={staff}
          onClose={() => setShowCreate(false)}
          onSubmit={input => create.mutate(input)}
          pending={create.isPending}
        />
      )}
      {csvRows && (
        <Modal
          title={`Import preview · ${csvRows.length} rows`}
          onClose={() => setCsvRows(null)}
        >
          <p>Review the validated rows before creating deliveries.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Challan</th>
                  <th>Cartons</th>
                  <th>Driver username</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{r.customer}</td>
                    <td>{r.challan}</td>
                    <td>{r.cartons}</td>
                    <td>{r.driverUsername || "—"}</td>
                    <td>{r.scheduledAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvRows.length > 20 && (
            <p>Showing first 20 of {csvRows.length} rows.</p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCsvRows(null)}>
              Cancel
            </Button>
            <Button
              disabled={bulk.isPending}
              onClick={() => bulk.mutate({ items: csvRows })}
            >
              Confirm import
            </Button>
          </div>
        </Modal>
      )}
      {selected && (
        <DeliveryDrawer
          delivery={selected}
          user={user}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function CreateDeliveryModal({
  staff,
  onClose,
  onSubmit,
  pending,
}: {
  staff: User[];
  onClose: () => void;
  onSubmit: (input: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    customer: "",
    address: "",
    contact: "",
    challan: "",
    reference: "",
    product: "",
    cartons: "",
    scheduledAt: "",
    assignedDriverId: "",
    vehicle: "",
    route: "",
    notes: "",
    unitPrice: "",
    taxPercent: "",
    expectedDurationMinutes: "",
    recurrenceFrequency: "none",
    recurrenceCount: "",
  });
  const set = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  return (
    <Modal title="Create delivery" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={e => {
          e.preventDefault();
          onSubmit({
            ...form,
            cartons: Number(form.cartons),
            scheduledAt: new Date(form.scheduledAt).toISOString(),
            assignedDriverId: form.assignedDriverId || null,
            unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
            taxPercent: form.taxPercent ? Number(form.taxPercent) : undefined,
            expectedDurationMinutes: form.expectedDurationMinutes
              ? Number(form.expectedDurationMinutes)
              : undefined,
            recurrenceFrequency: form.recurrenceFrequency,
            recurrenceCount: form.recurrenceCount
              ? Number(form.recurrenceCount)
              : undefined,
          });
        }}
      >
        <Field label="Customer">
          <input
            required
            value={form.customer}
            onChange={e => set("customer", e.target.value)}
          />
        </Field>
        <Field label="Full address">
          <input
            required
            value={form.address}
            onChange={e => set("address", e.target.value)}
          />
        </Field>
        <Field label="Challan">
          <input
            required
            value={form.challan}
            onChange={e => set("challan", e.target.value)}
          />
        </Field>
        <Field label="Order / reference">
          <input
            value={form.reference}
            onChange={e => set("reference", e.target.value)}
          />
        </Field>
        <Field label="Product">
          <input
            value={form.product}
            onChange={e => set("product", e.target.value)}
          />
        </Field>
        <Field label="Cartons">
          <input
            required
            type="number"
            min="1"
            value={form.cartons}
            onChange={e => set("cartons", e.target.value)}
          />
        </Field>
        <Field label="Scheduled date/time">
          <input
            required
            type="datetime-local"
            value={form.scheduledAt}
            onChange={e => set("scheduledAt", e.target.value)}
          />
        </Field>
        <Field label="Assign driver">
          <select
            value={form.assignedDriverId}
            onChange={e => set("assignedDriverId", e.target.value)}
          >
            <option value="">Unassigned</option>
            {staff
              .filter(member => member.role === "Driver" && member.active)
              .map(member => (
                <option value={member.id} key={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Vehicle">
          <input
            value={form.vehicle}
            onChange={e => set("vehicle", e.target.value)}
          />
        </Field>
        <Field label="Route">
          <input
            value={form.route}
            onChange={e => set("route", e.target.value)}
            placeholder="Route 01"
          />
        </Field>
        <Field label="Contact">
          <input
            value={form.contact}
            onChange={e => set("contact", e.target.value)}
          />
        </Field>
        <Field label="Unit price (optional)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={e => set("unitPrice", e.target.value)}
          />
        </Field>
        <Field label="Tax (%) optional">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.taxPercent}
            onChange={e => set("taxPercent", e.target.value)}
          />
        </Field>
        <Field label="Expected duration (minutes)">
          <input
            type="number"
            min="1"
            value={form.expectedDurationMinutes}
            onChange={e => set("expectedDurationMinutes", e.target.value)}
          />
        </Field>
        <Field label="Recurring frequency">
          <select
            value={form.recurrenceFrequency}
            onChange={e => set("recurrenceFrequency", e.target.value)}
          >
            <option value="none">None</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        {form.recurrenceFrequency !== "none" && (
          <Field label="Occurrences (API-supported)">
            <input
              type="number"
              min="1"
              max="12"
              value={form.recurrenceCount}
              onChange={e => set("recurrenceCount", e.target.value)}
            />
          </Field>
        )}
        {form.recurrenceFrequency !== "none" && form.scheduledAt && (
          <div className="recurrence-preview">
            <b>Recurring delivery preview</b>
            <p>
              The first challan will remain{" "}
              <strong>{form.challan || "(enter challan)"}</strong>; later
              challans use <strong>{form.challan || "BASE"}-R02, -R03…</strong>.
              Schedule preview:
            </p>
            <ol>
              {Array.from(
                {
                  length: Math.max(
                    1,
                    Math.min(6, Number(form.recurrenceCount) || 1)
                  ),
                },
                (_, i) => {
                  const d = recurringDate(
                    form.scheduledAt,
                    form.recurrenceFrequency,
                    i
                  );
                  return (
                    <li key={i}>
                      {i === 0
                        ? form.challan || "First delivery"
                        : `${form.challan || "BASE"}-R${String(i + 1).padStart(2, "0")}`}{" "}
                      · {d.toLocaleString()}
                    </li>
                  );
                }
              )}
            </ol>
            <small>
              This previews the requested cadence; the server validates schedule
              conflicts when you submit.
            </small>
          </div>
        )}
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create delivery"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function DeliveryDrawer({
  delivery,
  user,
  onClose,
}: {
  delivery: Delivery;
  user: User;
  onClose: () => void;
}) {
  const update = trpc.deliveries.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      onClose();
    },
  });
  const verify = trpc.deliveries.verifyProof.useMutation({
    onSuccess: () => {
      toast.success("POD updated");
      onClose();
    },
  });
  const [trackingLink, setTrackingLink] = useState("");
  const createLink = trpc.deliveries.createTrackingLink.useMutation({
    onSuccess: result => {
      const url = new URL(result.url, window.location.origin).toString();
      setTrackingLink(url);
      void navigator.clipboard?.writeText(url);
      toast.success("Tracking link copied");
    },
  });
  const revokeLink = trpc.deliveries.revokeTrackingLink.useMutation({
    onSuccess: () => {
      setTrackingLink("");
      toast.success("Tracking link revoked");
    },
  });
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpChallan, setFollowUpChallan] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const utils = trpc.useUtils();
  const followUp = trpc.deliveries.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up delivery scheduled");
      setShowFollowUp(false);
      void utils.deliveries.list.invalidate();
      void utils.dashboard.summary.invalidate();
      onClose();
    },
    onError: error => toast.error(error.message),
  });
  const undelivered =
    delivery.cartons - delivery.deliveredCartons - delivery.rejectedCartons;
  const canCreateFollowUp =
    canManage(user.role) &&
    delivery.status === "Partially Delivered" &&
    undelivered > 0;
  const isDriver = user.role === "Driver";
  const canStart = ["Scheduled", "Assigned"].includes(delivery.status);
  const canArrive = delivery.status === "Out for Delivery";
  return (
    <Modal title={delivery.id} onClose={onClose}>
      <div className="drawer-summary">
        <StatusPill status={delivery.status} />
        <span className={`proof-tag ${delivery.proofStatus.toLowerCase()}`}>
          <FileCheck2 size={12} />
          {delivery.proofStatus}
        </span>
      </div>
      <div className="detail-grid">
        <div>
          <span>Customer</span>
          <b>{delivery.customer}</b>
        </div>
        <div>
          <span>Challan</span>
          <b>{delivery.challan}</b>
        </div>
        <div>
          <span>Address</span>
          <b>{delivery.address}</b>
        </div>
        <div>
          <span>Driver</span>
          <b>{delivery.driver?.name ?? "Unassigned"}</b>
        </div>
        <div>
          <span>Cartons</span>
          <b>
            {delivery.deliveredCartons} / {delivery.cartons}
          </b>
        </div>
        <div>
          <span>GPS</span>
          <b>
            {delivery.gps
              ? `${delivery.gps.lat.toFixed(5)}, ${delivery.gps.lng.toFixed(5)}`
              : "Not captured"}
          </b>
        </div>
      </div>
      <div className="detail-timings">
        {delivery.startedAt && (
          <span>Started · {formatDate(delivery.startedAt)}</span>
        )}
        {delivery.arrivedAt && (
          <span>Arrived · {formatDate(delivery.arrivedAt)}</span>
        )}
        {delivery.completedAt && delivery.startedAt && (
          <span>
            Trip time ·{" "}
            {Math.max(
              0,
              Math.round(
                (new Date(delivery.completedAt).getTime() -
                  new Date(delivery.startedAt).getTime()) /
                  60000
              )
            )}{" "}
            min
          </span>
        )}
        {delivery.completedAt && delivery.arrivedAt && (
          <span>
            At-stop time ·{" "}
            {Math.max(
              0,
              Math.round(
                (new Date(delivery.completedAt).getTime() -
                  new Date(delivery.arrivedAt).getTime()) /
                  60000
              )
            )}{" "}
            min
          </span>
        )}
      </div>
      {delivery.parentDeliveryId && (
        <p className="signature-note">
          Follow-up for {delivery.parentDeliveryId}
        </p>
      )}
      {canCreateFollowUp && !showFollowUp && (
        <Button variant="secondary" onClick={() => setShowFollowUp(true)}>
          <Plus size={15} />
          Schedule follow-up · {undelivered} cartons remaining
        </Button>
      )}
      {canCreateFollowUp && showFollowUp && (
        <form
          className="follow-up-form"
          onSubmit={event => {
            event.preventDefault();
            if (
              !followUpChallan.trim() ||
              !Number.isFinite(Date.parse(followUpAt))
            ) {
              toast.error("Enter a new challan and a valid date/time.");
              return;
            }
            followUp.mutate({
              deliveryId: delivery.id,
              challan: followUpChallan.trim(),
              scheduledAt: new Date(followUpAt).toISOString(),
              vehicle: delivery.vehicle || undefined,
              expectedDurationMinutes: delivery.expectedDurationMinutes,
            });
          }}
        >
          <b>Schedule {undelivered} undelivered cartons</b>
          <Field label="New follow-up challan">
            <input
              required
              value={followUpChallan}
              onChange={event => setFollowUpChallan(event.target.value)}
            />
          </Field>
          <Field label="Follow-up date/time">
            <input
              required
              type="datetime-local"
              value={followUpAt}
              onChange={event => setFollowUpAt(event.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowFollowUp(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={followUp.isPending}>
              {followUp.isPending ? "Scheduling…" : "Create follow-up"}
            </Button>
          </div>
        </form>
      )}
      <div className="detail-actions">
        {!isDriver && (
          <>
            <Button
              variant="secondary"
              disabled={createLink.isPending}
              onClick={() => createLink.mutate({ deliveryId: delivery.id })}
            >
              <Link2 size={14} />
              Create/copy customer link
            </Button>
            {trackingLink && (
              <>
                <input
                  readOnly
                  value={trackingLink}
                  aria-label="Customer tracking link"
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard?.writeText(trackingLink)
                  }
                >
                  Copy link
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const message = `Hello ${delivery.customer}, your NAZMI POD delivery ${delivery.id} can be tracked here: ${trackingLink}`;
                    const phone = delivery.contact.replace(/[^\d+]/g, "");
                    const target = phone
                      ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`
                      : `https://wa.me/?text=${encodeURIComponent(message)}`;
                    window.open(target, "_blank", "noopener,noreferrer");
                  }}
                >
                  WhatsApp draft
                </Button>
                <Button
                  variant="danger"
                  onClick={() => revokeLink.mutate({ deliveryId: delivery.id })}
                >
                  Revoke link
                </Button>
              </>
            )}
          </>
        )}
        {!isDriver &&
          delivery.proofStatus === "Ready" &&
          canVerify(user.role) && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  verify.mutate({ deliveryId: delivery.id, approved: false })
                }
              >
                Flag correction
              </Button>
              <Button
                onClick={() =>
                  verify.mutate({ deliveryId: delivery.id, approved: true })
                }
              >
                <Check size={15} />
                Verify POD
              </Button>
            </>
          )}
        {!isDriver && (
          <Button variant="secondary" onClick={() => downloadPod(delivery.id)}>
            <Download size={15} />
            Download invoice / POD PDF
          </Button>
        )}
        {!isDriver && canStart && (
          <Button
            onClick={() =>
              update.mutate({
                deliveryId: delivery.id,
                status: "Out for Delivery",
              })
            }
          >
            <Truck size={15} />
            Start delivery
          </Button>
        )}
        {!isDriver && canArrive && (
          <Button
            variant="secondary"
            onClick={() =>
              update.mutate({ deliveryId: delivery.id, status: "Arrived" })
            }
          >
            <MapPin size={15} />
            Mark arrived
          </Button>
        )}
      </div>
      <div className="timeline">
        <span>
          <i className="done" />
          Created <small>{formatDate(delivery.createdAt)}</small>
        </span>
        <span>
          <i className={delivery.startedAt ? "done" : ""} />
          Started <small>{formatDate(delivery.startedAt)}</small>
        </span>
        <span>
          <i className={delivery.arrivedAt ? "done" : ""} />
          Arrived <small>{formatDate(delivery.arrivedAt)}</small>
        </span>
        <span>
          <i className={delivery.completedAt ? "done" : ""} />
          Completed <small>{formatDate(delivery.completedAt)}</small>
        </span>
        <span>
          <i className={delivery.verifiedAt ? "done" : ""} />
          Verified <small>{formatDate(delivery.verifiedAt)}</small>
        </span>
      </div>
    </Modal>
  );
}

function StaffView({
  staff,
  user,
  lang,
}: {
  staff: User[];
  user: User;
  lang: Lang;
}) {
  const [show, setShow] = useState(false);
  const create = trpc.staff.create.useMutation({
    onSuccess: () => {
      toast.success("Staff account created");
      setShow(false);
    },
  });
  const toggle = trpc.staff.setActive.useMutation({
    onSuccess: () => toast.success("Access updated"),
  });
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const reset = trpc.staff.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset");
      setResetFor(null);
      setNewPassword("");
    },
  });
  const utils = trpc.useUtils();
  useEffect(() => {
    if (create.isSuccess || toggle.isSuccess || reset.isSuccess)
      void utils.staff.list.invalidate();
  }, [create.isSuccess, toggle.isSuccess, reset.isSuccess, utils]);
  return (
    <>
      <PageHeading
        eyebrow="Control / access"
        title="Staff & permissions"
        detail="Owner-managed accounts with role-based access. Drivers only see their own assigned deliveries."
        action={
          canManage(user.role) && (
            <Button onClick={() => setShow(true)}>
              <UserPlus size={16} />
              Add staff
            </Button>
          )
        }
      />
      <section className="panel">
        <div className="table-meta">
          <span>
            <b>{staff.length}</b> accounts
          </span>
          <span className="muted">Passwords are never shown</span>
        </div>
        <div className="staff-list">
          {staff.map(member => (
            <div className="staff-row" key={member.id}>
              <Avatar name={member.name} />
              <div className="staff-identity">
                <b>{member.name}</b>
                <small>
                  {member.username ? `@${member.username}` : member.email}
                  {member.username && member.email ? ` · ${member.email}` : ""}
                  {member.phone ? ` · ${member.phone}` : ""}
                </small>
              </div>
              <span className="role-tag">{member.role}</span>
              <span
                className={`access ${member.active ? "active" : "inactive"}`}
              >
                {member.active ? "Active" : "Inactive"}
              </span>
              {canManage(user.role) && (
                <div className="row-actions">
                  <Button variant="ghost" onClick={() => setResetFor(member)}>
                    Reset password
                  </Button>
                  {member.id !== user.id && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        toggle.mutate({
                          userId: member.id,
                          active: !member.active,
                        })
                      }
                    >
                      {member.active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {show && (
        <StaffModal
          onClose={() => setShow(false)}
          pending={create.isPending}
          onSubmit={input =>
            create.mutate({ ...input, email: input.email.trim() || undefined })
          }
          lang={lang}
        />
      )}
      {resetFor && (
        <Modal
          title={`Reset password · ${resetFor.name}`}
          onClose={() => setResetFor(null)}
        >
          <Field label="New password">
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setResetFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={newPassword.length < 8}
              onClick={() =>
                reset.mutate({ userId: resetFor.id, password: newPassword })
              }
            >
              Save password
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function StaffModal({
  onClose,
  onSubmit,
  pending,
  lang,
}: {
  onClose: () => void;
  onSubmit: (input: any) => void;
  pending: boolean;
  lang: Lang;
}) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    role: "Driver",
    password: "",
  });
  return (
    <Modal title={ui[lang].addStaff} onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <div className="form-grid">
          <Field label={ui[lang].staffName}>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={ui[lang].staffUsername}>
            <input
              required
              autoComplete="username"
              value={form.username}
              onChange={e =>
                setForm({ ...form, username: e.target.value.trim() })
              }
            />
          </Field>
          <Field label={ui[lang].staffEmail}>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={ui[lang].staffPhone}>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label={ui[lang].staffRole}>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              {roles
                .filter(role => role !== "Owner")
                .map(role => (
                  <option key={role}>{role}</option>
                ))}
            </select>
          </Field>
          <Field
            label={ui[lang].staffPassword}
            hint="The staff member can use this immediately"
          >
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? ui[lang].wait : ui[lang].addStaff}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PodView({
  deliveries,
  user,
  lang,
}: {
  deliveries: Delivery[];
  user: User;
  lang: Lang;
}) {
  const verify = trpc.deliveries.verifyProof.useMutation({
    onSuccess: () => toast.success("POD review saved"),
  });
  const utils = trpc.useUtils();
  useEffect(() => {
    if (verify.isSuccess) void utils.deliveries.list.invalidate();
  }, [verify.isSuccess, utils]);
  const queue = deliveries.filter(d =>
    ["Ready", "Verified"].includes(d.proofStatus)
  );
  return (
    <>
      <PageHeading
        eyebrow="Evidence / verification"
        title="Proof of delivery"
        detail="Review carton handovers, confirm GPS evidence, and download a branded PDF record."
      />
      <div className="callout">
        <FileText size={18} />
        <span>
          <b>Customer signature is not required.</b>
          <small>
            Carton quantities, optional photos, remarks, timestamp, rider and
            GPS form the handover evidence.
          </small>
        </span>
      </div>
      <section className="panel">
        <div className="table-meta">
          <span>
            <b>{queue.filter(d => d.proofStatus === "Ready").length}</b>{" "}
            awaiting verification
          </span>
        </div>
        {queue.length ? (
          <div className="pod-list">
            {queue.map(delivery => (
              <div className="pod-row" key={delivery.id}>
                <div className="pod-icon">
                  <FileCheck2 size={19} />
                </div>
                <div className="pod-main">
                  <b>
                    {delivery.id} · {delivery.customer}
                  </b>
                  <small>
                    {delivery.deliveredCartons}/{delivery.cartons} cartons ·{" "}
                    {delivery.driver?.name ?? "Unassigned"} · submitted{" "}
                    {formatDate(delivery.completedAt)}
                  </small>
                  {delivery.gps && (
                    <small className="gps-line">
                      <MapPin size={11} />
                      GPS {delivery.gps.lat.toFixed(5)},{" "}
                      {delivery.gps.lng.toFixed(5)} · ±
                      {delivery.gps.accuracy ?? "—"}m
                    </small>
                  )}
                </div>
                <StatusPill
                  status={
                    delivery.proofStatus === "Ready"
                      ? "Pending Verification"
                      : "Delivered"
                  }
                />
                <div className="row-actions">
                  <Button
                    variant="secondary"
                    onClick={() => downloadPod(delivery.id)}
                  >
                    <Download size={14} />
                    PDF
                  </Button>
                  {delivery.proofStatus === "Ready" && canVerify(user.role) && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          verify.mutate({
                            deliveryId: delivery.id,
                            approved: false,
                          })
                        }
                      >
                        Flag
                      </Button>
                      <Button
                        onClick={() =>
                          verify.mutate({
                            deliveryId: delivery.id,
                            approved: true,
                          })
                        }
                      >
                        <Check size={14} />
                        Verify
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No POD evidence is waiting for review." />
        )}
      </section>
    </>
  );
}

function TrackerView({
  deliveries,
  user,
  lang,
}: {
  deliveries: Delivery[];
  user: User;
  lang: Lang;
}) {
  const t = ui[lang];
  const active = deliveries.filter(d =>
    ["Out for Delivery", "Arrived", "Assigned"].includes(d.status)
  );
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? "");
  useEffect(() => {
    if (!active.some(delivery => delivery.id === selectedId))
      setSelectedId(active[0]?.id ?? "");
  }, [active, selectedId]);
  const selected = active.find(d => d.id === selectedId);
  const settings = trpc.settings.get.useQuery();
  const drivers = trpc.staff.list.useQuery();
  const planner = trpc.deliveries.optimizeAndAssign.useMutation();
  const choices = deliveries.filter(d =>
    ["Out for Delivery", "Arrived", "Assigned", "Scheduled"].includes(d.status)
  );
  const [origin, setOrigin] = useState("");
  const [deliveryIds, setDeliveryIds] = useState<string[]>([]);
  const [driverId, setDriverId] = useState("");
  const [routeResult, setRouteResult] = useState<any>(null);
  const [routeError, setRouteError] = useState("");
  const companyAddress = settings.data?.address ?? "";
  const driverChoices = (drivers.data ?? []).filter(
    (d: User) => d.active && d.role === "Driver"
  );
  const gps = selected?.gps;
  const lat = gps?.lat ?? 24.8607,
    lng = gps?.lng ?? 67.0011;
  const bbox = `${lng - 0.025}%2C${lat - 0.018}%2C${lng + 0.025}%2C${lat + 0.018}`;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const google = routeResult?.orderedStops?.length
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(origin)}&waypoints=${encodeURIComponent(routeResult.orderedStops.map((x: any) => x.address).join("|"))}&travelmode=driving`
    : "";
  const optimize = async (e: FormEvent) => {
    e.preventDefault();
    setRouteError("");
    setRouteResult(null);
    if (!origin.trim()) {
      setRouteError(
        lang === "UR"
          ? "روانگی کا پتہ درج کریں۔"
          : "Enter a nonempty origin address."
      );
      return;
    }
    if (deliveryIds.length < 1 || deliveryIds.length > 23) {
      setRouteError(
        lang === "UR"
          ? "1 سے 23 ڈیلیوریز منتخب کریں۔"
          : "Select between 1 and 23 deliveries."
      );
      return;
    }
    if (!driverId) {
      setRouteError(
        lang === "UR" ? "فعال ڈرائیور منتخب کریں۔" : "Select an active driver."
      );
      return;
    }
    try {
      const result = await planner.mutateAsync({
        origin: origin.trim(),
        deliveryIds,
        driverId,
      });
      setRouteResult(result);
    } catch (error: any) {
      setRouteError(
        error?.message ||
          (lang === "UR"
            ? "روٹ بناتے وقت مسئلہ ہوا۔ دوبارہ کوشش کریں۔"
            : "Could not plan and assign this route. Check the selections and try again.")
      );
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={lang === "UR" ? "آپریشنز / مقام" : "Operations / location"}
        title={lang === "UR" ? "لائیو رائیڈر ٹریکر" : "Live rider tracker"}
        detail={
          lang === "UR"
            ? "ڈرائیور کے GPS شیئر کرنے پر تازہ ترین مقام یہاں دکھایا جائے گا۔"
            : "The latest rider location appears here after the driver shares GPS."
        }
      />
      <section className="tracker-layout">
        <div className="panel tracker-map">
          <div className="map-grid">
            <iframe
              className="map-frame"
              title={
                lang === "UR"
                  ? "رائیڈر کا لائیو نقشہ"
                  : "Rider live location map"
              }
              src={osm}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="map-copy">
              <MapPin size={22} />
              <b>{gps ? t.mapLatest : t.mapWaiting}</b>
              <strong>
                {selected?.driver?.name ??
                  (lang === "UR" ? "ڈرائیور تفویض نہیں" : "No driver assigned")}
              </strong>
              <span>
                {gps
                  ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`
                  : t.mapStart}
              </span>
              <small>
                {gps
                  ? `${lang === "UR" ? "درستگی" : "Accuracy"} ±${gps.accuracy ?? "—"}m · ${formatDate(gps.recordedAt)}`
                  : lang === "UR"
                    ? "کراچی کا عمومی نقشہ دکھایا جا رہا ہے۔"
                    : "Showing a default Karachi map."}
              </small>
            </div>
            <a
              className="map-link"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
            >
              <Link2 size={14} />
              {t.openMap}
            </a>
          </div>
        </div>
        <div className="panel tracker-list">
          <PanelTitle
            eyebrow={lang === "UR" ? "فعال اسائنمنٹس" : "Active assignments"}
            title={`${active.length} ${lang === "UR" ? "روٹ پر" : "on route"}`}
          />
          <select
            aria-label={
              lang === "UR" ? "ڈیلیوری منتخب کریں" : "Select delivery"
            }
            className="wide-select"
            disabled={!active.length}
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">
              {lang === "UR" ? "ڈیلیوری منتخب کریں" : "Select delivery"}
            </option>
            {active.map(d => (
              <option key={d.id} value={d.id}>
                {d.id} · {d.driver?.name ?? "Unassigned"}
              </option>
            ))}
          </select>
          {selected ? (
            <div className="tracker-detail">
              <StatusPill status={selected.status} />
              <h3>{selected.customer}</h3>
              <p>{selected.address}</p>
              <div>
                <span>{lang === "UR" ? "رائیڈر" : "Rider"}</span>
                <b>{selected.driver?.name ?? "Unassigned"}</b>
              </div>
              <div>
                <span>{lang === "UR" ? "ٹریل پوائنٹس" : "Trail points"}</span>
                <b>{selected.gpsTrailCount}</b>
              </div>
              <div>
                <span>{lang === "UR" ? "GPS اپ ڈیٹ" : "GPS update"}</span>
                <b>{gps ? formatDate(gps.recordedAt) : "—"}</b>
              </div>
            </div>
          ) : (
            <EmptyState
              text={
                lang === "UR"
                  ? "اس وقت کوئی فعال ڈیلیوری ٹریکنگ میں نہیں ہے۔ مکمل ڈیلیوریز POD اور ہسٹری میں موجود رہیں گی۔"
                  : "No active delivery is being tracked. Completed deliveries remain in POD and history."
              }
            />
          )}
        </div>
      </section>
      <section className="panel route-planner">
        <PanelTitle
          eyebrow={lang === "UR" ? "ڈسپیچ" : "DISPATCH"}
          title={t.planner}
        />
        <form onSubmit={optimize}>
          <div className="form-grid">
            <Field
              label={t.origin}
              hint={
                companyAddress
                  ? `${t.suggestOrigin}: ${companyAddress}`
                  : undefined
              }
            >
              <input
                required
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                placeholder={
                  companyAddress ||
                  (lang === "UR"
                    ? "روانگی کا پتہ درج کریں"
                    : "Enter an origin address")
                }
              />
              {companyAddress && (
                <button
                  className="button ghost origin-suggest"
                  type="button"
                  onClick={() => setOrigin(companyAddress)}
                >
                  {t.suggestOrigin}
                </button>
              )}
            </Field>
            <Field label={t.chooseDriver}>
              <select
                required
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
              >
                <option value="">
                  {lang === "UR" ? "ڈرائیور منتخب کریں" : "Select driver"}
                </option>
                {driverChoices.map((d: User) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="delivery-picker">
              <legend>{t.chooseDeliveries}</legend>
              <div className="delivery-checks">
                {choices.map(d => (
                  <label key={d.id}>
                    <input
                      type="checkbox"
                      checked={deliveryIds.includes(d.id)}
                      disabled={
                        !deliveryIds.includes(d.id) && deliveryIds.length >= 23
                      }
                      onChange={e =>
                        setDeliveryIds(old =>
                          e.target.checked
                            ? [...old, d.id]
                            : old.filter(id => id !== d.id)
                        )
                      }
                    />
                    <span>
                      {d.id} · {d.customer} <small>{d.status}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="modal-actions">
            <Button type="submit" disabled={planner.isPending}>
              {planner.isPending ? t.optimizing : t.optimize}
            </Button>
          </div>
        </form>
        {routeError && (
          <p className="route-error" role="alert">
            {routeError}
          </p>
        )}
        {routeResult && (
          <div className="route-result">
            <h3>{t.routeResult}</h3>
            <div className="route-stats">
              <span>
                <small>{t.routeDistance}</small>
                <b>{routeResult.distanceText}</b>
              </span>
              <span>
                <small>{t.routeDuration}</small>
                <b>{routeResult.durationText}</b>
              </span>
              <span>
                <small>{lang === "UR" ? "ڈرائیور" : "Assigned driver"}</small>
                <b>{routeResult.driverName}</b>
              </span>
            </div>
            <ol>
              {routeResult.orderedStops?.map((stop: any, i: number) => (
                <li key={`${stop.deliveryId}-${i}`}>
                  <b>{stop.customer}</b>
                  <small>
                    {stop.address} · {stop.deliveryId}
                  </small>
                </li>
              ))}
            </ol>
            <a
              className="button secondary"
              target="_blank"
              rel="noreferrer"
              href={google}
            >
              {lang === "UR"
                ? "Google Maps میں راستہ کھولیں"
                : "Open directions in Google Maps"}
            </a>
            <p className="signature-note">{t.noMaps}</p>
          </div>
        )}
      </section>
    </>
  );
}

async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let quality = 0.82,
    data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 1_340_000 && quality > 0.4) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 1_340_000) throw new Error("too-large");
  return data;
}
function DriverView({
  deliveries,
  lang,
  user,
}: {
  deliveries: Delivery[];
  lang: Lang;
  user: User;
}) {
  const t = ui[lang];
  const active = deliveries.find(d =>
    ["Out for Delivery", "Arrived", "Assigned", "Scheduled"].includes(d.status)
  );
  const destinationMapUrl = active?.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(active.address)}&output=embed`
    : "";
  const destinationDirectionsUrl = active?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(active.address)}`
    : "";
  const [tracking, setTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [gps, setGps] = useState<Delivery["gps"]>(active?.gps ?? null);
  const [delivered, setDelivered] = useState(
    active?.deliveredCartons?.toString() ?? ""
  );
  const [rejected, setRejected] = useState("0");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoMetadata, setPhotoMetadata] = useState<
    { capturedAt: string; lat?: number; lng?: number; note?: string }[]
  >([]);
  const [photoNote, setPhotoNote] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [queueMessage, setQueueMessage] = useState("");
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [cameraScanning, setCameraScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const syncQueueRef = useRef<() => void>(() => {});
  const watchRef = useRef<number | null>(null);
  const utils = trpc.useUtils();
  const location = trpc.deliveries.updateLocation.useMutation();
  const statusUpdate = trpc.deliveries.updateStatus.useMutation({
    onSuccess: result => {
      toast.success(
        result?.status === "Arrived"
          ? lang === "UR"
            ? "آمد کا وقت محفوظ ہو گیا"
            : "Arrival time recorded"
          : lang === "UR"
            ? "ڈیلیوری شروع ہو گئی"
            : "Delivery started"
      );
      void utils.deliveries.list.invalidate();
      void utils.dashboard.summary.invalidate();
    },
  });
  const recordBarcode = trpc.deliveries.recordCartonScan.useMutation({
    onSuccess: result => {
      if (result.duplicate) {
        toast.info(
          lang === "UR"
            ? "یہ بارکوڈ پہلے اسکین ہو چکا ہے"
            : "This barcode was already scanned"
        );
        return;
      }
      if (!active) return;
      setDelivered(value =>
        String(
          Math.min(
            Math.max(0, active.cartons - (Number(rejected) || 0)),
            Math.max(Number(value) || 0, result.scannedCount)
          )
        )
      );
      toast.success(
        lang === "UR"
          ? "کارٹن اسکین محفوظ ہو گیا"
          : `Carton scan ${result.scannedCount} saved`
      );
      void utils.deliveries.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const proof = trpc.deliveries.submitProof.useMutation({
    onSuccess: () => {
      toast.success(
        lang === "UR"
          ? "POD محفوظ ہو گیا"
          : "POD saved and sent for verification"
      );
      if (watchRef.current !== null)
        navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
      setTracking(false);
      setGpsMessage("");
      void utils.deliveries.list.invalidate();
      void utils.dashboard.summary.invalidate();
    },
  });
  useEffect(() => {
    setGps(active?.gps ?? null);
    setDelivered(active?.deliveredCartons?.toString() ?? "");
    setRejected("0");
    setNotes("");
    setPhotos([]);
    setPhotoMetadata([]);
    setBarcode("");
    setScanMessage("");
  }, [active?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const sync = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      setQueueSyncing(true);
      try {
        const queued = await listPendingProofs(user.id);
        if (!disposed) setPendingCount(queued.length);
        for (const item of queued) {
          try {
            await proof.mutateAsync({
              deliveryId: item.deliveryId,
              deliveredCartons: item.deliveredCartons,
              rejectedCartons: item.rejectedCartons,
              notes: item.notes,
              photos: item.photos,
              photoMetadata: item.photoMetadata,
              submissionId: item.submissionId,
              expectedUpdatedAt: item.expectedUpdatedAt,
            });
            await removePendingProof(item.submissionId);
            if (!disposed) setPendingCount(count => Math.max(0, count - 1));
          } catch (error) {
            const code = (error as any)?.data?.code as string | undefined;
            const message =
              error instanceof Error
                ? error.message
                : "Queued POD could not sync.";
            if (!disposed)
              setQueueMessage(
                code === "CONFLICT"
                  ? `POD needs review: ${message}. It remains safely queued.`
                  : `${message}. The POD remains queued and will not be discarded.`
              );
            break;
          }
        }
        const remaining = await listPendingProofs(user.id);
        if (!disposed) {
          setPendingCount(remaining.length);
          if (queued.length > 0 && remaining.length === 0)
            setQueueMessage("Offline POD synced successfully.");
        }
      } catch (error) {
        if (!disposed)
          setQueueMessage(
            error instanceof Error
              ? error.message
              : "Offline POD storage is unavailable in this browser."
          );
      } finally {
        running = false;
        if (!disposed) setQueueSyncing(false);
      }
    };
    syncQueueRef.current = () => void sync();
    const onOnline = () => void sync();
    const onOffline = () =>
      setQueueMessage(
        "Offline. New POD submissions will be queued on this device."
      );
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void sync();
    return () => {
      disposed = true;
      syncQueueRef.current = () => {};
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user.id]);
  useEffect(() => {
    if (!cameraScanning || !active) return;
    let cancelled = false;
    let frame = 0;
    const start = async () => {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setScanMessage(
          "Camera scanning is not supported here; enter or use a USB scanner below."
        );
        setCameraScanning(false);
        return;
      }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setScanMessage("Camera scanning requires HTTPS and camera permission.");
        setCameraScanning(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new Detector();
      const scan = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results?.[0]?.rawValue?.trim();
          if (value) {
            setCameraScanning(false);
            submitBarcode(value);
            return;
          }
        } catch {
          // Camera decode errors are transient; continue scanning.
        }
        frame = requestAnimationFrame(() => void scan());
      };
      frame = requestAnimationFrame(() => void scan());
    };
    void start().catch(error => {
      setScanMessage(
        error instanceof Error
          ? error.message
          : "Camera could not be opened. Use manual scan."
      );
      setCameraScanning(false);
    });
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      cameraStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraScanning, active?.id]);
  const submitBarcode = (value: string) => {
    if (!active) return;
    const normalized = value.trim();
    if (!normalized) return;
    if (normalized.toLowerCase() === active.challan.trim().toLowerCase()) {
      toast.success(
        lang === "UR" ? "چالان کی تصدیق ہو گئی" : "Challan barcode confirmed"
      );
    } else {
      recordBarcode.mutate({ deliveryId: active.id, barcode: normalized });
    }
    setBarcode("");
  };
  useEffect(
    () => () => {
      if (watchRef.current !== null)
        navigator.geolocation?.clearWatch(watchRef.current);
    },
    []
  );
  const toggleTracking = () => {
    // This handler is invoked directly by the rider's button click so the browser
    // can apply its user-gesture permission flow. Apps cannot override browser denial.
    if (!active) return;
    if (tracking) {
      if (watchRef.current !== null)
        navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
      setTracking(false);
      setGpsMessage("");
      return;
    }
    if (!window.isSecureContext) {
      setGpsMessage(
        lang === "UR"
          ? "GPS کے لیے محفوظ HTTPS کنکشن ضروری ہے۔ سائٹ کو HTTPS پر کھولیں۔"
          : "GPS requires a secure HTTPS connection. Open this site using HTTPS."
      );
      return;
    }
    if (!navigator.geolocation) {
      setGpsMessage(
        lang === "UR"
          ? "یہ براؤزر جغرافیائی مقام فراہم نہیں کرتا۔ کسی معاون HTTPS براؤزر میں کھولیں۔"
          : "This browser does not provide geolocation. Open the site in a supported browser over HTTPS."
      );
      return;
    }
    setGpsMessage(
      lang === "UR"
        ? "مقام کی اجازت درکار ہے۔ اگر پوچھا جائے تو براؤزر میں اجازت دیں۔"
        : "Location permission is needed. Allow it in your browser if prompted."
    );
    setTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      position => {
        setGpsMessage(
          lang === "UR"
            ? "GPS فعال ہے اور مقام شیئر ہو رہا ہے۔"
            : "GPS is active and sharing location."
        );
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          speed: position.coords.speed,
          heading: position.coords.heading,
          recordedAt: new Date().toISOString(),
        };
        setGps(point);
        location.mutate({ deliveryId: active.id, ...point });
      },
      error => {
        setTracking(false);
        if (watchRef.current !== null)
          navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        let en =
          "Location could not be determined. Check device location services and try again.";
        let ur =
          "مقام معلوم نہیں ہو سکا۔ آلے کی لوکیشن سروسز دیکھ کر دوبارہ کوشش کریں۔";
        if (error.code === error.PERMISSION_DENIED) {
          en =
            "Location permission was denied. Allow location for this site in browser site settings, then try again.";
          ur =
            "مقام کی اجازت مسترد ہوئی۔ براؤزر کی سائٹ سیٹنگز میں اس سائٹ کے لیے لوکیشن کی اجازت دیں، پھر دوبارہ کوشش کریں۔";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          en =
            "Location is unavailable. Check device location services or signal and try again.";
          ur =
            "مقام دستیاب نہیں۔ آلے کی لوکیشن سروس یا سگنل دیکھ کر دوبارہ کوشش کریں۔";
        } else if (error.code === error.TIMEOUT) {
          en = "Location request timed out. Check signal and try again.";
          ur =
            "مقام کی درخواست کا وقت ختم ہو گیا۔ سگنل دیکھ کر دوبارہ کوشش کریں۔";
        }
        setGpsMessage(lang === "UR" ? ur : en);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };
  const submit = async () => {
    if (!active) return;
    const submission = {
      deliveryId: active.id,
      deliveredCartons: Number(delivered),
      rejectedCartons: Number(rejected),
      notes,
      photos,
      photoMetadata,
      submissionId: crypto.randomUUID(),
    };
    if (navigator.onLine) {
      try {
        await proof.mutateAsync(submission);
        return;
      } catch (error) {
        const code = (error as any)?.data?.code as string | undefined;
        if (
          [
            "BAD_REQUEST",
            "FORBIDDEN",
            "UNAUTHORIZED",
            "NOT_FOUND",
            "CONFLICT",
          ].includes(code ?? "")
        ) {
          toast.error(
            error instanceof Error ? error.message : "POD could not be saved."
          );
          return;
        }
      }
    }
    try {
      await savePendingProof({
        ...submission,
        userId: user.id,
        expectedUpdatedAt: active.updatedAt,
        queuedAt: new Date().toISOString(),
      });
      const queued = await listPendingProofs(user.id);
      setPendingCount(queued.length);
      setQueueMessage(
        navigator.onLine
          ? "Network did not confirm the save. POD is queued safely; tap Sync pending when ready."
          : "Offline. POD is queued on this device and will sync after reconnecting."
      );
      toast.info("POD safely queued on this device.");
      if (navigator.onLine) syncQueueRef.current();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not store POD offline. Keep this screen open and retry."
      );
    }
  };
  return (
    <div className={`driver-screen ${lang === "UR" ? "rtl" : ""}`}>
      <div className="driver-head">
        <div>
          <span className="eyebrow">
            {lang === "UR" ? "رائیڈر ورک اسپیس" : "RIDER WORKSPACE"}
          </span>
          <h1>
            {lang === "UR"
              ? `السلام علیکم، ${user.name}`
              : `Hello, ${user.name}.`}
          </h1>
          <p>
            {lang === "UR"
              ? "چند آسان مراحل میں ہینڈ اوور مکمل کریں۔"
              : "Complete the handover in a few clear steps."}
          </p>
        </div>
        <div className="driver-head-actions">
          {active && ["Scheduled", "Assigned"].includes(active.status) && (
            <Button
              onClick={() =>
                statusUpdate.mutate({
                  deliveryId: active.id,
                  status: "Out for Delivery",
                })
              }
            >
              <Truck size={16} />
              {lang === "UR" ? "ڈیلیوری شروع کریں" : "Start delivery"}
            </Button>
          )}
          {active?.status === "Out for Delivery" && (
            <Button
              variant="secondary"
              onClick={() =>
                statusUpdate.mutate({
                  deliveryId: active.id,
                  status: "Arrived",
                })
              }
            >
              <MapPin size={16} />
              {lang === "UR" ? "مقام پر پہنچ گئے" : "Mark arrived"}
            </Button>
          )}
          {pendingCount > 0 && (
            <Button
              variant="secondary"
              disabled={!navigator.onLine || queueSyncing}
              onClick={() => syncQueueRef.current()}
            >
              <RefreshCw size={16} />
              {queueSyncing ? "Syncing…" : `Sync pending (${pendingCount})`}
            </Button>
          )}
          <Button
            variant={tracking ? "danger" : "secondary"}
            onClick={toggleTracking}
          >
            <MapPin size={16} />
            {tracking
              ? lang === "UR"
                ? "GPS بند کریں"
                : "Stop GPS"
              : lang === "UR"
                ? "GPS شروع کریں"
                : "Start GPS"}
          </Button>
        </div>
      </div>
      {queueMessage && (
        <p role="status" className="signature-note">
          {queueMessage}
        </p>
      )}
      {active ? (
        <>
          <div className="driver-active">
            <div>
              <span className="live-label">
                <i />
                {lang === "UR" ? "فعال ڈیلیوری" : "ACTIVE DELIVERY"}
              </span>
              <h2>{active.customer}</h2>
              <p>
                <MapPin size={15} />
                {active.address}
              </p>
              <div className="driver-timer-strip">
                {active.startedAt && (
                  <span>
                    <Clock3 size={14} />
                    Trip elapsed ·{" "}
                    {Math.max(
                      0,
                      Math.round(
                        ((active.completedAt
                          ? new Date(active.completedAt).getTime()
                          : now) -
                          new Date(active.startedAt).getTime()) /
                          60000
                      )
                    )}{" "}
                    min
                  </span>
                )}
                {active.arrivedAt && (
                  <span>
                    <Clock3 size={14} />
                    At stop ·{" "}
                    {Math.max(
                      0,
                      Math.round(
                        ((active.completedAt
                          ? new Date(active.completedAt).getTime()
                          : now) -
                          new Date(active.arrivedAt).getTime()) /
                          60000
                      )
                    )}{" "}
                    min
                  </span>
                )}
              </div>
            </div>
            <span className="mono">{active.id}</span>
          </div>
          {destinationMapUrl && (
            <section className="panel driver-destination-map">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">
                    {lang === "UR" ? "ڈیلیوری کا مقام" : "DELIVERY DESTINATION"}
                  </span>
                  <h2>
                    {lang === "UR" ? "یہاں پہنچنا ہے" : "Where to deliver"}
                  </h2>
                </div>
                <a
                  className="button secondary"
                  href={destinationDirectionsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={15} />
                  {lang === "UR" ? "راستہ کھولیں" : "Open directions"}
                </a>
              </div>
              <iframe
                title="Delivery destination map"
                src={destinationMapUrl}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <p className="driver-destination-address">
                <MapPin size={14} /> {active.address}
              </p>
            </section>
          )}
          <div className="driver-grid">
            <section className="panel proof-form">
              <PanelTitle
                eyebrow={lang === "UR" ? "کارٹن ہینڈ اوور" : "CARTON HANDOVER"}
                title={
                  lang === "UR" ? "کیا ڈیلیور ہوا؟" : "What was delivered?"
                }
              />
              <div className="quantity-grid">
                <Field
                  label={lang === "UR" ? "ڈیلیورڈ کارٹن" : "Delivered cartons"}
                >
                  <input
                    type="number"
                    min="0"
                    max={active.cartons}
                    value={delivered}
                    onChange={e => setDelivered(e.target.value)}
                  />
                </Field>
                <Field
                  label={lang === "UR" ? "خراب / واپس" : "Rejected / damaged"}
                >
                  <input
                    type="number"
                    min="0"
                    max={active.cartons}
                    value={rejected}
                    onChange={e => setRejected(e.target.value)}
                  />
                </Field>
              </div>
              <section className="barcode-scan-panel">
                <div>
                  <b>
                    {lang === "UR"
                      ? "چالان / کارٹن بارکوڈ"
                      : "Challan / carton barcode"}
                  </b>
                  <small>
                    {lang === "UR"
                      ? "منفرد اسکین شدہ کارٹن"
                      : `Unique carton scans · ${active.scannedBarcodes?.length ?? 0} / ${active.cartons}`}
                  </small>
                </div>
                <div className="barcode-scan-controls">
                  <input
                    value={barcode}
                    onChange={event => setBarcode(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitBarcode(barcode);
                      }
                    }}
                    placeholder={
                      lang === "UR"
                        ? "بارکوڈ اسکین کریں یا درج کریں"
                        : "Scan or enter barcode; USB scanners work too"
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setScanMessage("");
                      setCameraScanning(value => !value);
                    }}
                  >
                    <ScanLine size={15} />
                    {cameraScanning ? "Stop camera" : "Scan with camera"}
                  </Button>
                </div>
                {cameraScanning && (
                  <video
                    ref={videoRef}
                    className="barcode-camera"
                    autoPlay
                    muted
                    playsInline
                  />
                )}
                {scanMessage && <small role="status">{scanMessage}</small>}
              </section>
              <Field
                label={
                  lang === "UR"
                    ? "مختصر نوٹ (اختیاری)"
                    : "Short note (optional)"
                }
              >
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={
                    lang === "UR"
                      ? "مثلاً 2 کارٹن واپس"
                      : "e.g. 2 cartons returned"
                  }
                />
              </Field>
              <Field
                label={
                  lang === "UR" ? "تصاویر (اختیاری)" : "Proof photos (optional)"
                }
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={async e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length + photos.length > 3) {
                      toast.error(ui[lang].photoLimit);
                      e.currentTarget.value = "";
                      return;
                    }
                    try {
                      const converted = await Promise.all(
                        files.map(compressPhoto)
                      );
                      setPhotos(current => [...current, ...converted]);
                      const capturedAt = new Date().toISOString();
                      setPhotoMetadata(current => [
                        ...current,
                        ...converted.map(() => ({
                          capturedAt,
                          ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
                          ...(photoNote ? { note: photoNote } : {}),
                        })),
                      ]);
                    } catch {
                      toast.error(ui[lang].photoTooLarge);
                    }
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  value={photoNote}
                  onChange={e => setPhotoNote(e.target.value)}
                  placeholder={
                    lang === "UR"
                      ? "تصویر کا نوٹ"
                      : "Photo note (applies to next captures)"
                  }
                />
                <small>
                  {lang === "UR"
                    ? ui[lang].photosHint
                    : `${photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} selected · ` : ""}${ui[lang].photosHint}`}
                </small>
                {photos.length > 0 && (
                  <div className="photo-previews">
                    {photos.map((photo, index) => (
                      <div
                        className="photo-preview"
                        key={`${index}-${photo.slice(-20)}`}
                      >
                        <img
                          src={photo}
                          alt={`${lang === "UR" ? "ثبوت کی تصویر" : "Proof photo"} ${index + 1}`}
                        />
                        <small>
                          {formatDate(photoMetadata[index]?.capturedAt)}
                          {photoMetadata[index]?.lat != null &&
                          photoMetadata[index]?.lng != null
                            ? ` · ${photoMetadata[index]?.lat?.toFixed(5)}, ${photoMetadata[index]?.lng?.toFixed(5)}`
                            : " · GPS not captured"}
                          {photoMetadata[index]?.note
                            ? ` · ${photoMetadata[index]?.note}`
                            : ""}
                        </small>
                        <button
                          type="button"
                          className="button ghost"
                          aria-label={`${ui[lang].removePhoto} ${index + 1}`}
                          onClick={() => {
                            setPhotos(items =>
                              items.filter((_, i) => i !== index)
                            );
                            setPhotoMetadata(items =>
                              items.filter((_, i) => i !== index)
                            );
                          }}
                        >
                          {ui[lang].removePhoto}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
              <div className="gps-card">
                <MapPin size={18} />
                <span>
                  <b>
                    {gps
                      ? lang === "UR"
                        ? "GPS محفوظ"
                        : "GPS captured"
                      : lang === "UR"
                        ? "GPS شامل نہیں"
                        : "GPS not captured"}
                  </b>
                  <small>
                    {gps
                      ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} · ±${gps.accuracy ?? "—"}m`
                      : "Optional, high-accuracy location"}
                  </small>
                </span>
                <Button variant="ghost" onClick={toggleTracking}>
                  {tracking
                    ? lang === "UR"
                      ? "ٹریکنگ جاری…"
                      : "Tracking…"
                    : lang === "UR"
                      ? "GPS شروع کریں"
                      : "Start GPS"}
                </Button>
              </div>
              {gpsMessage && (
                <p role="status" className="signature-note">
                  {gpsMessage}
                </p>
              )}
              <Button onClick={submit} disabled={proof.isPending || !delivered}>
                <Check size={17} />
                {proof.isPending
                  ? lang === "UR"
                    ? "محفوظ ہو رہا ہے…"
                    : "Saving…"
                  : lang === "UR"
                    ? "ڈیلیوری ختم کریں اور POD جمع کریں"
                    : "End delivery & submit POD"}
              </Button>
              <p className="signature-note">
                {lang === "UR"
                  ? "کسٹمر کے دستخط کی ضرورت نہیں"
                  : "No customer signature is required."}
              </p>
            </section>
            <section className="panel driver-next">
              <PanelTitle
                eyebrow={lang === "UR" ? "اگلا کام" : "NEXT UP"}
                title={lang === "UR" ? "آپ کا روٹ" : "Your route"}
              />
              {deliveries
                .filter(d => d.id !== active.id)
                .slice(0, 5)
                .map(item => (
                  <div className="next-row" key={item.id}>
                    <span className="route-number">{item.id.slice(-2)}</span>
                    <div>
                      <b>{item.customer}</b>
                      <small>{item.address}</small>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
            </section>
          </div>
        </>
      ) : (
        <EmptyState
          text={
            lang === "UR"
              ? "آپ کو ابھی کوئی ڈیلیوری تفویض نہیں ہوئی۔"
              : "No delivery is assigned to you yet."
          }
        />
      )}
    </div>
  );
}

function SettingsView({ lang }: { lang: Lang }) {
  const query = trpc.settings.get.useQuery();
  const sessions = trpc.auth.sessions.useQuery();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => toast.success("Settings saved"),
  });
  const revokeSession = trpc.auth.revokeSession.useMutation({
    onSuccess: () => void sessions.refetch(),
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed. Other sessions were signed out.");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    },
    onError: error => toast.error(error.message),
  });
  const [form, setForm] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => {
    if (query.data && !form) setForm(query.data);
  }, [query.data, form]);
  if (query.isLoading || !form) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="Owner control / configuration"
        title="Company settings"
        detail="Keep the company identity and operating context editable without inventing missing contact details."
      />
      <section className="panel settings-panel">
        <div className="form-grid">
          {(
            [
              "companyName",
              "address",
              "phone",
              "email",
              "website",
              "timezone",
              "currency",
            ] as const
          ).map(key => (
            <Field
              key={key}
              label={
                key === "companyName"
                  ? "Company name"
                  : key[0].toUpperCase() + key.slice(1)
              }
            >
              <input
                value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <div className="modal-actions">
          <Button
            onClick={() => update.mutate(form)}
            disabled={update.isPending}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>
      <section className="panel settings-security-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Security</span>
            <h2>Account security</h2>
          </div>
          <Button variant="secondary" onClick={() => setShowPassword(true)}>
            Change password
          </Button>
        </div>
        <div className="session-list">
          {(sessions.data ?? []).map(session => (
            <div className="session-row" key={session.id}>
              <div>
                <b>
                  {session.current ? "Current browser session" : session.label}
                </b>
                <small>
                  Signed in {formatDate(session.createdAt)} · Expires{" "}
                  {formatDate(session.expiresAt)}
                </small>
              </div>
              {!session.current && (
                <Button
                  variant="danger"
                  onClick={() =>
                    revokeSession.mutate({ sessionId: session.id })
                  }
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
      {showPassword && (
        <Modal title="Change password" onClose={() => setShowPassword(false)}>
          <Field label="New password" hint="At least 12 characters">
            <input
              type="password"
              minLength={12}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              minLength={12}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowPassword(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                newPassword.length < 12 ||
                newPassword !== confirmPassword ||
                changePassword.isPending
              }
              onClick={() => changePassword.mutate({ newPassword })}
            >
              Save password
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function AuditView({ lang }: { lang: Lang }) {
  const query = trpc.audit.list.useQuery();
  return (
    <>
      <PageHeading
        eyebrow="Control / traceability"
        title="Audit log"
        detail="Login, delivery creation, assignment, status, proof, verification and permission changes are recorded here."
      />
      <section className="panel">
        {query.data?.length ? (
          <div className="audit-list">
            {query.data.map(item => (
              <div className="audit-row" key={item.id}>
                <span className="audit-icon">
                  <Activity size={15} />
                </span>
                <div>
                  <b>{item.action.replaceAll("_", " ")}</b>
                  <small>{item.details}</small>
                </div>
                <span>
                  <b>{item.actorName}</b>
                  <small>{formatDate(item.createdAt)}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No audit events yet." />
        )}
      </section>
    </>
  );
}
function Loading() {
  return (
    <div className="loading">
      <RefreshCw className="spin" size={20} />
      Loading workspace…
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">NAZMI POD</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const trackToken = window.location.pathname.match(/^\/track\/([^/]+)$/)?.[1];
  const customerPortal = ["/customer-tracking", "/track"].includes(
    window.location.pathname
  );
  const me = trpc.auth.me.useQuery();
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: !trackToken,
    refetchInterval: 30000,
  });
  const markNotification = trpc.notifications.markRead.useMutation({
    onSuccess: () => void notificationsQuery.refetch(),
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const utils = trpc.useUtils();
  const [view, setView] = useState<ViewKey>(() =>
    window.location.pathname === "/driver"
      ? "driver"
      : (window.location.pathname.slice(1) as ViewKey) || "overview"
  );
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("nazmi-lang") as Lang) || "EN"
  );
  useEffect(() => {
    const update = () =>
      setLang((localStorage.getItem("nazmi-lang") as Lang) || "EN");
    window.addEventListener("nazmi-language", update);
    return () => window.removeEventListener("nazmi-language", update);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "UR" ? "ur" : "en";
    document.documentElement.dir = lang === "UR" ? "rtl" : "ltr";
  }, [lang]);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
      toast.success("Signed out");
    },
  });
  const user = me.data as User | null | undefined;
  const navigate = (next: ViewKey) => {
    setView(next);
    window.history.replaceState(
      null,
      "",
      next === "overview" ? "/" : `/${next}`
    );
  };
  if (trackToken)
    return <PublicTracking token={decodeURIComponent(trackToken)} />;
  if (customerPortal) return <CustomerTrackingLanding />;
  if (me.isLoading) return <Loading />;
  if (!user)
    return <AuthScreen lang={lang} onComplete={() => void me.refetch()} />;
  const t = ui[lang];
  return (
    <div className={`app-shell ${lang === "UR" ? "rtl" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Brand />
          <button className="mobile-close">
            <X size={18} />
          </button>
        </div>
        <div className="workspace-chip">
          <span className="live-dot" />
          <span>
            <b>Nazmi Packaging</b>
            <small>Primary workspace</small>
          </span>
        </div>
        <nav>
          {user.role === "Driver" ? (
            <NavButton
              active={view === "driver"}
              icon={<Truck />}
              label={t.driver}
              onClick={() => navigate("driver")}
            />
          ) : (
            <>
              <NavButton
                active={view === "overview"}
                icon={<LayoutDashboard />}
                label={t.dashboard}
                onClick={() => navigate("overview")}
              />
              <NavButton
                active={view === "deliveries"}
                icon={<PackageCheck />}
                label={t.deliveries}
                onClick={() => navigate("deliveries")}
              />
              <NavButton
                active={view === "pod"}
                icon={<FileCheck2 />}
                label={t.pod}
                onClick={() => navigate("pod")}
              />
              <NavButton
                active={view === "tracker"}
                icon={<MapPin />}
                label={t.tracker}
                onClick={() => navigate("tracker")}
              />
              <NavButton
                active={view === "staff"}
                icon={<UsersRound />}
                label={t.staff}
                onClick={() => navigate("staff")}
              />
              {user.role === "Owner" && (
                <>
                  <NavButton
                    active={view === "operations"}
                    icon={<Activity />}
                    label={t.operations}
                    onClick={() => navigate("operations")}
                  />
                  <NavButton
                    active={view === "driver-preview"}
                    icon={<Truck />}
                    label={t.driverPreview}
                    onClick={() => navigate("driver-preview")}
                  />
                  <NavButton
                    active={view === "reports"}
                    icon={<BarChart3 />}
                    label={t.reports}
                    onClick={() => navigate("reports")}
                  />
                  <NavButton
                    active={view === "fleet"}
                    icon={<CalendarDays />}
                    label={t.fleet}
                    onClick={() => navigate("fleet")}
                  />
                </>
              )}
              {["Owner", "Director"].includes(user.role) && (
                <NavButton
                  active={view === "settings"}
                  icon={<Settings2 />}
                  label={t.settings}
                  onClick={() => navigate("settings")}
                />
              )}
              <NavButton
                active={view === "audit"}
                icon={<ShieldCheck />}
                label={t.audit}
                onClick={() => navigate("audit")}
              />
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="system-state">
            <span className="live-dot" />
            <span>
              <b>System healthy</b>
              <small>Secure server session</small>
            </span>
          </div>
          <div className="user-card">
            <Avatar name={user.name} />
            <span>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </span>
            <button onClick={() => logout.mutate()} title={t.signOut}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu">
              <Menu size={19} />
            </button>
            <button
              className="crumb"
              onClick={() =>
                navigate(user.role === "Driver" ? "driver" : "overview")
              }
            >
              <Zap size={15} /> NAZMI POD <span>/</span>{" "}
              <b>
                {user.role === "Driver"
                  ? t.driver
                  : view === "overview"
                    ? t.dashboard
                    : (t[view as keyof typeof t] ?? view)}
              </b>
            </button>
          </div>
          <div className="top-actions">
            <button
              className="language-button"
              onClick={() => {
                const next = lang === "EN" ? "UR" : "EN";
                setLang(next);
                localStorage.setItem("nazmi-lang", next);
              }}
            >
              {lang === "EN" ? "اردو" : "EN"}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(v => !v)}
              >
                <Bell size={18} />
                {(notificationsQuery.data ?? []).filter((n: any) => !n.readAt)
                  .length > 0 && (
                  <i>
                    {
                      (notificationsQuery.data ?? []).filter(
                        (n: any) => !n.readAt
                      ).length
                    }
                  </i>
                )}
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <b>Notifications</b>
                  {(notificationsQuery.data ?? []).length ? (
                    (notificationsQuery.data ?? []).map((n: any) => (
                      <button
                        key={n.id}
                        className={n.readAt ? "read" : "unread"}
                        onClick={() =>
                          !n.readAt &&
                          markNotification.mutate({ notificationId: n.id })
                        }
                      >
                        <span>{n.message ?? n.title ?? "Delivery update"}</span>
                        <small>
                          {n.createdAt ? formatDate(n.createdAt) : ""}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="muted">No notifications.</p>
                  )}
                </div>
              )}
            </div>
            <span className="role-chip">
              <CircleUserRound size={14} />
              {user.role}
            </span>
            <Avatar name={user.name} />
          </div>
        </header>
        <div className="content">
          {user.role === "Driver" || view === "driver" ? (
            <DriverWorkspace lang={lang} user={user} />
          ) : (
            <WorkspaceView
              view={view}
              user={user}
              navigate={navigate}
              lang={lang}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown className="nav-chevron" size={14} />
    </button>
  );
}
function DriverWorkspace({ lang, user }: { lang: Lang; user: User }) {
  const query = trpc.deliveries.list.useQuery(undefined, {
    refetchInterval: 15000,
  });
  if (query.isLoading) return <Loading />;
  return (
    <DriverView
      deliveries={(query.data ?? []) as Delivery[]}
      lang={lang}
      user={user}
    />
  );
}
function OperationsCenterView({
  deliveries,
  staff,
  navigate,
  lang,
}: {
  deliveries: Delivery[];
  staff: User[];
  navigate: (view: ViewKey) => void;
  lang: Lang;
}) {
  const active = deliveries.filter(d =>
    ["Out for Delivery", "Arrived"].includes(d.status)
  );
  const unassigned = deliveries.filter(
    d => !d.assignedDriverId && !["Delivered", "Cancelled"].includes(d.status)
  );
  const drivers = staff.filter(
    member => member.role === "Driver" && member.active
  );
  return (
    <>
      <PageHeading
        eyebrow="Owner control / command center"
        title={lang === "UR" ? "آپریشنز سینٹر" : "Operations Center"}
        detail="A single control room for staffing, route readiness, active deliveries, and exceptions."
        action={
          <Button onClick={() => navigate("settings")}>
            <Settings2 size={15} /> Owner settings
          </Button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Active riders"
          value={drivers.length}
          hint="enabled Driver accounts"
          icon={<Truck />}
          tone="blue"
        />
        <Metric
          label="On route now"
          value={active.length}
          hint="live delivery movements"
          icon={<MapPin />}
          tone="amber"
        />
        <Metric
          label="Unassigned"
          value={unassigned.length}
          hint="needs dispatch action"
          icon={<UsersRound />}
          tone="coral"
        />
        <Metric
          label="Total staff"
          value={staff.length}
          hint="all access roles"
          icon={<ShieldCheck />}
        />
      </div>
      <div className="split-grid owner-control-grid">
        <section className="panel">
          <PanelTitle
            eyebrow="Dispatch readiness"
            title="Needs action"
            action={
              <Button variant="ghost" onClick={() => navigate("deliveries")}>
                Open deliveries <ArrowRight size={15} />
              </Button>
            }
          />
          {unassigned.length ? (
            <div className="control-list">
              {unassigned.slice(0, 6).map(delivery => (
                <div className="control-row" key={delivery.id}>
                  <span>
                    <b>{delivery.customer}</b>
                    <small>
                      {delivery.id} · {delivery.status}
                    </small>
                  </span>
                  <StatusPill status={delivery.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No unassigned deliveries." />
          )}
        </section>
        <section className="panel">
          <PanelTitle
            eyebrow="People"
            title="Staff access"
            action={
              <Button variant="ghost" onClick={() => navigate("staff")}>
                Manage staff <ArrowRight size={15} />
              </Button>
            }
          />
          <div className="control-list">
            {staff.slice(0, 6).map(member => (
              <div className="control-row" key={member.id}>
                <span>
                  <b>{member.name}</b>
                  <small>@{member.username || "no-username"}</small>
                </span>
                <span
                  className={`access ${member.active ? "active" : "inactive"}`}
                >
                  {member.active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function DriverPreviewView({
  deliveries,
  navigate,
}: {
  deliveries: Delivery[];
  navigate: (view: ViewKey) => void;
}) {
  const active = deliveries.find(
    delivery => !["Delivered", "Cancelled"].includes(delivery.status)
  );
  return (
    <>
      <PageHeading
        eyebrow="Owner preview / rider experience"
        title="Try as Driver"
        detail="Preview the mobile rider workflow without changing your Owner permissions or creating a driver session."
        action={
          <Button variant="secondary" onClick={() => navigate("driver")}>
            <Truck size={15} /> Open driver workspace
          </Button>
        }
      />
      <section className="driver-preview-banner">
        <div>
          <span className="eyebrow">Read-only preview</span>
          <h2>What a rider sees on the road</h2>
          <p>
            Use this view to train staff and check the handover flow. GPS,
            scans, photos, and POD actions remain disabled here.
          </p>
        </div>
        <Truck size={38} />
      </section>
      <div className="driver-preview-grid">
        <section className="panel preview-phone">
          <div className="preview-phone-top">
            <span>NAZMI POD</span>
            <b>Rider route</b>
          </div>
          <div className="preview-status">
            <span className="live-dot" /> Ready for today
          </div>
          <h2>{active?.customer ?? "No assigned delivery"}</h2>
          <p>
            {active?.address ??
              "Create and assign a delivery to preview the destination."}
          </p>
          <div className="preview-steps">
            <span className="done">
              1 <b>Start route</b>
            </span>
            <span>
              2 <b>Arrive at destination</b>
            </span>
            <span>
              3 <b>Submit POD</b>
            </span>
          </div>
          <Button onClick={() => navigate("deliveries")}>
            <PackageCheck size={15} /> View delivery register
          </Button>
        </section>
        <section className="panel">
          <PanelTitle
            eyebrow="Driver checklist"
            title="Every handover accounted for"
          />
          <div className="checklist">
            <span>
              <Check size={15} /> Confirm challan and cartons
            </span>
            <span>
              <MapPin size={15} /> Share live GPS while driving
            </span>
            <span>
              <FileCheck2 size={15} /> Capture POD photos and remarks
            </span>
            <span>
              <ShieldCheck size={15} /> Submit for supervisor verification
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
function ReportsView({
  deliveries,
  navigate,
  lang,
}: {
  deliveries: Delivery[];
  navigate: (view: ViewKey) => void;
  lang: Lang;
}) {
  const delivered = deliveries.filter(d => d.status === "Delivered").length;
  const partial = deliveries.filter(
    d => d.status === "Partially Delivered"
  ).length;
  const failed = deliveries.filter(d => d.status === "Failed").length;
  const cartons = deliveries.reduce(
    (sum, delivery) => sum + delivery.cartons,
    0
  );
  const deliveredCartons = deliveries.reduce(
    (sum, delivery) => sum + delivery.deliveredCartons,
    0
  );
  const exportReport = () => {
    const rows = [
      [
        "Delivery ID",
        "Customer",
        "Status",
        "Driver",
        "Cartons",
        "Delivered",
        "POD",
      ],
      ...deliveries.map(d => [
        d.id,
        d.customer,
        d.status,
        d.driver?.name ?? "Unassigned",
        String(d.cartons),
        String(d.deliveredCartons),
        d.proofStatus,
      ]),
    ];
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nazmi-delivery-report-${localDateKey(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        eyebrow="Owner reporting / exports"
        title={lang === "UR" ? "رپورٹس اور ایکسپورٹس" : "Reports & Exports"}
        detail="Track delivery outcomes, carton movement, POD completion, and download a clean operational report."
        action={
          <Button onClick={exportReport}>
            <Download size={15} /> Export CSV
          </Button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Completion rate"
          value={cartons ? Math.round((deliveredCartons / cartons) * 100) : 0}
          hint="percent of cartons delivered"
          icon={<BarChart3 />}
          tone="blue"
        />
        <Metric
          label="Delivered orders"
          value={delivered}
          hint="fully completed"
          icon={<Check />}
        />
        <Metric
          label="Partial orders"
          value={partial}
          hint="needs reconciliation"
          icon={<AlertTriangle />}
          tone="amber"
        />
        <Metric
          label="Failed orders"
          value={failed}
          hint="needs follow-up"
          icon={<X />}
          tone="coral"
        />
      </div>
      <section className="panel report-breakdown">
        <PanelTitle
          eyebrow="Quality control"
          title="Delivery outcome breakdown"
        />
        <div className="outcome-bars">
          <span>
            <b>Delivered</b>
            <i>
              <em
                style={{
                  width: `${deliveries.length ? (delivered / deliveries.length) * 100 : 0}%`,
                }}
              />
            </i>
            <strong>{delivered}</strong>
          </span>
          <span>
            <b>Partial</b>
            <i>
              <em
                className="amber-bar"
                style={{
                  width: `${deliveries.length ? (partial / deliveries.length) * 100 : 0}%`,
                }}
              />
            </i>
            <strong>{partial}</strong>
          </span>
          <span>
            <b>Failed</b>
            <i>
              <em
                className="red-bar"
                style={{
                  width: `${deliveries.length ? (failed / deliveries.length) * 100 : 0}%`,
                }}
              />
            </i>
            <strong>{failed}</strong>
          </span>
        </div>
        <div className="report-actions">
          <Button variant="secondary" onClick={() => navigate("pod")}>
            <FileCheck2 size={15} /> Review POD queue
          </Button>
          <Button variant="ghost" onClick={() => navigate("audit")}>
            <ShieldCheck size={15} /> Open audit log
          </Button>
        </div>
      </section>
    </>
  );
}
function FleetView({
  staff,
  deliveries,
  navigate,
}: {
  staff: User[];
  deliveries: Delivery[];
  navigate: (view: ViewKey) => void;
}) {
  const riders = staff.filter(member => member.role === "Driver");
  return (
    <>
      <PageHeading
        eyebrow="Owner resources / field team"
        title="Fleet & Riders"
        detail="See rider availability, assigned workload, and vehicle information in one place."
        action={
          <Button onClick={() => navigate("staff")}>
            <UserPlus size={15} /> Add rider
          </Button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Active riders"
          value={riders.filter(rider => rider.active).length}
          hint="ready for dispatch"
          icon={<Truck />}
          tone="blue"
        />
        <Metric
          label="Rider accounts"
          value={riders.length}
          hint="all Driver roles"
          icon={<UsersRound />}
        />
        <Metric
          label="Assigned routes"
          value={
            deliveries.filter(delivery => delivery.assignedDriverId).length
          }
          hint="delivery records"
          icon={<MapPin />}
          tone="amber"
        />
        <Metric
          label="Unassigned routes"
          value={
            deliveries.filter(
              delivery =>
                !delivery.assignedDriverId &&
                !["Delivered", "Cancelled"].includes(delivery.status)
            ).length
          }
          hint="dispatch queue"
          icon={<AlertTriangle />}
          tone="coral"
        />
      </div>
      <section className="panel fleet-list-panel">
        <PanelTitle
          eyebrow="Rider roster"
          title="Team readiness"
          action={
            <Button variant="ghost" onClick={() => navigate("staff")}>
              Manage access <ArrowRight size={15} />
            </Button>
          }
        />
        <div className="fleet-list">
          {riders.length ? (
            riders.map(rider => {
              const load = deliveries.filter(
                delivery =>
                  delivery.assignedDriverId === rider.id &&
                  !["Delivered", "Cancelled"].includes(delivery.status)
              ).length;
              return (
                <div className="fleet-row" key={rider.id}>
                  <Avatar name={rider.name} />
                  <span>
                    <b>{rider.name}</b>
                    <small>
                      {rider.phone || "No phone"} · {load} active route
                      {load === 1 ? "" : "s"}
                    </small>
                  </span>
                  <span
                    className={`access ${rider.active ? "active" : "inactive"}`}
                  >
                    {rider.active ? "Available" : "Inactive"}
                  </span>
                </div>
              );
            })
          ) : (
            <EmptyState text="No rider accounts yet." />
          )}
        </div>
      </section>
    </>
  );
}
function WorkspaceView({
  view,
  user,
  navigate,
  lang,
}: {
  view: ViewKey;
  user: User;
  navigate: (view: ViewKey) => void;
  lang: Lang;
}) {
  const deliveriesQuery = trpc.deliveries.list.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const staffQuery = trpc.staff.list.useQuery();
  const summary = trpc.dashboard.summary.useQuery();
  const deliveries = (deliveriesQuery.data ?? []) as Delivery[];
  const staff = (staffQuery.data ?? []) as User[];
  if (deliveriesQuery.isLoading || staffQuery.isLoading || summary.isLoading)
    return <Loading />;
  if (view === "overview")
    return (
      <Dashboard
        summary={summary.data}
        deliveries={deliveries}
        user={user}
        navigate={navigate}
        lang={lang}
      />
    );
  if (view === "deliveries")
    return (
      <DeliveriesView
        deliveries={deliveries}
        staff={staff}
        user={user}
        navigate={navigate}
        lang={lang}
      />
    );
  if (view === "staff")
    return <StaffView staff={staff} user={user} lang={lang} />;
  if (view === "pod")
    return <PodView deliveries={deliveries} user={user} lang={lang} />;
  if (view === "tracker")
    return <TrackerView deliveries={deliveries} user={user} lang={lang} />;
  if (view === "operations")
    return (
      <OperationsCenterView
        deliveries={deliveries}
        staff={staff}
        navigate={navigate}
        lang={lang}
      />
    );
  if (view === "driver-preview")
    return <DriverPreviewView deliveries={deliveries} navigate={navigate} />;
  if (view === "reports")
    return (
      <ReportsView deliveries={deliveries} navigate={navigate} lang={lang} />
    );
  if (view === "fleet")
    return (
      <FleetView staff={staff} deliveries={deliveries} navigate={navigate} />
    );
  if (view === "settings") return <SettingsView lang={lang} />;
  if (view === "audit") return <AuditView lang={lang} />;
  return (
    <Dashboard
      summary={summary.data}
      deliveries={deliveries}
      user={user}
      navigate={navigate}
      lang={lang}
    />
  );
}
