import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  MapPin,
  Minus,
  Plus,
  Loader2,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import { EVENT } from "../data/event";
import { ErrorPage } from "./ErrorPage";
import { DEFAULT_CUTOFF, PREORDER_ITEMS, rupiah } from "../data/preorder";
import { BACKEND, findOrders, submitPreorder } from "../lib/backend";
import { trackClick } from "../lib/analytics";
import { usePreorder } from "../hooks/usePreorder";
import { BackButton } from "../components/BackButton";
import { PaperPlane } from "../components/PaperPlane";
import { Sprout } from "../components/Sprout";
import { useMenu } from "../hooks/useMenu";
import {
  AdminContact,
  FindOrder,
  NoRefund,
  WaInput,
  waValid,
  MyOrdersList,
  OrderTracker,
  useMyOrders,
} from "../components/OrderTracker";

/** the plane loops at least this long, so a fast answer still reads as "on its way" */
const MIN_FLIGHT_MS = 1600;
const newId = () =>
  crypto.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateLong = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * /preorder — pick drinks / bundles, leave a name + WhatsApp, pay by BCA transfer. The order
 * waits on hold until an admin finds the transfer on /hasil; then the pickup code shows up
 * right here (the phone remembers its orders) and the admin sends it on WhatsApp too.
 * What's on sale and the prices come from the Sheet (set on /config); the Sheet re-checks
 * everything, so the total here is only a preview.
 */
