import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  PackageCheck,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

type DeliveryStatus =
  | "Out for Delivery"
  | "Arrived"
  | "Delivered"
  | "Partially Delivered"
  | "Failed"
  | "Pending Verification"
  | "Scheduled";

type ViewKey =
  | "overview"
  | "deliveries"
  | "schedule"
  | "pod"
  | "drivers"
  | "vehicles"
  | "customers"
  | "reports"
  | "users"
  | "notifications"
  | "settings"
  | "audit"
  | "driver-mobile";

type Delivery = {
  id: string;
  customer: string;
  destination: string;
  driver: string;
  vehicle: string;
  scheduled: string;
  status: DeliveryStatus;
  cartons: number;
  delivered: number;
  proof: "Ready" | "Pending" | "Missing";
  route: string;
  challan: string;
};

const statusColors: Record<string, string> = {
  Delivered: "status-good",
  "Pending Verification": "status-review",
  "Partially Delivered": "status-partial",
  Failed: "status-failed",
  "Out for Delivery": "status-live",
  Arrived: "status-live",
  Scheduled: "status-neutral",
};

const initialDeliveries: Delivery[] = [
  { id: "NAZ-POD-2026-0148", customer: "Atlas Foods (Pvt.) Ltd.", destination: "Korangi Industrial Area", driver: "Bilal Ahmed", vehicle: "LEA-8421", scheduled: "Today · 09:30", status: "Delivered", cartons: 420, delivered: 420, proof: "Ready", route: "Route 01", challan: "CH-260148" },
  { id: "NAZ-POD-2026-0149", customer: "Nexus Retail Group", destination: "SITE Area, Karachi", driver: "Ahsan Raza", vehicle: "KHI-1187", scheduled: "Today · 10:15", status: "Pending Verification", cartons: 280, delivered: 280, proof: "Ready", route: "Route 02", challan: "CH-260149" },
  { id: "NAZ-POD-2026-0150", customer: "Green Basket Trading", destination: "North Nazimabad", driver: "Usman Khan", vehicle: "LEA-7710", scheduled: "Today · 11:00", status: "Partially Delivered", cartons: 600, delivered: 480, proof: "Ready", route: "Route 03", challan: "CH-260150" },
  { id: "NAZ-POD-2026-0151", customer: "PakBuild Materials", destination: "Hub Industrial Estate", driver: "Bilal Ahmed", vehicle: "LEA-8421", scheduled: "Today · 12:30", status: "Out for Delivery", cartons: 350, delivered: 0, proof: "Pending", route: "Route 01", challan: "CH-260151" },
  { id: "NAZ-POD-2026-0152", customer: "Harbor Wholesale", destination: "Clifton Block 2", driver: "Imran Shah", vehicle: "KHI-2291", scheduled: "Today · 13:15", status: "Arrived", cartons: 160, delivered: 0, proof: "Pending", route: "Route 04", challan: "CH-260152" },
  { id: "NAZ-POD-2026-0153", customer: "MetroMart Distribution", destination: "Federal B Area", driver: "Usman Khan", vehicle: "LEA-7710", scheduled: "Today · 14:00", status: "Scheduled", cartons: 520, delivered: 0, proof: "Missing", route: "Route 03", challan: "CH-260153" },
  { id: "NAZ-POD-2026-0154", customer: "Prime Hospitality", destination: "DHA Phase 6", driver: "Ahsan Raza", vehicle: "KHI-1187", scheduled: "Tomorrow · 09:00", status: "Scheduled", cartons: 190, delivered: 0, proof: "Missing", route: "Route 02", challan: "CH-260154" },
  { id: "NAZ-POD-2026-0155", customer: "Crescent Paper Co.", destination: "Landhi", driver: "Unassigned", vehicle: "Unassigned", scheduled: "Tomorrow · 10:30", status: "Scheduled", cartons: 740, delivered: 0, proof: "Missing", route: "Unassigned", challan: "CH-260155" },
];

const volumeData = [
  { day: "Mon", delivered: 44, partial: 5, failed: 3 },
  { day: "Tue", delivered: 51, partial: 4, failed: 2 },
  { day: "Wed", delivered: 48, partial: 7, failed: 4 },
  { day: "Thu", delivered: 62, partial: 5, failed: 2 },
  { day: "Fri", delivered: 58, partial: 6, failed: 3 },
  { day: "Sat", delivered: 35, partial: 3, failed: 1 },
  { day: "Sun", delivered: 0, partial: 0, failed: 0 },
];

