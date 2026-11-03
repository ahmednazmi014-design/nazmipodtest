import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function PublicTracking({ token }: { token: string }) {
  const [urdu, setUrdu] = useState(
    () => localStorage.getItem("nazmi-lang") === "UR"
  );
  const query = trpc.deliveries.getPublicTracking.useQuery(
    { token },
    { refetchInterval: 15000, retry: false }
  );
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
                <h1>{urdu ? "آپ کی ڈیلیوری" : "Your delivery"}</h1>
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
                <b>
                  {new Date(data.scheduledAt).toLocaleString(
                    urdu ? "ur-PK" : "en-PK",
                    { dateStyle: "medium", timeStyle: "short" }
                  )}
                </b>
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
                <b>
                  {new Date(data.updatedAt).toLocaleString(
                    urdu ? "ur-PK" : "en-PK",
                    { dateStyle: "medium", timeStyle: "short" }
                  )}
                </b>
              </div>
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
