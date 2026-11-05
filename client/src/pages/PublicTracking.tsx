import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  Send,
  Truck,
  Upload,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

async function compressCustomerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const value = canvas.toDataURL("image/jpeg", 0.78);
  if (value.length > 1_340_000) throw new Error("Photo is too large.");
  return value;
}

export default function PublicTracking({ token }: { token: string }) {
  const [urdu, setUrdu] = useState(
    () => localStorage.getItem("nazmi-lang") === "UR"
  );
  const [customerName, setCustomerName] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [issue, setIssue] = useState("Missing cartons");
  const [issueMessage, setIssueMessage] = useState("");
  const [contact, setContact] = useState("");
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const query = trpc.deliveries.getPublicTracking.useQuery(
    { token },
    { refetchInterval: 15000, retry: false }
  );
  const confirm = trpc.deliveries.customerConfirm.useMutation({
    onSuccess: () => {
      toast.success(
        urdu ? "آپ کی تصدیق محفوظ ہو گئی" : "Your confirmation was saved"
      );
      void query.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const report = trpc.deliveries.customerIssue.useMutation({
    onSuccess: () => {
      toast.success(urdu ? "رپورٹ بھیج دی گئی" : "Issue sent to dispatch");
      setIssueMessage("");
      setContact("");
      setProofPhotos([]);
    },
    onError: error => toast.error(error.message),
  });
  const data = query.data;
  useEffect(() => {
    document.title = "Delivery tracking | NAZMI POD";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow, noarchive";
    return () => {
      document.title = "NAZMI POD";
      meta?.remove();
    };
  }, []);
  const status = data?.status ?? "";
  const moving = ["Out for Delivery", "Arrived"].includes(status);
  const gps = moving ? data?.gps : null;
  const bbox = gps
    ? `${gps.lng - 0.012},${gps.lat - 0.009},${gps.lng + 0.012},${gps.lat + 0.009}`
    : "";
  const mapUrl = gps
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${gps.lat}%2C${gps.lng}`
    : "";
  const destinationUrl = data?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`
    : "";
  const formatDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString(urdu ? "ur-PK" : "en-PK", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const submitConfirmation = (received: boolean) => {
    if (customerName.trim().length < 2)
      return toast.error(urdu ? "نام درج کریں" : "Enter your name first");
    confirm.mutate({ token, customerName, received, notes: confirmNotes });
  };
  const customerPdfUrl = `/api/customer-pod/${encodeURIComponent(token)}.pdf`;
  return (
    <main
      className={`customer-track-page${urdu ? " rtl" : ""}`}
      dir={urdu ? "rtl" : "ltr"}
    >
      <header className="customer-track-header">
        <a className="customer-track-brand" href="/" aria-label="NAZMI POD">
          <span className="customer-track-mark">N</span>
          <span>
            <b>NAZMI POD</b>
            <small>NAZMI PACKAGING</small>
          </span>
        </a>
        <button
          className="language-button"
          onClick={() => setUrdu(value => !value)}
        >
          {urdu ? "EN" : "اردو"}
        </button>
      </header>
      <section className="customer-track-card">
        {query.isLoading ? (
          <div className="customer-track-state">
            <RefreshCw className="spin" />
            <h1>
              {urdu ? "ڈیلیوری تلاش کی جا رہی ہے" : "Finding your delivery"}
            </h1>
          </div>
        ) : query.isError || !data ? (
          <div className="customer-track-state">
            <PackageCheck size={34} />
            <h1>
              {urdu
                ? "یہ ٹریکنگ لنک دستیاب نہیں"
                : "This tracking link is unavailable"}
            </h1>
            <p>
              {urdu
                ? "لنک ختم ہو چکا ہے یا منسوخ کر دیا گیا ہے۔ بھیجنے والے سے نیا لنک طلب کریں۔"
                : "The link may have expired or been revoked. Please ask the sender for a new link."}
            </p>
          </div>
        ) : (
          <>
            <div className="customer-track-eyebrow">
              {urdu ? "ڈیلیوری کی تازہ ترین حالت" : "DELIVERY STATUS"}
            </div>
            <div className="customer-track-title-row">
              <div>
                <h1>
                  {data.customer || (urdu ? "آپ کی ڈیلیوری" : "Your delivery")}
                </h1>
                <span className="mono">{data.deliveryId}</span>
              </div>
              <span
                className={`customer-track-status ${moving ? "moving" : status === "Delivered" ? "complete" : ""}`}
              >
                {status}
              </span>
            </div>
            <div className="customer-track-progress" aria-label={status}>
              <span className="complete">
                <i>
                  <Check size={13} />
                </i>
                {urdu ? "شیڈول" : "Scheduled"}
              </span>
              <span
                className={
                  moving ||
                  status === "Delivered" ||
                  status === "Partially Delivered"
                    ? "complete"
                    : ""
                }
              >
                <i>
                  <Truck size={13} />
                </i>
                {urdu ? "راستے میں" : "On the way"}
              </span>
              <span
                className={
                  status === "Delivered" || status === "Partially Delivered"
                    ? "complete"
                    : ""
                }
              >
                <i>
                  <PackageCheck size={13} />
                </i>
                {urdu ? "مکمل" : "Complete"}
              </span>
            </div>
            <div className="customer-track-facts">
              <div>
                <span>
                  <Clock3 size={15} />
                  {urdu ? "مقررہ وقت" : "Scheduled"}
                </span>
                <b>{formatDate(data.scheduledAt)}</b>
              </div>
              <div>
                <span>
                  <PackageCheck size={15} />
                  {urdu ? "کارٹن" : "Cartons"}
                </span>
                <b>
                  {data.deliveredCartons} / {data.cartons}
                </b>
              </div>
              <div>
                <span>
                  <RefreshCw size={15} />
                  {urdu ? "آخری اپ ڈیٹ" : "Last update"}
                </span>
                <b>{formatDate(data.updatedAt)}</b>
              </div>
            </div>
            <div className="customer-track-destination">
              <div>
                <MapPin size={16} />
                <span>
                  <b>{urdu ? "ڈیلیوری کا مقام" : "Delivery destination"}</b>
                  <small>{data.address}</small>
                </span>
              </div>
              {destinationUrl && (
                <a
                  className="button secondary"
                  href={destinationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {urdu ? "نقشہ کھولیں" : "Open map"}
                </a>
              )}
            </div>
            {data.customerPdfAvailable && (
              <a
                className="button secondary customer-pdf-button"
                href={customerPdfUrl}
              >
                <Download size={15} />
                {urdu
                  ? "POD / انوائس PDF ڈاؤن لوڈ کریں"
                  : "Download delivery POD / invoice"}
              </a>
            )}
            {moving && (
              <div className="customer-track-eta">
                <Truck size={17} />
                <span>
                  <b>{urdu ? "متوقع آمد" : "Estimated arrival"}</b>
                  <small>
                    {data.estimatedArrival
                      ? formatDate(data.estimatedArrival)
                      : `${data.etaMinutes ?? "—"} min`}
                  </small>
                </span>
              </div>
            )}
            <div className="customer-track-timeline">
              {(data.timeline ?? []).map((item: any) => (
                <div className={item.complete ? "complete" : ""} key={item.key}>
                  <i />{" "}
                  <span>
                    <b>
                      {urdu && item.key === "completed" ? "مکمل" : item.label}
                    </b>
                    <small>{formatDate(item.at)}</small>
                  </span>
                </div>
              ))}
            </div>
            {gps && mapUrl && (
              <div className="customer-track-map">
                <div className="customer-track-map-label">
                  <MapPin size={15} />
                  {urdu ? "رائیڈر کا تازہ مقام" : "Latest rider location"}
                </div>
                <iframe
                  title="Approximate live delivery location"
                  src={mapUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <small>
                  {urdu
                    ? "مقام کی تازہ کاری خودکار ہے۔"
                    : "Location refreshes automatically while the delivery is active."}
                </small>
              </div>
            )}
            {!moving &&
              status !== "Delivered" &&
              status !== "Partially Delivered" && (
                <p className="customer-track-note">
                  {urdu
                    ? "ڈیلیوری روانہ ہونے پر اس صفحے پر مقام ظاہر ہوگا۔"
                    : "Live location will appear here when the delivery is on the way."}
                </p>
              )}
            <div className="customer-track-actions">
              <h2>
                {data.confirmation
                  ? urdu
                    ? "آپ کی تصدیق موصول ہو گئی"
                    : "Your confirmation is received"
                  : urdu
                    ? "ڈیلیوری کی تصدیق"
                    : "Confirm your delivery"}
              </h2>
              {!data.confirmation && (
                <>
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder={urdu ? "آپ کا نام" : "Your name"}
                  />
                  <textarea
                    value={confirmNotes}
                    onChange={e => setConfirmNotes(e.target.value)}
                    placeholder={urdu ? "اختیاری نوٹ" : "Optional note"}
                  />
                  <div>
                    <button
                      className="button primary"
                      onClick={() => submitConfirmation(true)}
                      disabled={confirm.isPending}
                    >
                      <CheckCircle2 size={15} />
                      {urdu ? "موصول ہو گیا" : "I received it"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => submitConfirmation(false)}
                      disabled={confirm.isPending}
                    >
                      <AlertTriangle size={15} />
                      {urdu ? "مسئلہ ہے" : "There is an issue"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="customer-track-issue">
              <h2>
                <AlertTriangle size={16} />
                {urdu ? "مسئلہ رپورٹ کریں" : "Report a delivery issue"}
              </h2>
              <select value={issue} onChange={e => setIssue(e.target.value)}>
                <option>Missing cartons</option>
                <option>Damaged goods</option>
                <option>Wrong delivery</option>
                <option>Late delivery</option>
                <option>Other</option>
              </select>
              <textarea
                value={issueMessage}
                onChange={e => setIssueMessage(e.target.value)}
                placeholder={
                  urdu ? "تفصیل لکھیں" : "Tell dispatch what happened"
                }
              />
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder={
                  urdu ? "رابطہ نمبر (اختیاری)" : "Phone or email (optional)"
                }
              />
              <label className="customer-proof-upload">
                <Upload size={15} />
                <span>
                  {urdu
                    ? "ثبوت کی تصاویر شامل کریں (زیادہ سے زیادہ 3)"
                    : "Attach proof photos (up to 3)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async event => {
                    const files = Array.from(event.target.files ?? []).slice(
                      0,
                      3
                    );
                    try {
                      const photos = await Promise.all(
                        files.map(compressCustomerPhoto)
                      );
                      setProofPhotos(photos);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not attach photo"
                      );
                    }
                  }}
                />
                {proofPhotos.length > 0 && (
                  <small>
                    {proofPhotos.length} photo
                    {proofPhotos.length === 1 ? "" : "s"} attached
                  </small>
                )}
              </label>
              <button
                className="button secondary"
                onClick={() =>
                  report.mutate({
                    token,
                    issue: issue as any,
                    message: issueMessage,
                    contact,
                    proofPhotos,
                  })
                }
                disabled={report.isPending || issueMessage.trim().length < 2}
              >
                <Send size={15} />
                {urdu ? "رپورٹ بھیجیں" : "Send report"}
              </button>
            </div>
          </>
        )}
      </section>
      <footer className="customer-track-footer">
        {data?.companyName || "NAZMI PACKAGING"} ·{" "}
        {urdu ? "محفوظ ڈیلیوری ٹریکنگ" : "Secure delivery tracking"}
      </footer>
    </main>
  );
}

export function CustomerTrackingLanding() {
  const [link, setLink] = useState("");
  const [urdu, setUrdu] = useState(
    () => localStorage.getItem("nazmi-lang") === "UR"
  );
  const openTracking = (event: FormEvent) => {
    event.preventDefault();
    const value = link.trim();
    if (!value) return;
    const token = value.match(/\/track\/([^/?#]+)/)?.[1] ?? value;
    window.location.assign(`/track/${encodeURIComponent(token)}`);
  };
  useEffect(() => {
    document.title = "Customer delivery tracking | NAZMI POD";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (meta) meta.content = "noindex, nofollow, noarchive";
  }, []);
  return (
    <main
      className={`customer-portal-page${urdu ? " rtl" : ""}`}
      dir={urdu ? "rtl" : "ltr"}
    >
      <header className="customer-track-header">
        <a
          className="customer-track-brand"
          href="/customer-tracking"
          aria-label="NAZMI POD"
        >
          <span className="customer-track-mark">N</span>
          <span>
            <b>NAZMI POD</b>
            <small>NAZMI PACKAGING</small>
          </span>
        </a>
        <button
          className="language-button"
          onClick={() => {
            const next = !urdu;
            setUrdu(next);
            localStorage.setItem("nazmi-lang", next ? "UR" : "EN");
          }}
        >
          {urdu ? "EN" : "اردو"}
        </button>
      </header>
      <section className="customer-portal-hero">
        <span className="customer-track-eyebrow">
          {urdu ? "کسٹمر پورٹل" : "CUSTOMER PORTAL"}
        </span>
        <h1>{urdu ? "اپنی ڈیلیوری ٹریک کریں" : "Track your delivery"}</h1>
        <p>
          {urdu
            ? "اپنے بھیجے گئے محفوظ ٹریکنگ لنک کو یہاں کھولیں۔ لاگ اِن کی ضرورت نہیں۔"
            : "Open the secure tracking link sent to you. No account or staff login is required."}
        </p>
        <form onSubmit={openTracking} className="customer-portal-form">
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder={
              urdu
                ? "ٹریکنگ لنک پیسٹ کریں"
                : "Paste your tracking link or token"
            }
            aria-label="Tracking link"
          />
          <button className="button primary" type="submit">
            <PackageCheck size={16} />
            {urdu ? "ڈیلیوری دیکھیں" : "View delivery"}
          </button>
        </form>
        <div className="customer-portal-promises">
          <span>
            <Truck size={16} />
            <b>{urdu ? "لائیو ETA" : "Live ETA"}</b>
            <small>{urdu ? "روانگی کے بعد" : "When on route"}</small>
          </span>
          <span>
            <MapPin size={16} />
            <b>{urdu ? "محفوظ مقام" : "Safe location"}</b>
            <small>{urdu ? "صرف ٹریکنگ لنک سے" : "Link-only access"}</small>
          </span>
          <span>
            <CheckCircle2 size={16} />
            <b>{urdu ? "آسان تصدیق" : "Easy confirmation"}</b>
            <small>{urdu ? "رسید کی تصدیق" : "Receipt confirmation"}</small>
          </span>
        </div>
      </section>
      <footer className="customer-track-footer">
        NAZMI PACKAGING ·{" "}
        {urdu ? "محفوظ ڈیلیوری ٹریکنگ" : "Secure delivery tracking"}
      </footer>
    </main>
  );
}