const driverRows = [
  { name: "Bilal Ahmed", initials: "BA", assigned: 18, completed: 16, partial: 1, failed: 1, onTime: "89%", tone: "emerald" },
  { name: "Ahsan Raza", initials: "AR", assigned: 15, completed: 13, partial: 1, failed: 0, onTime: "93%", tone: "indigo" },
  { name: "Usman Khan", initials: "UK", assigned: 16, completed: 12, partial: 2, failed: 1, onTime: "81%", tone: "amber" },
  { name: "Imran Shah", initials: "IS", assigned: 12, completed: 10, partial: 0, failed: 1, onTime: "86%", tone: "slate" },
];

type NavItem = { key: string; label: string; icon: typeof Activity; count?: string };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  { label: "Command", items: [{ key: "overview", label: "Owner dashboard", icon: LayoutDashboard }] },
  { label: "Operations", items: [
    { key: "deliveries", label: "Deliveries", icon: PackageCheck, count: "24" },
    { key: "schedule", label: "Schedule & routes", icon: CalendarDays },
    { key: "pod", label: "Proof of delivery", icon: FileCheck2, count: "6" },
  ] },
  { label: "Network", items: [
    { key: "drivers", label: "Drivers", icon: UserRound },
    { key: "vehicles", label: "Vehicles", icon: Truck },
    { key: "customers", label: "Customers", icon: UsersRound },
  ] },
  { label: "Control", items: [
    { key: "reports", label: "Reports & analytics", icon: Activity },
    { key: "users", label: "Users & permissions", icon: ShieldCheck },
    { key: "notifications", label: "Notifications", icon: Bell, count: "4" },
    { key: "audit", label: "Audit log", icon: Archive },
    { key: "settings", label: "Owner settings", icon: Settings2 },
  ] },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