export function PreorderPage() {
  const { config, loaded, open } = usePreorder();
  // no answer from the Sheet after a while → say so instead of an endless sprout
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (loaded) return setStuck(false);
    const t = window.setTimeout(() => setStuck(true), 12_000);
    return () => window.clearTimeout(t);
  }, [loaded]);
  // `normal` = the booth menu price; when the pre-order price is lower we show what they save
  const live = useMenu();
  const menuPrice = (i: (typeof PREORDER_ITEMS)[number]) =>
    (i.kind === "drink"
      ? live.drinks.find((d) => d.id === i.id)?.price
      : live.bundles.find((b) => b.name === i.name)?.price) ?? i.price;
  const items = PREORDER_ITEMS.filter((i) => config.items[i.id]?.on).map(
    (i) => ({ ...i, normal: menuPrice(i), price: config.items[i.id].price }),
  );
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [flight, setFlight] = useState<null | "flying" | "away">(null);
  // orders made on this phone (with a snapshot of what was ordered) + the one being looked at
  const mine = useMyOrders();
  const [trackId, setTrackId] = useState<string | null>(null);
  const tracked = mine.orders.find((o) => o.id === trackId);
  const [error, setError] = useState<string | null>(null);
  // opened from the WhatsApp link (?cek=KODE): fetch that order and go straight to its status
  const [opening, setOpening] = useState(() => new URLSearchParams(location.search).get("cek"));
  const [linkMiss, setLinkMiss] = useState<string>();
  const { merge } = mine;
  useEffect(() => {
    if (!opening) return;
    let live = true;
    void findOrders({ ref: opening }).then((r) => {
      if (!live) return;
      if (r?.length) {
        merge(r);
        setTrackId(r[r.length - 1].id);
      } else {
        setLinkMiss(r ? "Link pesanan itu nggak ketemu — coba pakai nomor WA + nama di sini." : "Sinyalnya lagi susah — buka lagi link-nya sebentar lagi, atau cek di sini.");
      }
      setOpening(null);
    });
    return () => {
      live = false;
    };
  }, [opening, merge]);
  // one id per order attempt, so a retry never makes a second order
  const [orderId, setOrderId] = useState(newId);

  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const total = useMemo(
    () => lines.reduce((t, i) => t + i.price * qty[i.id], 0),
    [lines, qty],
  );
  const cups = lines.reduce((n, i) => n + qty[i.id], 0);
  const saved = lines.reduce(
    (t, i) => t + Math.max(0, i.normal - i.price) * qty[i.id],
    0,
  );
  // stored as the part after +62; sent as 08…
  const waOk = waValid(wa);
  const ready = lines.length > 0 && name.trim() && waOk;

  const bump = (id: string, d: number) =>
    setQty((q) => ({
      ...q,
      [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)),
    }));

  const submit = async () => {
    if (!ready || flight) return;
    setError(null);
    setFlight("flying");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const started = performance.now();
    const r = await submitPreorder({
      id: orderId,
      items: lines.map((i) => ({ id: i.id, qty: qty[i.id] })),
      name: name.trim(),
      wa: "0" + wa,
      note: note.trim(),
      hp,
    });
    await new Promise((res) =>
      window.setTimeout(
        res,
        Math.max(0, MIN_FLIGHT_MS - (performance.now() - started)),
      ),
    );
    if (r?.ok) {
      trackClick("preorder-terkirim");
      mine.add({
        id: orderId,
        at: Date.now(),
        name: name.trim(),
        total: r.total,
        saved,
        status: r.status,
        code: "",
        ref: r.ref,
        lines: lines.map((i) => ({
          id: i.id,
          name: i.name,
          qty: qty[i.id],
          price: i.price,
        })),
      });
      setTrackId(orderId);
      // a fresh form for a second order
      setQty({});
      setOrderId(newId());
      setFlight("away");
    } else {
      setFlight(null);
      setError(
        r?.error === "closed"
          ? "Pre-order baru saja ditutup. Sampai ketemu di booth ya!"
          : r?.error === "empty"
            ? "Ada menu yang barusan dimatikan — cek lagi pesananmu."
            : r?.error === "contact"
              ? "Cek lagi nama dan nomor WhatsApp-mu."
              : "Sinyalnya lagi susah — pesanan belum terkirim. Coba lagi ya.",
      );
    }
  };

  return (
    <main className="paper min-h-dvh px-5 pb-10 pt-6 text-brown">
      <div className="mx-auto max-w-2xl">
        <AnimatePresence mode="wait">
          {flight ? (
            <motion.section
              key="flight"
              className="flex min-h-[80dvh] flex-col items-center justify-center text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PaperPlane state={flight} onGone={() => setFlight(null)} />
              <motion.p
                className="font-display text-xl font-semibold text-brown-soft"
                animate={{ opacity: flight === "flying" ? [0.5, 1, 0.5] : 0 }}
                transition={
                  flight === "flying"
                    ? { duration: 1.4, repeat: Infinity }
                    : { duration: 0.3 }
                }
              >
                Mengirim pesananmu…
              </motion.p>
            </motion.section>
          ) : opening && !tracked ? (
            <motion.section
              key="opening"
              className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="size-8 animate-spin text-terracotta" />
              <p className="font-display text-lg text-brown-soft">Membuka pesananmu…</p>
            </motion.section>
          ) : tracked ? (
            <motion.section
              key={`track-${tracked.id}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <OrderTracker
                order={tracked}
                config={config}
                onBack={() => setTrackId(null)}
                onProof={() => mine.patch(tracked.id, { proof: true })}
                checkedAt={mine.checkedAt}
              />
            </motion.section>
          ) : BACKEND && !loaded && stuck ? (
            <motion.section
              key="down"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ErrorPage kind={navigator.onLine ? 503 : "offline"} />
            </motion.section>
          ) : BACKEND && !loaded ? (
            <motion.section
              key="loading"
              className="grid min-h-[70dvh] place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Sprout state="grow" className="h-auto w-14" />
            </motion.section>
          ) : !open ? (
            <motion.section
              key="closed"
              className="flex min-h-[80dvh] flex-col items-center justify-center text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <BackButton className="fixed left-5 top-6" />
              <Sprout state="grow" className="h-auto w-16" />
              <h1 className="mt-4 font-display text-3xl font-bold">
                Pre-order lagi tutup
              </h1>
              <p className="mt-3 max-w-sm font-display text-lg text-brown-soft">
                Langsung mampir aja ke {EVENT.table} — {EVENT.dateLabel},{" "}
                {EVENT.timeLabel}.
              </p>
              {/* closed for new orders, but earlier ones (and their codes) stay reachable */}
              <div className="mt-8 flex w-full max-w-md flex-col gap-4 text-left">
                <MyOrdersList orders={mine.orders} onOpen={setTrackId} />
                <FindOrder onFound={mine.merge} onOpen={setTrackId} notice={linkMiss} />
              </div>
            </motion.section>
          ) : (
            <motion.form
              key="form"
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={(e) => {
                e.preventDefault();
                // "Cek pesanan" sits inside this form; its submit must never place an order
                if (e.target !== e.currentTarget) return;
                void submit();
              }}
            >
              <BackButton />
              <header className="-mt-2">
                <h1 className="flex items-center gap-2 font-display text-3xl font-bold leading-none">
                  <ShoppingBag className="size-7 text-terracotta" /> Pre-order
                  Pletok
                </h1>
                <p className="mt-2 flex items-center gap-1.5 font-cond text-base italic text-brown-soft">
                  <MapPin className="size-4" /> Ambil di {EVENT.table} ·{" "}
                  {EVENT.dateLabel}, {EVENT.timeLabel}
                </p>
                <p className="flex items-center gap-1.5 font-cond text-base italic text-brown-soft">
                  <CalendarClock className="size-4" /> Pre-order ditutup{" "}
                  {dateLong(Math.min(config.cutoff, DEFAULT_CUTOFF))} WIB
                </p>
                <AdminContact />
              </header>

              <MyOrdersList orders={mine.orders} onOpen={setTrackId} />
              <FindOrder onFound={mine.merge} onOpen={setTrackId} notice={linkMiss} />

              <div className="flex flex-col gap-3">
                {items.map((i) => {
                  const n = qty[i.id] ?? 0;
                  return (
                    <div
                      key={i.id}
                      className={`flex items-center gap-3 rounded-3xl border-2 p-3 transition-colors ${n ? "border-terracotta/60 bg-cream" : "border-brown/10 bg-cream/70"}`}
                    >
                      <div className="flex h-20 w-24 shrink-0 items-end justify-center">
                        {i.images.map((src, k) => (
                          <img
                            key={k}
                            src={src}
                            alt=""
                            className="h-full w-auto min-w-0 object-contain"
                            style={{
                              marginInline: i.images.length > 1 ? -10 : 0,
                            }}
                          />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold leading-tight">
                          {i.name}
                        </p>
                        <p className="truncate font-cond text-sm italic text-brown-soft">
                          {i.detail}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-display font-semibold text-terracotta">
                          {rupiah(i.price)}
                          {i.normal > i.price && (
                            <>
                              <s className="text-sm font-normal text-brown/45">
                                {rupiah(i.normal)}
                              </s>
                              <span className="rounded-full bg-leaf px-2 py-0.5 font-cond text-xs italic text-cream">
                                hemat {rupiah(i.normal - i.price)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Step
                          label={`Kurangi ${i.name}`}
                          onClick={() => bump(i.id, -1)}
                          disabled={!n}
                        >
                          <Minus className="size-4" />
                        </Step>
                        <span className="w-6 text-center font-display text-lg font-bold tabular-nums">
                          {n}
                        </span>
                        <Step
                          label={`Tambah ${i.name}`}
                          onClick={() => bump(i.id, 1)}
                          solid
                        >
                          <Plus className="size-4" />
                        </Step>
                      </div>
                    </div>
                  );
                })}
              </div>

              <section className="flex flex-col gap-2">
                <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-terracotta">
                  Data pemesan
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Nama"
                  autoComplete="name"
                  className="rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta"
                />
                <WaInput value={wa} onChange={setWa} />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Catatan (opsional) — misal: es sedikit"
                  className="resize-none rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta"
                />
                <p className="font-cond text-sm italic text-brown/55">
                  Nomor WhatsApp cuma dipakai tim Pletok untuk konfirmasi
                  pesananmu & kirim kode ambil.
                </p>
                <NoRefund className="mt-1" />
                <AdminContact className="mt-2" />
              </section>

              <input
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                className="absolute -left-[9999px] size-px opacity-0"
                aria-hidden
              />

              {error && (
                <p className="flex items-start gap-2 rounded-2xl bg-terracotta/10 p-3 font-display text-sm text-terracotta">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}

              <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-cream from-60% to-transparent px-5 pb-4 pt-6">
                <AnimatePresence>
                  {saved > 0 && (
                    <motion.p
                      key="saved"
                      className="mx-auto mb-2 w-fit rounded-full bg-leaf px-4 py-1.5 text-center font-display text-sm font-semibold text-cream shadow"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      Pre-order bikin kamu hemat {rupiah(saved)}!
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.button
                  type="submit"
                  disabled={!ready}
                  whileTap={{ scale: 0.96 }}
                  className="flex w-full items-center justify-between gap-3 rounded-full bg-terracotta px-6 py-4 font-display text-lg font-semibold text-cream shadow-[0_6px_0_#6e3418] disabled:bg-[#cfa98f] disabled:shadow-none"
                >
                  <span>
                    {!lines.length
                      ? "Pilih menu dulu"
                      : !name.trim() || !waOk
                        ? "Isi nama & WhatsApp"
                        : `Lanjut bayar · ${cups} cup`}
                  </span>
                  <span className="tabular-nums">{rupiah(total)}</span>
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Step({
  children,
  onClick,
  disabled,
  solid,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 place-items-center rounded-full disabled:opacity-30 ${solid ? "bg-brown text-cream" : "bg-cream-deep text-brown"}`}
    >
      {children}
    </motion.button>
  );
}