function BrandMark() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark"><span>N</span><div className="brand-check" /></div>
      <div><div className="brand-name">NAZMI POD</div><div className="brand-subtitle">Delivery control</div></div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusColors[status] ?? "status-neutral"}`}><span className="status-dot" />{status}</span>;
}

function MetricCard({ label, value, hint, icon: Icon, tone = "emerald", trend }: { label: string; value: string; hint: string; icon: typeof Activity; tone?: string; trend?: string }) {
  return <div className={`metric-card metric-${tone}`}>
    <div className="metric-top"><span className="eyebrow">{label}</span><div className="metric-icon"><Icon size={16} /></div></div>
    <div className="metric-value">{value}</div>
    <div className="metric-bottom"><span>{hint}</span>{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}</div>
  </div>;
}

function SectionHeader({ kicker, title, detail, action }: { kicker: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{kicker}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function OwnerOverview({ deliveries, onNavigate }: { deliveries: Delivery[]; onNavigate: (view: ViewKey) => void }) {
  const counts = useMemo(() => ({
    total: deliveries.length + 16,
    delivered: deliveries.filter(d => d.status === "Delivered" || d.status === "Pending Verification").length + 13,
    failed: 3,
    partial: deliveries.filter(d => d.status === "Partially Delivered").length + 4,
    live: deliveries.filter(d => d.status === "Out for Delivery" || d.status === "Arrived").length,
    pendingProof: deliveries.filter(d => d.proof === "Pending" || d.proof === "Missing").length,
  }), [deliveries]);
  const donutData = [{ name: "Delivered", value: 72, color: "#0a7b61" }, { name: "Partial", value: 12, color: "#c88a22" }, { name: "Failed", value: 6, color: "#c5564d" }, { name: "Open", value: 10, color: "#cbd5d1" }];

  return <>
    <SectionHeader kicker="Thursday · 30 October 2026 · Asia/Karachi" title="Good evening, Ahsan." detail="Here is the delivery operation at a glance. Demo records are clearly marked while you configure the system." action={<button className="primary-button" onClick={() => onNavigate("deliveries")}><Plus size={16} />New delivery</button>} />
    <div className="demo-strip"><div className="demo-pulse" /><strong>DEMO MODE</strong><span>Analytics below are computed from the current demonstration records.</span><button onClick={() => onNavigate("settings")}>Configure production →</button></div>
    <div className="metrics-grid">
      <MetricCard label="Total deliveries" value={formatNumber(counts.total)} hint="All active records" icon={PackageCheck} trend="12.4%" />
      <MetricCard label="Delivered / verified" value={formatNumber(counts.delivered)} hint="This operating period" icon={BadgeCheck} tone="blue" trend="8.1%" />
      <MetricCard label="Out on route" value={formatNumber(counts.live)} hint="Live assignments" icon={Truck} tone="amber" />
      <MetricCard label="Pending proof" value={formatNumber(counts.pendingProof)} hint="Needs evidence or review" icon={ClipboardCheck} tone="coral" />
    </div>
    <div className="dashboard-grid main-chart-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">Delivery performance</div><h2>Volume & outcomes</h2></div><div className="segmented"><button className="active">7 days</button><button>30 days</button><button>Quarter</button></div></div><div className="legend-row"><span><i className="legend-dot delivered" />Delivered</span><span><i className="legend-dot partial" />Partial</span><span><i className="legend-dot failed" />Failed</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={volumeData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="deliveredFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a7b61" stopOpacity={0.24} /><stop offset="100%" stopColor="#0a7b61" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#e7edea" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#80918b" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#80918b" }} /><ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid #dfe8e4", boxShadow: "0 8px 24px rgba(20,45,37,.08)" }} /><Area type="monotone" dataKey="delivered" stroke="#0a7b61" strokeWidth={2.5} fill="url(#deliveredFill)" /><Area type="monotone" dataKey="partial" stroke="#c88a22" strokeWidth={2} fill="none" /><Area type="monotone" dataKey="failed" stroke="#c5564d" strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div></section>
      <section className="panel outcome-panel"><div className="panel-heading"><div><div className="eyebrow">Outcome mix</div><h2>Where the work stands</h2></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} dataKey="value" innerRadius={67} outerRadius={90} paddingAngle={3} stroke="none">{donutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>90%</strong><span>positive</span></div></div><div className="outcome-list">{donutData.map(item => <div className="outcome-row" key={item.name}><span><i className="outcome-swatch" style={{ background: item.color }} />{item.name}</span><strong>{item.value}%</strong></div>)}</div></section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel table-panel"><div className="panel-heading"><div><div className="eyebrow">Live operation</div><h2>Priority deliveries</h2></div><button className="text-button" onClick={() => onNavigate("deliveries")}>View all <ChevronRight size={15} /></button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Delivery</th><th>Customer</th><th>Driver / vehicle</th><th>Status</th><th>Proof</th></tr></thead><tbody>{deliveries.slice(0, 5).map(d => <tr key={d.id} onClick={() => onNavigate("deliveries")}><td><strong className="mono">{d.id}</strong><span className="cell-sub">{d.scheduled} · {d.route}</span></td><td><strong>{d.customer}</strong><span className="cell-sub"><MapPin size={11} />{d.destination}</span></td><td><strong>{d.driver}</strong><span className="cell-sub"><Truck size={11} />{d.vehicle}</span></td><td><StatusBadge status={d.status} /></td><td><span className={`proof-chip ${d.proof.toLowerCase()}`}><FileCheck2 size={13} />{d.proof}</span></td></tr>)}</tbody></table></div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><div className="eyebrow">Attention queue</div><h2>Needs your eye</h2></div><span className="count-pill">4 open</span></div><div className="attention-list"><button onClick={() => onNavigate("pod")}><span className="attention-icon coral"><FileCheck2 size={16} /></span><span><strong>6 PODs awaiting verification</strong><small>Supervisor queue · updated 9 min ago</small></span><ChevronRight size={15} /></button><button onClick={() => onNavigate("deliveries")}><span className="attention-icon amber"><AlertTriangle size={16} /></span><span><strong>1 partial delivery needs follow-up</strong><small>Green Basket Trading · 120 cartons</small></span><ChevronRight size={15} /></button><button onClick={() => onNavigate("schedule")}><span className="attention-icon blue"><CalendarDays size={16} /></span><span><strong>1 delivery remains unassigned</strong><small>Crescent Paper Co. · tomorrow 10:30</small></span><ChevronRight size={15} /></button><button onClick={() => onNavigate("vehicles")}><span className="attention-icon slate"><Truck size={16} /></span><span><strong>LEA-5192 maintenance due</strong><small>Service window · 02 Nov 2026</small></span><ChevronRight size={15} /></button></div></section>
    </div>
    <section className="panel driver-panel"><div className="panel-heading"><div><div className="eyebrow">Field performance</div><h2>Driver pulse</h2></div><button className="text-button" onClick={() => onNavigate("drivers")}>Open driver management <ChevronRight size={15} /></button></div><div className="driver-table"><div className="driver-head"><span>Driver</span><span>Assigned</span><span>Completed</span><span>Partial</span><span>Failed</span><span>On time</span></div>{driverRows.map(row => <div className="driver-row" key={row.name}><div className="driver-name"><span className={`avatar avatar-${row.tone}`}>{row.initials}</span><strong>{row.name}</strong></div><span>{row.assigned}</span><span className="good-text">{row.completed}</span><span className="amber-text">{row.partial}</span><span className={row.failed ? "coral-text" : "muted-text"}>{row.failed}</span><span className="on-time"><span className="mini-progress"><i style={{ width: row.onTime }} /></span>{row.onTime}</span></div>)}</div></section>
  </>;
}

function DeliveriesView({ deliveries, setDeliveries, onSelect }: { deliveries: Delivery[]; setDeliveries: React.Dispatch<React.SetStateAction<Delivery[]>>; onSelect: (delivery: Delivery) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const filtered = deliveries.filter(d => (status === "All statuses" || d.status === status) && [d.id, d.customer, d.driver, d.destination].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <>
    <SectionHeader kicker="Operations / delivery register" title="Delivery management" detail="Every delivery record, assignment and status event in one place." action={<button className="primary-button"><Plus size={16} />Create delivery</button>} />
    <div className="toolbar"><div className="search-box"><Search size={16} /><input placeholder="Search ID, customer, driver or destination" value={query} onChange={e => setQuery(e.target.value)} /></div><select value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option>{Object.keys(statusColors).map(s => <option key={s}>{s}</option>)}</select><button className="secondary-button"><Filter size={15} />More filters</button><button className="secondary-button"><Download size={15} />Export</button></div>
    <div className="panel table-panel"><div className="table-meta"><span><strong>{filtered.length}</strong> visible records · <span className="demo-text">DEMO</span></span><span className="sync-state"><span className="sync-dot" />Live data source ready</span></div><div className="table-scroll"><table className="data-table delivery-table"><thead><tr><th><input type="checkbox" /></th><th>Delivery ID</th><th>Customer / destination</th><th>Scheduled</th><th>Driver / vehicle</th><th>Load</th><th>Status</th><th>Proof</th><th /></tr></thead><tbody>{filtered.map(d => <tr key={d.id} onClick={() => onSelect(d)}><td><input type="checkbox" onClick={e => e.stopPropagation()} /></td><td><strong className="mono">{d.id}</strong><span className="cell-sub">{d.challan}</span></td><td><strong>{d.customer}</strong><span className="cell-sub"><MapPin size={11} />{d.destination}</span></td><td><strong>{d.scheduled.split(" · ")[0]}</strong><span className="cell-sub">{d.scheduled.split(" · ")[1]}</span></td><td><strong>{d.driver}</strong><span className="cell-sub"><Truck size={11} />{d.vehicle}</span></td><td><strong>{d.delivered}/{d.cartons}</strong><span className="cell-sub">cartons</span></td><td><StatusBadge status={d.status} /></td><td><span className={`proof-chip ${d.proof.toLowerCase()}`}><FileCheck2 size={13} />{d.proof}</span></td><td><button className="icon-button" onClick={e => e.stopPropagation()}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div></div>
    <div className="quick-actions"><button onClick={() => setDeliveries(current => current.map(d => d.id === "NAZ-POD-2026-0150" ? { ...d, status: "Pending Verification", proof: "Ready" } : d))}><RefreshCw size={15} />Mark partial follow-up ready</button><button><UploadCloud size={15} />Import from Excel</button><button><FileText size={15} />Open complete history</button></div>
  </>;
}

function DriverMobileView({ deliveries }: { deliveries: Delivery[] }) {
  const [language, setLanguage] = useState<"EN" | "UR">("EN");
  const [delivered, setDelivered] = useState("350");
  const [rejected, setRejected] = useState("0");
  const [note, setNote] = useState("");
  const [photoAdded, setPhotoAdded] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const mine = deliveries.filter(d => d.driver === "Bilal Ahmed");
  const active = mine.find(d => d.status === "Out for Delivery" || d.status === "Arrived") ?? mine[0];
  const urdu = language === "UR";
  const requestGps = () => navigator.geolocation?.getCurrentPosition(position => { setGpsEnabled(true); setGpsAccuracy(Math.round(position.coords.accuracy)); }, () => { setGpsEnabled(false); setGpsAccuracy(null); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  return <div className={`driver-mobile-shell ${urdu ? "rtl" : ""}`}>
    <div className="driver-mobile-top"><BrandMark /><button className="language-toggle" onClick={() => setLanguage(language === "EN" ? "UR" : "EN")}>{language === "EN" ? "اردو" : "EN"}</button></div>
    <div className="driver-greeting"><div className="eyebrow">{urdu ? "آج کی ڈیلیوری" : "TODAY'S DELIVERY"}</div><h1>{urdu ? "السلام علیکم، بلال" : "Hello, Bilal"}</h1><p>{urdu ? "صرف چند چیزیں مکمل کریں" : "Complete the handover in a few taps."}</p></div>
    {completed ? <div className="driver-pod-confirmation"><div className="confirmation-icon"><Check size={22} /></div><div className="eyebrow">{urdu ? "کامیاب" : "DELIVERY COMPLETE"}</div><h2>{urdu ? "POD تیار ہے" : "POD is ready"}</h2><p>{urdu ? "کارٹن ہینڈ اوور ریکارڈ تیار ہو گیا ہے" : "The carton handover PDF was created automatically."}</p><button className="driver-primary-button" onClick={() => setCompleted(false)}>{urdu ? "اگلی ڈیلیوری" : "Next delivery"}<ChevronRight size={17} /></button></div> : <>
      <div className="driver-active-card"><div className="active-card-top"><span className="live-label"><span className="live-dot" />{urdu ? "فعال ڈیلیوری" : "ACTIVE DELIVERY"}</span><span className="mono">{active?.id.slice(-4)}</span></div><h2>{active?.customer ?? "Atlas Foods (Pvt.) Ltd."}</h2><p><MapPin size={15} />{active?.destination ?? "Korangi Industrial Area"}</p><div className="driver-card-meta"><span><FileText size={14} />{active?.challan ?? "CH-260151"}</span><span><PackageCheck size={14} />{active?.cartons ?? 350} cartons sent</span></div></div>
      <div className="driver-proof-card"><div className="proof-card-heading"><div><div className="eyebrow">{urdu ? "کارٹن ہینڈ اوور" : "CARTON HANDOVER"}</div><h2>{urdu ? "کیا ڈیلیور ہوا؟" : "What was delivered?"}</h2></div><span className="step-chip">1 minute</span></div><div className="driver-input-grid"><label><span>{urdu ? "ڈیلیورڈ کارٹن" : "Delivered cartons"}</span><input className="driver-number-input" inputMode="numeric" value={delivered} onChange={e => setDelivered(e.target.value)} /></label><label><span>{urdu ? "خراب / واپس" : "Rejected / damaged"}</span><input className="driver-number-input" inputMode="numeric" value={rejected} onChange={e => setRejected(e.target.value)} /></label></div><label className="driver-note-label"><span>{urdu ? "نوٹ (اختیاری)" : "Short note (optional)"}</span><input className="driver-note-input" placeholder={urdu ? "مثلاً 2 کارٹن واپس" : "e.g. 2 cartons returned"} value={note} onChange={e => setNote(e.target.value)} /></label><div className="driver-proof-actions"><button className={`driver-photo-button ${photoAdded ? "added" : ""}`} onClick={() => setPhotoAdded(true)}><Camera size={19} /><span>{photoAdded ? (urdu ? "تصویر شامل" : "Photo added") : (urdu ? "تصویر لیں" : "Take photo")}<small>{photoAdded ? "1 photo" : "Optional proof"}</small></span><ChevronRight size={16} /></button><button className={`driver-gps-button ${gpsEnabled ? "enabled" : ""}`} onClick={requestGps}><MapPin size={17} /><span>{gpsEnabled ? (urdu ? "GPS محفوظ" : "GPS saved") : (urdu ? "GPS شامل کریں" : "Add GPS location")}<small>{gpsEnabled ? `${gpsAccuracy ?? ""}m accuracy` : "High accuracy · Optional"}</small></span></button></div><button className="driver-complete-button" onClick={() => setCompleted(true)}><Check size={18} />{urdu ? "ڈیلیوری مکمل کریں" : "Complete delivery"}</button><p className="driver-no-signature">{urdu ? "کسٹمر کے دستخط کی ضرورت نہیں" : "No customer signature required."}</p></div>
    </>}
    <div className="driver-section-title"><h3>{urdu ? "اگلی ڈیلیوری" : "Next delivery"}</h3><button>{urdu ? "سب دیکھیں" : "View all"}</button></div><div className="driver-list">{mine.slice(1, 3).map(d => <div className="driver-list-item" key={d.id}><span className="route-number">02</span><span><strong>{d.customer}</strong><small><MapPin size={11} />{d.destination}</small></span><span className="driver-list-time">{d.scheduled.split(" · ")[1]}</span><ChevronRight size={16} /></div>)}</div><div className="driver-bottom-nav"><button className="active"><LayoutDashboard size={18} /><span>{urdu ? "ہوم" : "Home"}</span></button><button><CalendarDays size={18} /><span>{urdu ? "روٹ" : "Route"}</span></button><button><FileCheck2 size={18} /><span>{urdu ? "تاریخ" : "History"}</span></button><button><UserRound size={18} /><span>{urdu ? "پروفائل" : "Profile"}</span></button></div>
  </div>;
}

function SimpleModule({ view, onNavigate }: { view: ViewKey; onNavigate: (view: ViewKey) => void }) {
  const configs: Record<string, { kicker: string; title: string; detail: string; icon: typeof Activity; rows: string[] }> = {
    schedule: { kicker: "Operations / planning", title: "Schedule & routes", detail: "Plan the factory departure board, assign vehicles and keep unassigned work visible.", icon: CalendarDays, rows: ["Route 01 · Karachi West", "Route 02 · Clifton / DHA", "Route 03 · North District", "Route 04 · Industrial Loop"] },
    pod: { kicker: "Evidence / verification queue", title: "Proof of delivery", detail: "Review carton handover records, photos and delivery evidence before records become verified.", icon: FileCheck2, rows: ["6 carton handovers awaiting supervisor verification", "2 POD PDFs generated today", "1 correction requested by dispatch", "Customer signatures are not required"] },
    drivers: { kicker: "Network / field team", title: "Driver management", detail: "Performance with context: volume, partials, failed attempts, timing and route conditions.", icon: UserRound, rows: ["Bilal Ahmed · 18 assigned · 89% on time", "Ahsan Raza · 15 assigned · 93% on time", "Usman Khan · 16 assigned · 81% on time", "Imran Shah · 12 assigned · 86% on time"] },
    vehicles: { kicker: "Network / fleet", title: "Vehicle management", detail: "Track readiness, assignment and maintenance without allowing unavailable vehicles onto a route.", icon: Truck, rows: ["LEA-8421 · On Delivery · Bilal Ahmed", "KHI-1187 · Assigned · Ahsan Raza", "LEA-7710 · Available · Usman Khan", "LEA-5192 · Maintenance due · 02 Nov 2026"] },
    customers: { kicker: "Network / customer directory", title: "Customers", detail: "Customer history and destination context for faster, cleaner delivery creation.", icon: UsersRound, rows: ["Atlas Foods (Pvt.) Ltd. · 42 deliveries", "Nexus Retail Group · 31 deliveries", "Green Basket Trading · 24 deliveries", "PakBuild Materials · 18 deliveries"] },
    reports: { kicker: "Control / reporting", title: "Reports & analytics", detail: "Export operational truth by date, customer, driver, vehicle, status and branch.", icon: Activity, rows: ["Monthly company report · October 2026", "Driver performance report · This month", "Failed delivery report · Last 30 days", "Customer delivery history · Select customer"] },
    users: { kicker: "Control / access", title: "Users & permissions", detail: "Owner-managed access with roles, invitations, custom permissions and audit-safe changes.", icon: ShieldCheck, rows: ["Ahsan · Owner · Full access", "4 drivers · Driver role · Own assignments only", "2 dispatch users · Dispatch permissions", "Optional two-factor authentication · Ready to enable"] },
    notifications: { kicker: "Control / internal updates", title: "Notifications", detail: "Role-aware internal events across assignments, status changes and submitted proof.", icon: Bell, rows: ["POD submitted by Bilal Ahmed", "Delivery assigned to Ahsan Raza", "Partial delivery requires follow-up", "Vehicle maintenance reminder"] },
    audit: { kicker: "Control / traceability", title: "Audit log", detail: "An immutable operational history for the Owner and authorised administrators.", icon: Archive, rows: ["Delivery assignment changed · NAZ-POD-2026-0151", "POD submitted · NAZ-POD-2026-0149", "Status changed · Arrived → Pending Verification", "Demo mode enabled · Owner settings"] },
    settings: { kicker: "Owner control / configuration", title: "Owner settings", detail: "Keep company identity and operating rules editable without inventing missing information.", icon: Settings2, rows: ["Company profile · Nazmi Packaging Company (Pvt.) Ltd.", "Timezone · Asia/Karachi · PKR · DD/MM/YYYY", "Duplicate checks · Challan + order/reference", "Evidence retention · Configurable · No silent deletion"] },
  };
  const config = configs[view] ?? configs.settings;
  const Icon = config.icon;
  return <><SectionHeader kicker={config.kicker} title={config.title} detail={config.detail} action={<button className="secondary-button"><Download size={15} />Export view</button>} /><div className="module-hero"><div className="module-hero-icon"><Icon size={23} /></div><div><div className="eyebrow">NAZMI POD / DEMO WORKSPACE</div><h2>Operational records stay connected.</h2><p>This workspace is shaped for the real workflow. Connect managed data and storage to move from demonstration records to production evidence.</p></div><button className="primary-button" onClick={() => onNavigate("settings")}>Open configuration <ChevronRight size={16} /></button></div><div className="module-grid">{config.rows.map((row, index) => <div className="module-row" key={row}><span className="module-index">0{index + 1}</span><span>{row}</span><ChevronRight size={16} /></div>)}</div><div className="panel empty-panel"><Globe2 size={22} /><h3>Ready for the next connected step</h3><p>When this module is connected to managed records, these rows become drill-down tables, forms and exports with server-side permission checks.</p><button className="text-button" onClick={() => onNavigate("overview")}>Return to Owner dashboard <ChevronRight size={15} /></button></div></>;
}

function DeliveryDrawer({ delivery, onClose, onStatus }: { delivery: Delivery; onClose: () => void; onStatus: (status: DeliveryStatus) => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">Delivery detail</div><h2 className="mono">{delivery.id}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-status"><StatusBadge status={delivery.status} /><span className="demo-text">DEMO RECORD</span></div><div className="drawer-block"><span className="eyebrow">Customer & destination</span><h3>{delivery.customer}</h3><p><MapPin size={14} />{delivery.destination}</p><p><FileText size={14} />Challan {delivery.challan}</p></div><div className="drawer-block"><span className="eyebrow">Assignment</span><div className="drawer-stat"><span>Driver</span><strong>{delivery.driver}</strong></div><div className="drawer-stat"><span>Vehicle</span><strong>{delivery.vehicle}</strong></div><div className="drawer-stat"><span>Route</span><strong>{delivery.route}</strong></div></div><div className="drawer-block"><span className="eyebrow">Load & evidence</span><div className="drawer-stat"><span>Cartons delivered</span><strong>{delivery.delivered} / {delivery.cartons}</strong></div><div className="evidence-grid"><span className={delivery.proof === "Ready" ? "ready" : "pending"}><Camera size={14} />Photos</span><span className={delivery.proof === "Ready" ? "ready" : "pending"}><FileCheck2 size={14} />POD PDF</span></div></div><div className="drawer-block"><span className="eyebrow">Workflow action</span><div className="drawer-actions"><button className="secondary-button" onClick={() => onStatus("Out for Delivery")}>Start / resume</button><button className="primary-button" onClick={() => onStatus("Pending Verification")}>Send for verification <Send size={15} /></button></div></div><div className="drawer-timeline"><div className="timeline-item done"><i /><span><strong>Delivery created</strong><small>30 Oct · 08:12 · Dispatch</small></span></div><div className="timeline-item done"><i /><span><strong>Assigned to {delivery.driver}</strong><small>30 Oct · 08:36 · Dispatch Manager</small></span></div><div className="timeline-item current"><i /><span><strong>{delivery.status}</strong><small>Waiting for next operational action</small></span></div></div></aside></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [role, setRole] = useState("OWNER");

  const navigate = (view: ViewKey) => { setActiveView(view); setMobileNavOpen(false); window.history.replaceState(null, "", view === "overview" ? "/" : `/${view}`); };
  const updateSelectedStatus = (status: DeliveryStatus) => {
    if (!selectedDelivery) return;
    setDeliveries(current => current.map(d => d.id === selectedDelivery.id ? { ...d, status, proof: status === "Pending Verification" ? "Ready" : d.proof } : d));
    setSelectedDelivery(current => current ? { ...current, status, proof: status === "Pending Verification" ? "Ready" : current.proof } : current);
  };

  const renderView = () => {
    if (activeView === "overview") return <OwnerOverview deliveries={deliveries} onNavigate={navigate} />;
    if (activeView === "deliveries") return <DeliveriesView deliveries={deliveries} setDeliveries={setDeliveries} onSelect={setSelectedDelivery} />;
    if (activeView === "driver-mobile") return <DriverMobileView deliveries={deliveries} />;
    return <SimpleModule view={activeView} onNavigate={navigate} />;
  };

  return <div className="app-shell">
    <aside className={`side-rail ${mobileNavOpen ? "open" : ""}`}>
      <div className="rail-top"><BrandMark /><button className="rail-close icon-button" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
      <div className="workspace-select"><span className="workspace-dot" /><span><strong>Nazmi Packaging</strong><small>Primary workspace</small></span><ChevronDown size={14} /></div>
      <nav className="main-nav">{navSections.map(section => <div className="nav-section" key={section.label}><span className="nav-label">{section.label}</span>{section.items.map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-item ${activeView === item.key ? "active" : ""}`} onClick={() => navigate(item.key as ViewKey)}><Icon size={17} /><span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>; })}</div>)}<div className="nav-section driver-entry"><span className="nav-label">Experience</span><button className={`nav-item ${activeView === "driver-mobile" ? "active" : ""}`} onClick={() => navigate("driver-mobile")}><Globe2 size={17} /><span>Driver mobile</span><span className="new-chip">Try</span></button></div></nav>
      <div className="rail-footer"><div className="sync-card"><span className="sync-dot" /><div><strong>System healthy</strong><small>Demo workspace · synced</small></div></div><button className="user-mini"><span className="avatar avatar-emerald">AH</span><span><strong>Ahsan</strong><small>Owner</small></span><MoreHorizontal size={15} /></button></div>
    </aside>
    <main className="main-canvas"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button><button className="breadcrumb-button" onClick={() => navigate("overview")}><Command size={15} /><span>NAZMI POD</span><ChevronRight size={14} /><strong>{activeView === "overview" ? "Owner dashboard" : activeView.replace("-", " ")}</strong></button></div><div className="topbar-actions"><div className="role-switch"><span className="role-dot" /><select value={role} onChange={e => setRole(e.target.value)}><option>OWNER</option><option>MANAGEMENT</option><option>DISPATCH</option><option>SUPERVISOR</option><option>DRIVER</option></select><ChevronDown size={13} /></div><button className="icon-button notification-button" onClick={() => navigate("notifications")}><Bell size={17} /><span>4</span></button><button className="avatar avatar-emerald avatar-button" onClick={() => navigate("settings")}>AH</button></div></header><div className="content-wrap">{role === "DRIVER" && activeView === "overview" ? <DriverMobileView deliveries={deliveries} /> : renderView()}</div></main>
    {selectedDelivery && <DeliveryDrawer delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} onStatus={updateSelectedStatus} />}
  </div>;
}
